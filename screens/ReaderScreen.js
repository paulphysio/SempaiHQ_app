import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  Platform,
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
import GelOrb from '../components/nav/GelOrb';
import { GelButton } from '../components/gel/GelKit';
import { GelPageHeader } from '../components/gel/GelGate';

const { width, height } = Dimensions.get('window');

export default function ReaderScreen({ navigation }) {
  const { isDark, colors } = useTheme();
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
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'web' ? 0 : insets.top }}>
      <GelPageHeader title="Reader" subtitle="Your own PDF and EPUB files" onBack={handleBack} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, paddingBottom: 110 }}>
        <View pointerEvents="none"><GelOrb icon={error ? 'exclamation-circle' : 'book-reader'} size={76} lit breathe={!error} tone={error ? '#E5484D' : undefined} /></View>
        <Text style={{ fontFamily: 'Yoruka', fontSize: 26, color: colors.textPrimary, marginTop: 18, textAlign: 'center' }}>
          {error ? "Couldn't open that file" : 'Read your own books'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 320 }}>
          {error || 'Open a PDF or EPUB from your phone — it scrolls, keeps your place, and has full screen.'}
        </Text>
        <GelButton
          label={error ? 'Try another file' : 'Open a file'}
          icon="folder-open"
          loading={loading}
          onPress={() => { setError(null); pickFile(); }}
          style={{ marginTop: 22, alignSelf: 'stretch', maxWidth: 360, width: '100%' }}
        />
      </View>
    </View>
  );
}
