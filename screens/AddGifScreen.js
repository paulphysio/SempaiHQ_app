import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { styles } from '../styles/AddGifStyles';

const AddGifScreen = () => {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFilePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSubmit = async () => {
    if (!title || !file) {
      setMessage('Please provide a title and select a GIF file.');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const fileExt = file.uri.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.type || 'image/gif',
        name: fileName,
      });

      const { error: uploadError } = await supabase.storage
        .from('gifs')
        .upload(filePath, formData);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('gifs')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      const gifUrl = urlData.publicUrl;

      const tagsArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const { error: insertError } = await supabase
        .from('gifs')
        .insert([{ title, url: gifUrl, tags: tagsArray.length ? tagsArray : null }]);

      if (insertError) {
        throw new Error(`Insert failed: ${insertError.message}`);
      }

      setMessage('GIF added successfully!');
      setTitle('');
      setTags('');
      setFile(null);
    } catch (error) {
      console.error('Error adding GIF:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.content}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>GIF Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter GIF title"
              placeholderTextColor="#888"
              editable={!uploading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Tags (optional, comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="e.g., funny, cat, reaction"
              placeholderTextColor="#888"
              editable={!uploading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>GIF File</Text>
            <TouchableOpacity
              style={styles.fileButton}
              onPress={handleFilePick}
              disabled={uploading}
            >
              <Icon name="image" size={20} color="#9B59B6" />
              <Text style={styles.fileButtonText}>
                {file ? file.uri.split('/').pop() : 'Select GIF File'}
              </Text>
            </TouchableOpacity>
          </View>

          {file && (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: file.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Add GIF</Text>
            )}
          </TouchableOpacity>

          {message && (
            <Text style={[styles.message, message.includes('Error') ? styles.messageError : styles.messageSuccess]}>
              {message}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
  );
};

export default AddGifScreen;
