import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { 
  generateWalletQRCode, 
  generatePaymentQRCode, 
  generateChapterQRCode,
  generateNFTQRCode 
} from '../services/qrCodeService';
import { styles } from '../styles/QRCodeDisplayStyles';

const QRCodeDisplay = ({ visible, onClose, qrType, data }) => {
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState(null);

  useEffect(() => {
    if (visible && data) {
      generateQRCode();
    }
  }, [visible, data, qrType]);

  const generateQRCode = () => {
    setLoading(true);
    try {
      let generatedData = null;
      
      switch (qrType) {
        case 'wallet':
          generatedData = generateWalletQRCode(data);
          break;
        case 'payment':
          generatedData = generatePaymentQRCode(data.address, data.amount, data.token);
          break;
        case 'chapter':
          generatedData = generateChapterQRCode(data.novelId, data.chapterId);
          break;
        case 'nft':
          generatedData = generateNFTQRCode(data.nftMint);
          break;
        default:
          generatedData = generateWalletQRCode(data);
      }
      
      setQrData(generatedData);
    } catch (error) {
      console.error('[QRCodeDisplay] Error generating QR code:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQRTitle = () => {
    switch (qrType) {
      case 'wallet':
        return 'Wallet Address';
      case 'payment':
        return 'Payment Request';
      case 'chapter':
        return 'Share Chapter';
      case 'nft':
        return 'Share NFT';
      default:
        return 'QR Code';
    }
  };

  const getQRDescription = () => {
    switch (qrType) {
      case 'wallet':
        return 'Scan to send tokens to this wallet';
      case 'payment':
        return `Request ${data?.amount || 0} ${data?.token || 'SMP'}`;
      case 'chapter':
        return 'Share this chapter with others';
      case 'nft':
        return 'Share this NFT with others';
      default:
        return 'Scan to interact';
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <FontAwesome5 name="times" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <LinearGradient
            colors={['#9B59B6', '#8E44AD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <FontAwesome5 name="qrcode" size={40} color="#FFFFFF" />
            <Text style={styles.title}>{getQRTitle()}</Text>
            <Text style={styles.subtitle}>{getQRDescription()}</Text>
          </LinearGradient>

          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#9B59B6" />
                <Text style={styles.loadingText}>Generating QR code...</Text>
              </View>
            ) : (
              <>
                <View style={styles.qrContainer}>
                  <View style={styles.qrPlaceholder}>
                    <FontAwesome5 name="qrcode" size={80} color="#CCCCCC" />
                    <Text style={styles.qrPlaceholderText}>
                      {qrData || 'QR Code Data'}
                    </Text>
                  </View>
                </View>

                {qrType === 'wallet' && (
                  <View style={styles.addressContainer}>
                    <Text style={styles.addressLabel}>Wallet Address</Text>
                    <Text style={styles.addressText} numberOfLines={2}>
                      {data || 'No address provided'}
                    </Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <FontAwesome5 name="download" size={16} color="#FFFFFF" style={styles.actionIcon} />
                    <Text style={styles.actionText}>Save</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <FontAwesome5 name="share-alt" size={16} color="#FFFFFF" style={styles.actionIcon} />
                    <Text style={styles.actionText}>Share</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoBox}>
                  <FontAwesome5 name="info-circle" size={16} color="#4A90E2" />
                  <Text style={styles.infoText}>
                    Scan this QR code with any Solana-compatible wallet to interact
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default QRCodeDisplay;
