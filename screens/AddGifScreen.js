import React, {useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { getAddGifStyles } from '../styles/AddGifStyles';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';
import GelOrb from '../components/nav/GelOrb';
import { GelGlass, GelInput, GelButton } from '../components/gel/GelKit';
import { readImageBytes } from '../utils/imageUpload';

const AddGifScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getAddGifStyles(colors), [isDark]);
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
      toast.error('Failed to pick image');
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

      const { error: uploadError } = await supabase.storage
        .from('gifs')
        .upload(filePath, await readImageBytes(file.uri), { contentType: fileExt === 'gif' ? 'image/gif' : 'image/' + fileExt });

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 16 }}>
          <View pointerEvents="none"><GelOrb icon="film" size={60} lit breathe={false} /></View>
          <Text style={{ fontFamily: 'Yoruka', fontSize: 28, color: colors.textPrimary, marginTop: 12 }}>Add a GIF</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 6 }}>It joins the GIF library everyone can use in Chat.</Text>
        </View>
        <GelGlass radius={28} glow={false} padding={18}>
          <GelInput label="Title" value={title} onChangeText={setTitle} placeholder="e.g. happy dance" editable={!uploading} style={{ marginTop: 0 }} />
          <GelInput label="Tags (optional)" value={tags} onChangeText={setTags} placeholder="funny, cat, reaction" editable={!uploading} hint="Separate with commas" />
          <GelButton
            label={file ? 'Change GIF' : 'Choose a GIF'}
            icon="image"
            variant="secondary"
            onPress={handleFilePick}
            disabled={uploading}
            style={{ marginTop: 16 }}
          />
          {file ? (
            <Image source={{ uri: file.uri }} style={{ width: '100%', height: 200, borderRadius: 18, marginTop: 14 }} resizeMode="contain" />
          ) : null}
          {message ? (
            <Text style={{ color: message.startsWith('Error') || message.startsWith('Please') ? colors.danger : colors.success, textAlign: 'center', marginTop: 12 }}>{message}</Text>
          ) : null}
          <GelButton label="Add GIF" icon="plus" loading={uploading} onPress={handleSubmit} style={{ marginTop: 16 }} />
        </GelGlass>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AddGifScreen;
