import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { styles } from '../styles/DownloadStyles';

const API_BASE_URL = 'https://sempaihq.com/api';

const DownloadScreen = () => {
  const [downloadInfo, setDownloadInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDownloadInfo() {
      try {
        const res = await fetch(`${API_BASE_URL}/android-download`);
        if (!res.ok) throw new Error('Failed to fetch download info');
        const data = await res.json();
        const normalized = Array.isArray(data) ? data : [];
        
        if (normalized.length === 0) {
          setDownloadInfo([
            {
              version: '1.0.8',
              download_url: 'https://sempaihq.com/apk/sempai-1.0.8.apk',
              created_at: '2025-08-30T00:00:00.000Z',
            },
            {
              version: '1.0.3',
              download_url: 'https://sempaihq.com/apk/sempai-1.0.3.apk',
              created_at: '2025-08-16T00:00:00.000Z',
            },
            {
              version: '1.0.2',
              download_url: 'https://sempaihq.com/apk/sempai-1.0.2.apk',
              created_at: '2025-08-16T00:00:00.000Z',
            },
          ]);
        } else {
          setDownloadInfo(normalized);
        }
      } catch (err) {
        setDownloadInfo([
          {
            version: '1.0.8',
            download_url: 'https://sempaihq.com/apk/sempai-1.0.8.apk',
            created_at: '2025-08-30T00:00:00.000Z',
          },
          {
            version: '1.0.3',
            download_url: 'https://sempaihq.com/apk/sempai-1.0.3.apk',
            created_at: '2025-08-16T00:00:00.000Z',
          },
          {
            version: '1.0.2',
            download_url: 'https://sempaihq.com/apk/sempai-1.0.2.apk',
            created_at: '2025-08-16T00:00:00.000Z',
          },
        ]);
        setError('Could not load download info. Showing local downloads.');
      } finally {
        setLoading(false);
      }
    }
    fetchDownloadInfo();
  }, []);

  const visibleDownloadInfo = Array.isArray(downloadInfo)
    ? downloadInfo.filter((apk) => apk?.version !== '1.0.1' && apk?.version !== '1.0.7')
    : [];

  const handleDownload = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open download link');
    }
  };

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#9B59B6" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {visibleDownloadInfo.length > 0 && (
          <View style={styles.downloadList}>
            {visibleDownloadInfo.map((apk) => (
              <View key={apk.version} style={styles.downloadCard}>
                <View style={styles.cardContent}>
                  <View style={styles.versionInfo}>
                    <Text style={styles.versionTitle}>Version {apk.version}</Text>
                    {apk.created_at && (
                      <Text style={styles.releaseDate}>
                        Released: {new Date(apk.created_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={() => handleDownload(apk.download_url)}
                  >
                    <Icon name="download" size={20} color="#FFF" />
                    <Text style={styles.downloadButtonText}>Download APK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <Text style={styles.installNote}>
              If you have issues installing, make sure "Install from Unknown Sources" is enabled on your device.
            </Text>
          </View>
        )}

        {visibleDownloadInfo.length === 0 && !loading && !error && (
          <Text style={styles.noDownloads}>No APK versions available.</Text>
        )}
      </ScrollView>
  );
};

export default DownloadScreen;
