import React, {useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getDownloadStyles } from '../styles/DownloadStyles';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';
import { GelButton } from '../components/gel/GelKit';

import { SITE_API } from '../constants';
const API_BASE_URL = SITE_API;

const DownloadScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getDownloadStyles(colors), [isDark]);
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
        toast.error('Cannot open this URL');
      }
    } catch (err) {
      toast.error('Failed to open download link');
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
                  <GelButton label="Download" icon="download" small onPress={() => handleDownload(apk.download_url)} />
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
