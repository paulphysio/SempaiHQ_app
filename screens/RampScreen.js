import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { LinearGradient } from 'expo-linear-gradient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import * as WebBrowser from 'expo-web-browser';

const RampScreen = () => {
  const navigation = useNavigation();
  const { wallet: embeddedWallet } = useContext(EmbeddedWalletContext);
  const [selectedProvider, setSelectedProvider] = useState('moonpay');

  // Check if wallet is connected
  const isWalletConnected = embeddedWallet;
  const walletAddress = embeddedWallet?.publicKey?.toString();

  const providers = [
    {
      id: 'moonpay',
      name: 'MoonPay',
      description: 'Buy crypto with credit card, bank transfer, or Apple Pay',
      icon: '🌙',
      url: 'https://moonpay.com',
      features: ['Fast verification', 'High limits', 'Mobile-friendly', 'In-app widget'],
    },
  ];

  const handleBuyCrypto = async (providerId) => {
    if (providerId === 'moonpay') {
      if (!isWalletConnected) {
        alert('Please connect your wallet first');
        return;
      }
      
      try {
        // Call web API to get MoonPay widget URL
        console.log('[RampScreen] Calling MoonPay API with wallet:', walletAddress);
        const response = await fetch('https://www.sempaihq.com/api/moonpay-widget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            fiatCurrency: 'USD',
            defaultFiatAmount: '100',
          }),
        });

        console.log('[RampScreen] API response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[RampScreen] API error response:', errorText);
          throw new Error(`Failed to generate MoonPay widget URL: ${response.status} - ${errorText}`);
        }

        const { widgetUrl } = await response.json();
        console.log('[RampScreen] Widget URL generated:', widgetUrl);
        
        // Open in in-app browser
        await WebBrowser.openBrowserAsync(widgetUrl, {
          dismissButtonStyle: 'close',
          readerMode: false,
        });
      } catch (error) {
        console.error('[RampScreen] Error opening MoonPay:', error);
        alert(`Failed to open MoonPay: ${error.message}. Please try again.`);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={20} color="#D94F04" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Icon name="credit-card" size={24} color="#D94F04" />
          <Text style={styles.headerText}>Ramp - Buy Crypto</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Buy Crypto with Ramp</Text>
          <Text style={styles.subtitle}>
            Purchase SOL, USDC, SMP, and other tokens easily with your preferred payment method
          </Text>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          {isWalletConnected ? (
            <View style={[styles.infoBox, styles.connectedBox]}>
              <Icon name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.infoText}>
                Connected: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </Text>
            </View>
          ) : (
            <View style={styles.infoBox}>
              <Icon name="info-circle" size={20} color="#D94F04" />
              <Text style={styles.infoText}>
                Connect your wallet to see your address and make purchases
              </Text>
            </View>
          )}
        </View>

        {/* Providers Section */}
        <View style={styles.providersSection}>
          <Text style={styles.sectionTitle}>Choose Your Provider</Text>
          {providers.map((provider) => (
            <TouchableOpacity
              key={provider.id}
              style={[
                styles.providerCard,
                selectedProvider === provider.id && styles.selectedProvider,
              ]}
              onPress={() => setSelectedProvider(provider.id)}
            >
              <View style={styles.providerHeader}>
                <Text style={styles.providerIcon}>{provider.icon}</Text>
                <Text style={styles.providerName}>{provider.name}</Text>
              </View>
              <Text style={styles.providerDescription}>{provider.description}</Text>
              <View style={styles.featuresContainer}>
                {provider.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Text style={styles.featureBullet}>✓</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.buyButton}
                onPress={() => handleBuyCrypto(provider.id)}
              >
                <Text style={styles.buyButtonText}>
                  Open MoonPay Widget
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        {/* How It Works Section */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Choose a Provider</Text>
                <Text style={styles.stepDescription}>Select from our trusted crypto onboarding providers</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Complete KYC</Text>
                <Text style={styles.stepDescription}>Verify your identity with the provider (one-time process)</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Buy Crypto</Text>
                <Text style={styles.stepDescription}>Use your preferred payment method to purchase crypto</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Start Using</Text>
                <Text style={styles.stepDescription}>Your crypto will be sent directly to your wallet</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.supportSection}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <Text style={styles.supportText}>
            If you encounter any issues during the purchase process, please contact the provider's support team directly.
            Each provider has dedicated 24/7 support to assist you.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#16213E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 10,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    color: '#D94F04',
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    color: '#D94F04',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 16,
    lineHeight: 24,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 79, 4, 0.1)',
    borderWidth: 1,
    borderColor: '#D94F04',
    borderRadius: 8,
    padding: 15,
    gap: 10,
  },
  connectedBox: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: '#4CAF50',
  },
  infoText: {
    color: '#D94F04',
    fontSize: 14,
    flex: 1,
  },
  providersSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 15,
  },
  providerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },
  selectedProvider: {
    borderColor: '#D94F04',
    backgroundColor: 'rgba(217, 79, 4, 0.1)',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 10,
  },
  providerIcon: {
    fontSize: 32,
  },
  providerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  providerDescription: {
    color: '#aaa',
    fontSize: 15,
    marginBottom: 15,
  },
  featuresContainer: {
    marginBottom: 15,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  featureBullet: {
    color: '#D94F04',
    fontSize: 16,
    fontWeight: '700',
  },
  featureText: {
    color: '#888',
    fontSize: 14,
  },
  buyButton: {
    backgroundColor: '#D94F04',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  howItWorksSection: {
    marginBottom: 30,
  },
  stepContainer: {
    gap: 15,
  },
  step: {
    flexDirection: 'row',
    gap: 15,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 40,
    height: 40,
    backgroundColor: '#D94F04',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  stepDescription: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
  supportSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  supportText: {
    color: '#aaa',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
});

export default RampScreen;
