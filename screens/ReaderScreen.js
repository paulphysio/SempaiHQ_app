import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import PDFReader from '../components/PDFReader';
import EPUBReader from '../components/EPUBReader';
import { getReaderStyles } from '../styles/ReaderStyles';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

export default function ReaderScreen({ navigation }) {
  const { isDark } = useTheme();
  const styles = useMemo(() => getReaderStyles(isDark), [isDark]);
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTOC, setShowTOC] = useState(false);

  // Clear file when leaving screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        setFile(null);
        setFileType(null);
        setError(null);
      };
    }, [])
  );

  const pickFile = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/epub+zip', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      const fileUri = result.assets[0].uri;
      const fileName = result.assets[0].name;
      const fileSize = result.assets[0].size;

      // Determine file type from extension
      const extension = fileName.split('.').pop().toLowerCase();
      let type = null;

      if (extension === 'pdf') {
        type = 'pdf';
      } else if (extension === 'epub') {
        type = 'epub';
      } else {
        // Try to detect from mime type
        const mimeType = result.assets[0].mimeType || '';
        if (mimeType.includes('pdf')) {
          type = 'pdf';
        } else if (mimeType.includes('epub')) {
          type = 'epub';
        }
      }

      if (!type) {
        setError('Unsupported file type. Please select a PDF or EPUB file.');
        setLoading(false);
        return;
      }

      setFile({
        uri: fileUri,
        name: fileName,
        size: fileSize,
      });
      setFileType(type);
      setLoading(false);
    } catch (err) {
      console.error('Error picking file:', err);
      setError('Failed to open file. Please try again.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (file) {
      setFile(null);
      setFileType(null);
    } else {
      navigation.goBack();
    }
  };

  const renderFilePicker = () => (
    <View style={styles.filePickerContainer}>
      <View style={styles.filePickerCard}>
        <Ionicons name="book-outline" size={64} color={styles.filePickerIcon.color} style={styles.filePickerIcon} />
        <Text style={styles.filePickerTitle}>Reader</Text>
        <Text style={styles.filePickerSubtitle}>
          Open PDF and EPUB files to read
        </Text>
        <TouchableOpacity style={styles.pickButton} onPress={pickFile} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="folder-open" size={20} color="#FFFFFF" />
              <Text style={styles.pickButtonText}>Open File</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReader = () => {
    if (fileType === 'pdf') {
      return <PDFReader file={file} title={file.name} onBack={handleBack} />;
    } else if (fileType === 'epub') {
      return <EPUBReader file={file} title={file.name} onBack={handleBack} />;
    }
    return null;
  };

  // Reserve space for the floating GlobalBottomNav (68px tall, sits
  // max(insets.bottom, 8) + 12px above the bottom edge) so reader content
  // and bottom controls aren't covered by it.
  const bottomNavClearance = Math.max(insets.bottom, 8) + 12 + 68 + 8;

  // An open book gets the whole screen (the reader has its own bar).
  if (file && !error) return renderReader();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={styles.headerTitle.color} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reader</Text>
        {file && (
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowTOC(true)}>
              <Ionicons name="list-outline" size={24} color={styles.headerTitle.color} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={styles.errorText.color} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.pickButton} onPress={() => setError(null)}>
            <Text style={styles.pickButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!file && !error && renderFilePicker()}
    </View>
  );
}
