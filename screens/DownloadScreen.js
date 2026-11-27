import React, {useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getDownloadStyles } from '../styles/DownloadStyles';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';
import { GelButton } from '../components/gel/GelKit';

import { SITE_API } from '../constants';
const API_BASE_URL = SITE_API;
const CURRENT_APK = { version: '1.2', download_url: 'https://expo.dev/artifacts/eas/Q2385iBn-h5Wle32oDRBkC_FrvANXme-O-Rz0lErlFQ.apk', created_at: '2026-11-14T00:00:00.000Z' };

const DownloadScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getDownloadStyles(colors), [isDark]);
  const [downloadInfo, setDownloadInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Only the newest builds are supported — older APKs are blocked at launch.
  useEffect(() => {
    setDownloadInfo([CURRENT_APK]);
    setError(null);
    setLoading(false);
  }, []);

  const visibleDownloadInfo = downloadInfo;

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
