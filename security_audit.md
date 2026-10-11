# Security Review: SempaiHQ_app

Commit: fa117e98d97ea98083d44abbfa409c9f5aa288f4
Reviewed: 11 October 2026

## Summary

This review read the code in SempaiHQ_app and the packages it depends on.

The most serious thing it confirmed is a known defect in crypto-js 3.3.0.

| | High | Medium | Low | Info |
| --- | --- | --- | --- | --- |
| Your code | 1 | 6 | 25 | 0 |
| Packages | 32 | 17 | 3 | 0 |

## What was reviewed

Every part below was read by the same checks. A part with nothing against it had nothing to report, which is not the same as nothing to read.

| Part | Where |
| --- | --- |
| Android | android |
| JavaScript and TypeScript | dapp-store, the repository root |

Files read: 607

Checks that ran and finished:

- Patterns in the source code that are known to be unsafe
- Known vulnerabilities in the packages this project depends on
- Credentials committed to the repository
- Server and deployment configuration

## Fix first

- crypto-js 3.3.0 (Critical) in dapp-store/pnpm-lock.yaml:1067
- fast-xml-parser 5.2.5 (Critical) in dapp-store/pnpm-lock.yaml:1222
- form-data 4.0.0 (Critical) in dapp-store/pnpm-lock.yaml:1257
- shell-quote 1.8.3 (Critical) in package-lock.json:18312
- tar 7.4.3 (Critical) in package-lock.json:18836

## Your code

Nothing was confirmed as a defect in the code that was reviewed.

### Worth a look

Each of these matched a pattern that is sometimes a real problem. None has been verified. Read the code before acting on any of them.

### 1. The app is asking the user to type a seed phrase.

Severity: High
Location: screens/WalletMigrationScreen.js:200

What is wrong: A dapp never needs one, and training users to enter it is exactly the behaviour phishing relies on. Connect a wallet instead.

```
            <View style={styles.migrationForm}>
              <Text style={styles.formTitle}>Seed Phrase Migration</Text>
              <Text style={styles.formDescription}>
                Convert your seed phrase to a private key for secure storage
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Seed Phrase</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your 12 or 24 word seed phrase"
                  placeholderTextColor="#888"
                  value={seedPhrase}
                  onChangeText={setSeedPhrase}
                  multiline
                  numberOfLines={4}
```

### 2. A third-party action is referenced by a moving tag rather than a commit SHA.

Severity: Medium
Location: .github/workflows/release-apk.yml:20

What is wrong: Tags can be repointed, so the code running in this workflow, with its token and secrets, can change without any change here. Pin the action to a full commit SHA.

Why it matters: An attacker who compromises or re-tags a referenced action can inject code into the release pipeline that handles the EAS token and build artifacts.

What to do: Pin each action to a full-length commit SHA instead of a floating version tag.

```
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm install
      - name: Set up EAS CLI
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EAS_TOKEN }}
      - name: Build APK
        id: eas_build
        run: |
          eas build --platform android --profile dapp-store --non-interactive --json > build-output.json || { echo "Build failed"; cat build-output.json; exit 1; }
```

### 3. android:usesCleartextTraffic is true, so the app may talk plain http.

Severity: Medium
Location: android/app/src/main/AndroidManifest.xml:19

What is wrong: Anyone on the network path can read and rewrite that traffic, including RPC responses the app acts on.

Why it matters: A network attacker on the same path can read or rewrite any cleartext HTTP traffic the app makes, including tokens or balances.

What to do: Set usesCleartextTraffic="false" and enforce HTTPS via a network security config.

```
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
  <queries>
    <intent>
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="https"/>
    </intent>
  </queries>
  <application android:name=".MainApplication" android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" android:allowBackup="true" android:theme="@style/AppTheme" android:supportsRtl="true" android:usesCleartextTraffic="true">
    <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/notification_icon_color"/>
    <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/notification_icon"/>
    <meta-data android:name="expo.modules.notifications.default_notification_color" android:resource="@color/notification_icon_color"/>
    <meta-data android:name="expo.modules.notifications.default_notification_icon" android:resource="@drawable/notification_icon"/>
    <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
    <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
```

### 4. android:allowBackup is true, so the app's private files are copied into device backups.

Severity: Medium
Location: android/app/src/main/AndroidManifest.xml:19

What is wrong: Anything stored locally, including a wallet file, leaves the device with the backup.

Why it matters: An attacker with physical/ADB access can back up and read the app's private data store, exposing credentials or keys.

What to do: Set android:allowBackup="false" (and configure fullBackupContent exclusions) to prevent data extraction.

```
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
  <queries>
    <intent>
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="https"/>
    </intent>
  </queries>
  <application android:name=".MainApplication" android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" android:allowBackup="true" android:theme="@style/AppTheme" android:supportsRtl="true" android:usesCleartextTraffic="true">
    <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/notification_icon_color"/>
    <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/notification_icon"/>
    <meta-data android:name="expo.modules.notifications.default_notification_color" android:resource="@color/notification_icon_color"/>
    <meta-data android:name="expo.modules.notifications.default_notification_icon" android:resource="@drawable/notification_icon"/>
    <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
    <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
```

### 5. An exported component has no permission on it, so any app on the device can start it.

Severity: Medium
Location: android/app/src/main/AndroidManifest.xml:29

What is wrong: If it handles wallet actions or deep links, that is a way in.

```
    <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/notification_icon"/>
    <meta-data android:name="expo.modules.notifications.default_notification_color" android:resource="@color/notification_icon_color"/>
    <meta-data android:name="expo.modules.notifications.default_notification_icon" android:resource="@drawable/notification_icon"/>
    <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
    <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS" android:value="0"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="https://u.expo.dev/d5eca5d1-6fe0-4d21-ae79-dfd681139dd8"/>
    <activity android:name=".MainActivity" android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode" android:launchMode="singleTask" android:windowSoftInputMode="adjustResize" android:theme="@style/Theme.App.SplashScreen" android:exported="true" android:screenOrientation="portrait">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
      <intent-filter>
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.DEFAULT"/>
```

### 6. A URL built from request data is fetched by the server, so a caller can aim this process at an address of their choosing, including internal ones it can reach and they cannot.

Severity: Medium
Location: screens/ChapterScreen.js:1854

What is wrong: Resolve the target against an allowlist first.

```
          if (!accessToken) {
            console.warn('[processChapterPayment] No access token available');
          } else {
            const supabaseUrl = 'https://xqeimsncmnqsiowftdmz.supabase.co';
            const functionUrl = `${supabaseUrl}/functions/v1/unlock-chapter`;

            console.log('[processChapterPayment] Calling edge function at:', functionUrl);

            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify(requestBody),
            });
```

### 7. A URL built from request data is fetched by the server, so a caller can aim this process at an address of their choosing, including internal ones it can reach and they cannot.

Severity: Medium
Location: screens/CreatorsProfileScreen.js:387

What is wrong: Resolve the target against an allowlist first.

```
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const planType = selectedBadge.type || 'blue';

      const response = await fetch('https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/benefactor-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          writerId: id,
```

### 8. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: checkSmpAta.js:5

What is wrong: New work should use @solana/kit.

```
// checkSmpAta.js
// Usage: node checkSmpAta.js <walletAddress> <mintAddress>
// Example: node checkSmpAta.js A6jwr4omFrFhLKrjc2fi9djmt6kay2iKt4oQytNKaBsN SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor

const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');

async function main() {
  const walletAddress = process.argv[2];
  const mintAddress = process.argv[3];
  if (!walletAddress || !mintAddress) {
    console.log('Usage: node checkSmpAta.js <walletAddress> <mintAddress>');
    process.exit(1);
  }

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
```

### 9. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: components/BalanceModal.js:14

What is wrong: New work should use @solana/kit.

```
  ScrollView,
  ActivityIndicator,
  Clipboard,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import Modal from 'react-native-modal';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {
  AMETHYST_MINT_ADDRESS,
  SMP_MINT_ADDRESS,
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
```

### 10. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: components/Comments/CommentSection.js:13

What is wrong: New work should use @solana/kit.

```
  TextInput,
  TouchableOpacity,
  FlatList,
  Animated,
  StyleSheet,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import { EmbeddedWalletContext } from '../../components/ConnectButtonEnhanced';
import { AMETHYST_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../../constants';

const connection = new Connection(RPC_URL, 'confirmed');

// Kaito Adventure Design System
```

### 11. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: components/Comments/NovelCommentSection.js:14

What is wrong: New work should use @solana/kit.

```
  TouchableOpacity,
  FlatList,
  Animated,
  StyleSheet,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { isErrorNetworkError } from '../../services/offlineCache';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import { EmbeddedWalletContext } from '../../components/ConnectButtonEnhanced';
import { useGoogleAuth } from '../../components/GoogleAuthProvider';
import { useTheme } from '../../context/ThemeContext';
import { AMETHYST_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../../constants';
```

### 12. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: components/ConnectButton.js:6

What is wrong: New work should use @solana/kit.

```
import React, { useState, useCallback, useEffect, useContext, createContext } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, TextInput, Clipboard, ToastAndroid, ActivityIndicator } from 'react-native';
import Modal from 'react-native-modal';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as solanaWeb3 from '@solana/web3.js';
import * as Crypto from 'expo-crypto';
import bs58 from 'bs58';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { RPC_URL } from '../constants';
import { styles } from '../styles/ConnectButtonStyles';
import TokenClaimModal from './TokenClaimModal';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
```

### 13. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: components/ConnectButtonEnhanced.js:6

What is wrong: New work should use @solana/kit.

```
import React, { useState, useCallback, useEffect, useContext, createContext } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, TextInput, Clipboard, ToastAndroid, ActivityIndicator, ScrollView, Animated } from 'react-native';
import Modal from 'react-native-modal';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as solanaWeb3 from '@solana/web3.js';
import * as Crypto from 'expo-crypto';
import bs58 from 'bs58';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { RPC_URL } from '../constants';
import { styles } from '../styles/ConnectButtonStyles';
import TokenClaimModal from './TokenClaimModal';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
```

### 14. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: components/MangaCommentSection.js:13

What is wrong: New work should use @solana/kit.

```
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';
import { supabase } from '../services/supabaseClient';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import { FontAwesome5 } from '@expo/vector-icons';
import { AMETHYST_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../constants';

const connection = new Connection(RPC_URL, 'confirmed');

// Kaito Adventure Design System
```

### 15. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: components/MangaDetailCommentSection.js:13

What is wrong: New work should use @solana/kit.

```
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';
import { supabase } from '../services/supabaseClient';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import { FontAwesome5 } from '@expo/vector-icons';
import { AMETHYST_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../constants';

const connection = new Connection(RPC_URL, 'confirmed');

// Kaito Adventure Design System
```

### 16. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: components/SendModal.js:14

What is wrong: New work should use @solana/kit.

```
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import Modal from 'react-native-modal';
import { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import Icon from 'react-native-vector-icons/FontAwesome5';
```

### 17. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: components/TreasuryBalance.js:3

What is wrong: New work should use @solana/kit.

```
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { AMETHYST_MINT_ADDRESS, SMP_MINT_ADDRESS, RPC_URL } from '../constants';

const TREASURY_WALLET = 'HSxUYwGM3NFzDmeEJ6o4bhyn8knmQmq7PLUZ6nZs4F58';

const TreasuryBalance = () => {
  const [amethystBalance, setAmethystBalance] = useState(null);
  const [smpBalance, setSmpBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
```

### 18. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: constants.js:1

What is wrong: New work should use @solana/kit.

```
import { PublicKey, Keypair } from '@solana/web3.js';

// Handle bs58 import for ESM compatibility
let bs58;
try {
  bs58 = require('bs58');
} catch (error) {
  console.warn('[constants.js] Failed to load bs58 with require, trying import:', error.message);
  import('bs58').then(module => {
    bs58 = module.default;
  }).catch(err => {
    console.error('[constants.js] Failed to load bs58:', err.message);
  });
}

// Treasury wallet configuration
```

### 19. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: screens/BadgesScreen.js:21

What is wrong: New work should use @solana/kit.

```
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getBadgesStyles } from '../styles/BadgesStyles';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token';
import {
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
  RPC_URL,
  USDC_DECIMALS,
  SKR_DECIMALS,
```

### 20. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: screens/ChapterScreen.js:26

What is wrong: New work should use @solana/kit.

```
  TextInput,
} from 'react-native';
import { Video } from 'expo-av';
import Tts from 'react-native-tts';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { getNovel, getNovelChapters, isErrorNetworkError } from '../services/offlineCache';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, createTransferInstruction, createBurnInstruction } from '@solana/spl-token';
import {
  RPC_URL,
  FALLBACK_RPC_URL,
  SMP_MINT_ADDRESS,
```

### 21. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: screens/CreatorsProfileScreen.js:24

What is wrong: New work should use @solana/kit.

```
import { useNavigation, useRoute } from '@react-navigation/native';
import Modal from 'react-native-modal';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { getProfileStyles } from '../styles/ProfileStyles';
import UBBadge from '../components/UBBadge';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token';
import {
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
  RPC_URL,
  USDC_DECIMALS,
  SKR_DECIMALS,
```

### 22. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: screens/EditProfileScreen.js:21

What is wrong: New work should use @solana/kit.

```
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { supabase } from '../services/supabaseClient';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import { AMETHYST_MINT_ADDRESS, SMP_DECIMALS, RPC_URL } from '../constants';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { formatNumber } from '../utils/formatNumber';
```

### 23. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: screens/MangaChapterScreen.js:20

What is wrong: New work should use @solana/kit.

```
  StatusBar,
  SafeAreaView,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { formatNumber } from '../utils/formatNumber';
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
```

### 24. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: screens/MangaDetailScreen.js:20

What is wrong: New work should use @solana/kit.

```
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import ConnectButton from '../components/ConnectButtonEnhanced';
import Animated, { FadeIn } from 'react-native-reanimated';
import MangaDetailCommentSection from '../components/MangaDetailCommentSection';
import { styles } from '../styles/MangaDetailStyles';
import { PublicKey } from '@solana/web3.js';

const MangaDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params || {};
  const walletContext = React.useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
```

### 25. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: screens/NovelsPageScreen.js:21

What is wrong: New work should use @solana/kit.

```
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import ConnectButton, { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import WalletPanel from '../components/WalletPanel';
import { PublicKey } from '@solana/web3.js';
import { TREASURY_PUBLIC_KEY, SMP_MINT_ADDRESS } from '../constants';
import { fetchSmpTokenBalance } from '../utils/solana';
import { useTheme } from '../context/ThemeContext';
import { getNovelsStyles } from '../styles/NovelsStyles';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;
```

### 26. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: screens/StatPageScreen.js:13

What is wrong: New work should use @solana/kit.

```
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getAccount } from '@solana/spl-token';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
```

### 27. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: screens/SwapScreen.js:18

What is wrong: New work should use @solana/kit.

```
  Image,
  ScrollView,
  Linking,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Modal from 'react-native-modal';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import JupiterSwapWebView from '../components/JupiterSwapWebView';
import { AMETHYST_MINT_ADDRESS, SMP_MINT_ADDRESS, USDC_MINT_ADDRESS, SKR_MINT_ADDRESS, RPC_URL, WEB_API_BASE_URL } from '../constants';
import { AnimatedPressable, useCountUp, usePulse, useEntrance, useAnimatedVisibility, useStaggeredEntrance } from '../utils/animations';
```

### 28. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: screens/WalletScreen.js:16

What is wrong: New work should use @solana/kit.

```
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddressSync, unpackAccount, getAccount, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Modal from 'react-native-modal';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { USDC_MINT_ADDRESS, SMP_MINT_ADDRESS, SKR_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../constants';
import { styles } from '../styles/SwapStyles';
```

### 29. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: services/externalWalletService.js:2

What is wrong: New work should use @solana/kit.

```
import { Platform, Linking } from 'react-native';
import { PublicKey, Transaction } from '@solana/web3.js';

const API_BASE_URL = 'https://sempaihq.com/api';

/**
 * External wallet service for connecting to Phantom, Solflare, and other mobile wallets
 * Supports deep linking to mobile wallet apps
 */

const WALLET_DEEP_LINKS = {
  phantom: {
    ios: 'phantom://',
    android: 'phantom://',
    web: 'https://phantom.app/ul/v1/'
  },
```

### 30. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: services/metaplexService.js:1

What is wrong: New work should use @solana/kit.

```
import { PublicKey, Connection, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { 
  createCreateNftInstruction,
  createCreateMasterEditionV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID
} from '@solana/spl-token';
import { RPC_URL } from '../constants';

/**
 * Metaplex service for NFT minting and management
 * Simplified version for mobile app using API endpoints
 */

const API_BASE_URL = 'https://sempaihq.com/api';

/**
```

### 31. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: utils/cryptoUtils.js:1

What is wrong: New work should use @solana/kit.

```
import * as solanaWeb3 from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { Platform } from 'react-native';

// Key for storing the wallet private key securely
const WALLET_PRIVATE_KEY = 'WALLET_PRIVATE_KEY';

// Generate a new Solana wallet keypair
export const generateWalletKeypair = async () => {
  try {
    // Generate a new Solana keypair
    const keypair = solanaWeb3.Keypair.generate();
    const publicKey = keypair.publicKey.toString();
```

### 32. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: utils/solana.js:1

What is wrong: New work should use @solana/kit.

```
import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { SMP_MINT_ADDRESS, RPC_URL, FALLBACK_RPC_URL, SMP_DECIMALS, LAMPORTS_PER_SOL } from '../constants';

/**
 * Create a Connection with fallback logic
 * @param {string} commitment - Commitment level
 * @returns {Connection} Connection instance
 */
export function createConnectionWithFallback(commitment = 'confirmed') {
  return new Connection(RPC_URL, commitment, {
    confirmTransactionInitialTimeout: 60000,
  });
}

/**
```

## Packages

| Package | Comes in through | Ships to users | Fixed in | Worst | Advisories |
| --- | --- | --- | --- | --- | --- |
| crypto-js 3.3.0 | direct | yes | 4.2.0 | Critical | 2 |
| fast-xml-parser 5.2.5 | direct | yes | 4.5.4 | Critical | 7 |
| form-data 4.0.0 | direct | yes | 2.5.4 | Critical | 2 |
| shell-quote 1.8.3 | @react-native-async-storage/async-storage, @react-native-community/datetimepicker | yes | 1.8.4 | Critical | 2 |
| tar 7.4.3 | @react-native-community/datetimepicker, @react-native-google-signin/google-signin | yes | 7.5.21 | Critical | 12 |
| tar 6.2.1 | @react-native-community/datetimepicker, @react-native-google-signin/google-signin | yes | 7.5.7 | Critical | 12 |
| @solana/web3.js 1.68.0 | direct | yes | 1.0.1 | High | 2 |
| form-data 4.0.4 | direct | yes | 2.5.6 | High | 2 |
| image-size 1.2.1 | direct | yes | 2.0.3 | High | 2 |
| js-yaml 3.14.1 | direct | yes | 3.15.1 | High | 5 |
| lodash 4.17.21 | direct | yes | 4.18.0 | High | 2 |
| picomatch 2.3.1 | direct | yes | 2.3.2 | High | 2 |
| tmp 0.2.5 | direct | yes | 0.2.6 | High | 2 |
| ws 8.18.0 | direct | yes | 8.20.1 | High | 2 |
| ws 8.18.3 | direct | yes | 8.20.1 | High | 2 |
| axios 0.27.2 | direct | yes | 0.31.0 | High | 23 |
| axios 1.1.3 | direct | yes | 0.31.1 | High | 29 |
| minimatch 9.0.5 | @react-native-async-storage/async-storage, @react-native-community/datetimepicker | yes | 3.1.3 | High | 3 |
| ws 7.5.10 | direct | yes | 5.2.5 | High | 2 |
| @babel/plugin-transform-modules-systemjs 7.27.1 | @react-native-async-storage/async-storage, @react-native-community/datetimepicker | yes | 7.29.4 | High | 2 |
| minimatch 3.1.2 | @react-native-async-storage/async-storage, @react-native-community/datetimepicker | yes | 3.1.3 | High | 3 |
| nanoid 3.3.11 | @react-native-community/datetimepicker, @react-native-google-signin/google-signin | yes | 3.3.18 | High | 3 |
| postcss 8.4.49 | @react-native-community/datetimepicker, @react-native-google-signin/google-signin | yes | 8.5.10 | High | 4 |
| undici 6.21.3 | @react-native-community/datetimepicker, @react-native-google-signin/google-signin | yes | 6.28.0 | High | 15 |
| @xmldom/xmldom 0.7.13 | @expo/plist, @react-native-community/datetimepicker | yes | 0.8.14 | High | 15 |
| js-yaml 4.1.0 | direct | yes | 3.14.2 | High | 5 |
| ws 6.2.3 | direct | yes | 5.2.5 | High | 2 |
| @xmldom/xmldom 0.8.10 | @expo/plist, @react-native-community/datetimepicker | yes | 0.8.15 | High | 15 |
| axios 1.11.0 | direct | yes | 0.31.0 | High | 29 |
| axios 1.9.0 | direct | yes | 0.31.1 | High | 29 |
| brace-expansion 2.0.2 | @react-native-async-storage/async-storage, @react-native-community/datetimepicker | yes | 1.1.16 | High | 4 |
| minimatch 8.0.4 | @react-native-async-storage/async-storage, @react-native-community/datetimepicker | yes | 3.1.3 | High | 3 |
| bigint-buffer 1.1.5 | direct | yes | no fix yet | High | 2 |
| brace-expansion 1.1.12 | @react-native-async-storage/async-storage, @react-native-community/datetimepicker | yes | 1.1.13 | High | 4 |
| browserslist 4.25.0 | @babel/core, @react-native-async-storage/async-storage | yes | 4.28.7 | High | 2 |
| fast-uri 3.0.6 | direct | yes | 2.4.1 | High | 8 |
| fast-uri 3.1.0 | direct | yes | 2.4.3 | High | 8 |
| A transaction deserialized from a deep link or a remote response is signed or sent without being rebuilt locally, so whoever supplied those bytes chose the instructions this wallet approves. | direct | unknown | unknown | High | 1 |
| csv-parse 4.16.3 | direct | yes | 7.0.2 | Medium | 2 |
| follow-redirects 1.15.11 | direct | yes | 1.16.0 | Medium | 2 |
| stream-json 1.9.1 | direct | yes | 3.5.0 | Medium | 2 |
| ajv 8.17.1 | direct | yes | 6.14.0 | Medium | 2 |
| bn.js 4.11.6 | direct | yes | 4.12.3 | Medium | 2 |
| follow-redirects 1.15.9 | direct | yes | 1.16.0 | Medium | 2 |
| uuid 9.0.1 | direct | yes | 11.1.1 | Medium | 3 |
| uuid 8.3.2 | direct | yes | 11.1.1 | Medium | 3 |
| uuid 7.0.3 | direct | yes | 11.1.1 | Medium | 3 |
| bn.js 5.2.2 | direct | yes | 4.12.3 | Medium | 2 |
| bn.js 5.2.1 | direct | yes | 4.12.3 | Medium | 2 |
| bn.js 4.12.2 | direct | yes | 4.12.3 | Medium | 2 |
| decode-uri-component 0.2.2 | @react-navigation/native, @react-navigation/stack | yes | 0.5.0 | Medium | 2 |
| ajv 8.11.0 | direct | yes | 6.14.0 | Medium | 2 |
| dompurify 3.2.6 | direct | yes | 3.4.12 | Medium | 19 |
| Key material is being passed to a logger. | direct | unknown | unknown | Medium | 1 |
| Key material is being passed to a logger. | direct | unknown | unknown | Medium | 1 |
| @smithy/config-resolver 4.1.5 | direct | yes | 4.4.0 | Low | 1 |
| elliptic 6.6.1 | direct | yes | no fix yet | Low | 2 |
| @babel/core 7.27.4 | direct | no | 7.29.6 | Low | 2 |

### 1. crypto-js 3.3.0: 2 known advisories

Severity: Critical
Location: dapp-store/pnpm-lock.yaml:1067

What is wrong: crypto-js 3.3.0 is affected by 2 published advisories: CVE-2023-46233 (critical), CVE-2026-71851 (critical). Upgrading the package to a fixed version addresses all of them.

```
  crypto-js@3.3.0:
```

### 2. fast-xml-parser 5.2.5: 7 known advisories

Severity: Critical
Location: dapp-store/pnpm-lock.yaml:1222

What is wrong: fast-xml-parser 5.2.5 is affected by 7 published advisories: CVE-2026-25896 (critical), CVE-2026-25128 (high), CVE-2026-26278 (high), CVE-2026-33036 (high), CVE-2026-33349 (medium), CVE-2026-41650 (medium), CVE-2026-27942 (low). Upgrading the package to a fixed version addresses all of them.

```
  fast-xml-parser@5.2.5:
```

### 3. form-data 4.0.0: 2 known advisories

Severity: Critical
Locations: 2
- dapp-store/pnpm-lock.yaml:1257
- package-lock.json:2431

What is wrong: form-data 4.0.0 is affected by 2 published advisories: CVE-2025-7783 (critical), CVE-2026-12143 (high). Upgrading the package to a fixed version addresses all of them.

```
  form-data@4.0.0:
```

### 4. shell-quote 1.8.3: 2 known advisories

Severity: Critical
Location: package-lock.json:18312

What is wrong: shell-quote 1.8.3 is affected by 2 published advisories: CVE-2026-9277 (critical), CVE-2026-13311 (high). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/shell-quote": {
      "version": "1.8.3",
```

### 5. tar 7.4.3: 12 known advisories

Severity: Critical
Location: package-lock.json:18836

What is wrong: tar 7.4.3 is affected by 12 published advisories: CVE-2026-59873 (critical), CVE-2026-23745 (high), CVE-2026-23950 (high), CVE-2026-24842 (high), CVE-2026-26960 (high), CVE-2026-29786 (high), CVE-2026-31802 (high), CVE-2026-59874 (high), CVE-2026-73566 (high), CVE-2026-53655 (medium), CVE-2026-59871 (medium), CVE-2026-59875 (medium). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/supabase/node_modules/tar": {
      "version": "7.4.3",
```

### 6. tar 6.2.1: 12 known advisories

Severity: Critical
Location: package-lock.json:18926

What is wrong: tar 6.2.1 is affected by 12 published advisories: CVE-2026-59873 (critical), CVE-2026-23745 (high), CVE-2026-23950 (high), CVE-2026-24842 (high), CVE-2026-26960 (high), CVE-2026-29786 (high), CVE-2026-31802 (high), CVE-2026-59874 (high), CVE-2026-73566 (high), CVE-2026-53655 (medium), CVE-2026-59871 (medium), CVE-2026-59875 (medium). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/tar": {
      "version": "6.2.1",
```

### 7. @solana/web3.js 1.68.0: Handling untrusted input can result in a crash, leading to loss of availability / denial of service

Severity: High
Location: dapp-store/pnpm-lock.yaml:1

What is wrong: @solana/web3.js 1.68.0 is affected by GHSA-8m45-2rjm-j347. Handling untrusted input can result in a crash, leading to loss of availability / denial of service Also known as CVE-2024-30253. Severity rated high by the advisory database. Fixed in 1.0.1.

```
lockfileVersion: '9.0'
```

### 8. form-data 4.0.4: CRLF injection in form-data via unescaped multipart field names and filenames

Severity: High
Locations: 2
- dapp-store/pnpm-lock.yaml:1257
- package-lock.json:10062

What is wrong: form-data 4.0.4 is affected by GHSA-hmw2-7cc7-3qxx. form-data: CRLF injection in form-data via unescaped multipart field names and filenames Also known as CVE-2026-12143. Severity rated high by the advisory database. Fixed in 2.5.6.

```
  form-data@4.0.0:
```

### 9. image-size 1.2.1: 2 known advisories

Severity: High
Locations: 2
- dapp-store/pnpm-lock.yaml:1374
- package-lock.json:10560

What is wrong: image-size 1.2.1 is affected by 2 published advisories: CVE-2025-71329 (high), CVE-2025-71330 (high). Upgrading the package to a fixed version addresses all of them.

```
  image-size@1.2.1:
```

### 10. js-yaml 3.14.1: 5 known advisories

Severity: High
Locations: 2
- dapp-store/pnpm-lock.yaml:1495
- package-lock.json:3170

What is wrong: js-yaml 3.14.1 is affected by 5 published advisories: CVE-2026-59869 (high), CVE-2026-84375 (high), GHSA-5p4m-2wfm-xmqj (high), CVE-2025-64718 (medium), CVE-2026-53550 (medium). Upgrading the package to a fixed version addresses all of them.

```
  js-yaml@4.1.0:
```

### 11. lodash 4.17.21: 2 known advisories

Severity: High
Locations: 2
- dapp-store/pnpm-lock.yaml:1533
- package-lock.json:14964

What is wrong: lodash 4.17.21 is affected by 2 published advisories: CVE-2021-23337 (high), CVE-2025-13465 (medium). Upgrading the package to a fixed version addresses all of them.

```
  lodash@4.17.21:
```

### 12. picomatch 2.3.1: 2 known advisories

Severity: High
Locations: 2
- dapp-store/pnpm-lock.yaml:1676
- package-lock.json:6703

What is wrong: picomatch 2.3.1 is affected by 2 published advisories: CVE-2026-33671 (high), CVE-2026-33672 (medium). Upgrading the package to a fixed version addresses all of them.

```
  picomatch@2.3.1:
```

### 13. tmp 0.2.5 has Path Traversal via unsanitized prefix/postfix that enables directory escape

Severity: High
Location: dapp-store/pnpm-lock.yaml:1874

What is wrong: tmp 0.2.5 is affected by GHSA-ph9p-34f9-6g65. tmp has Path Traversal via unsanitized prefix/postfix that enables directory escape Also known as CVE-2026-44705. Severity rated high by the advisory database. Fixed in 0.2.6.

```
  tmp@0.2.5:
```

### 14. ws 8.18.0: 2 known advisories

Severity: High
Locations: 2
- dapp-store/pnpm-lock.yaml:1998
- package-lock.json:5392

What is wrong: ws 8.18.0 is affected by 2 published advisories: CVE-2026-48779 (high), CVE-2026-45736 (medium). Upgrading the package to a fixed version addresses all of them.

```
  ws@7.5.10:
```

### 15. ws 8.18.3: 2 known advisories

Severity: High
Locations: 2
- dapp-store/pnpm-lock.yaml:1998
- package-lock.json:5392

What is wrong: ws 8.18.3 is affected by 2 published advisories: CVE-2026-48779 (high), CVE-2026-45736 (medium). Upgrading the package to a fixed version addresses all of them.

```
  ws@7.5.10:
```

### 16. axios 0.27.2: 23 known advisories

Severity: High
Locations: 2
- dapp-store/pnpm-lock.yaml:852
- package-lock.json:6803

What is wrong: axios 0.27.2 is affected by 23 published advisories: CVE-2025-27152 (high), CVE-2026-25639 (high), CVE-2026-42033 (high), CVE-2026-42035 (high), CVE-2026-42043 (high), CVE-2026-44486 (high), CVE-2026-44487 (high), CVE-2026-44492 (high), CVE-2026-44495 (high), CVE-2026-44496 (high), CVE-2023-45857 (medium), CVE-2025-62718 (medium), CVE-2026-40175 (medium), CVE-2026-42034 (medium), CVE-2026-42036 (medium), CVE-2026-42038 (medium), CVE-2026-42039 (medium), CVE-2026-42041...

```
  axios@0.27.2:
```

### 17. axios 1.1.3: 29 known advisories

Severity: High
Locations: 2
- dapp-store/pnpm-lock.yaml:852
- package-lock.json:6803

What is wrong: axios 1.1.3 is affected by 29 published advisories: CVE-2025-27152 (high), CVE-2025-58754 (high), CVE-2026-25639 (high), CVE-2026-42033 (high), CVE-2026-42035 (high), CVE-2026-42043 (high), CVE-2026-42264 (high), CVE-2026-44486 (high), CVE-2026-44487 (high), CVE-2026-44494 (high), CVE-2026-44495 (high), CVE-2026-44496 (high), CVE-2023-45857 (medium), CVE-2025-62718 (medium), CVE-2026-40175 (medium), CVE-2026-42034 (medium), CVE-2026-42036 (medium), CVE-2026-42037 (medium),...

```
  axios@0.27.2:
```

### 18. minimatch 9.0.5: 3 known advisories

Severity: High
Location: package-lock.json:10291

What is wrong: minimatch 9.0.5 is affected by 3 published advisories: CVE-2026-26996 (high), CVE-2026-27903 (high), CVE-2026-27904 (high). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/glob/node_modules/minimatch": {
      "version": "9.0.5",
```

### 19. ws 7.5.10: Memory exhaustion DoS from tiny fragments and data chunks

Severity: High
Locations: 2
- package-lock.json:11216
- dapp-store/pnpm-lock.yaml:1998

What is wrong: ws 7.5.10 is affected by GHSA-96hv-2xvq-fx4p. ws: Memory exhaustion DoS from tiny fragments and data chunks Also known as CVE-2026-48779. Severity rated high by the advisory database. Fixed in 5.2.5.

```
    "node_modules/jayson/node_modules/ws": {
      "version": "7.5.10",
```

### 20. @babel/plugin-transform-modules-systemjs 7.27.1 generates arbitrary code when compiling malicious input

Severity: High
Location: package-lock.json:1444

What is wrong: @babel/plugin-transform-modules-systemjs 7.27.1 is affected by GHSA-fv7c-fp4j-7gwp. @babel/plugin-transform-modules-systemjs generates arbitrary code when compiling malicious input Also known as CVE-2026-44728. Severity rated high by the advisory database. Fixed in 7.29.4. It comes in through @react-native-async-storage/async-storage, @react-native-community/datetimepicker, @react-native-community/masked-view, so that is what to upgrade.

```
    "node_modules/@babel/plugin-transform-modules-systemjs": {
      "version": "7.27.1",
```

### 21. minimatch 3.1.2: 3 known advisories

Severity: High
Location: package-lock.json:15628

What is wrong: minimatch 3.1.2 is affected by 3 published advisories: CVE-2026-26996 (high), CVE-2026-27903 (high), CVE-2026-27904 (high). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/minimatch": {
      "version": "3.1.2",
```

### 22. nanoid 3.3.11: 3 known advisories

Severity: High
Location: package-lock.json:15790

What is wrong: nanoid 3.3.11 is affected by 3 published advisories: CVE-2026-67213 (high), CVE-2026-67214 (high), CVE-2026-73086 (high). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/nanoid": {
      "version": "3.3.11",
```

### 23. postcss 8.4.49: 4 known advisories

Severity: High
Location: package-lock.json:16664

What is wrong: postcss 8.4.49 is affected by 4 published advisories: CVE-2026-45623 (high), CVE-2026-73646 (high), CVE-2026-41305 (medium), CVE-2026-69153 (medium). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/postcss": {
      "version": "8.4.49",
```

### 24. undici 6.21.3: 15 known advisories

Severity: High
Location: package-lock.json:19310

What is wrong: undici 6.21.3 is affected by 15 published advisories: CVE-2026-12151 (high), CVE-2026-1526 (high), CVE-2026-1528 (high), CVE-2026-19534 (high), CVE-2026-2229 (high), CVE-2026-15157 (medium), CVE-2026-1525 (medium), CVE-2026-1527 (medium), CVE-2026-16728 (medium), CVE-2026-16729 (medium), CVE-2026-22036 (medium), CVE-2026-9679 (medium), CVE-2026-11525 (low), CVE-2026-18540 (low), CVE-2026-6733 (low). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/undici": {
      "version": "6.21.3",
```

### 25. @xmldom/xmldom 0.7.13: 15 known advisories

Severity: High
Location: package-lock.json:2880

What is wrong: @xmldom/xmldom 0.7.13 is affected by 15 published advisories: CVE-2026-34601 (high), CVE-2026-41672 (high), CVE-2026-41673 (high), CVE-2026-41674 (high), CVE-2026-41675 (high), CVE-2026-83605 (high), CVE-2026-83607 (high), CVE-2026-83608 (high), CVE-2026-83613 (high), CVE-2026-83614 (high), CVE-2026-83615 (high), CVE-2026-83616 (high), CVE-2026-83619 (high), CVE-2026-83610 (medium), CVE-2026-83611 (medium). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/@expo/plist/node_modules/@xmldom/xmldom": {
      "version": "0.7.13",
```

### 26. js-yaml 4.1.0: 5 known advisories

Severity: High
Locations: 2
- package-lock.json:3170
- dapp-store/pnpm-lock.yaml:1495

What is wrong: js-yaml 4.1.0 is affected by 5 published advisories: CVE-2026-59869 (high), CVE-2026-84375 (high), GHSA-5p4m-2wfm-xmqj (high), CVE-2025-64718 (medium), CVE-2026-53550 (medium). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/@istanbuljs/load-nyc-config/node_modules/js-yaml": {
      "version": "3.14.1",
```

### 27. ws 6.2.3: Memory exhaustion DoS from tiny fragments and data chunks

Severity: High
Locations: 2
- package-lock.json:5392
- dapp-store/pnpm-lock.yaml:1998

What is wrong: ws 6.2.3 is affected by GHSA-96hv-2xvq-fx4p. ws: Memory exhaustion DoS from tiny fragments and data chunks Also known as CVE-2026-48779. Severity rated high by the advisory database. Fixed in 5.2.5.

```
    "node_modules/@react-native/dev-middleware/node_modules/ws": {
      "version": "6.2.3",
```

### 28. @xmldom/xmldom 0.8.10: 15 known advisories

Severity: High
Location: package-lock.json:6501

What is wrong: @xmldom/xmldom 0.8.10 is affected by 15 published advisories: CVE-2026-34601 (high), CVE-2026-41672 (high), CVE-2026-41673 (high), CVE-2026-41674 (high), CVE-2026-41675 (high), CVE-2026-83605 (high), CVE-2026-83607 (high), CVE-2026-83608 (high), CVE-2026-83613 (high), CVE-2026-83614 (high), CVE-2026-83615 (high), CVE-2026-83616 (high), CVE-2026-83619 (high), CVE-2026-83610 (medium), CVE-2026-83611 (medium). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/@xmldom/xmldom": {
      "version": "0.8.10",
```

### 29. axios 1.11.0: 29 known advisories

Severity: High
Locations: 2
- package-lock.json:6803
- dapp-store/pnpm-lock.yaml:852

What is wrong: axios 1.11.0 is affected by 29 published advisories: CVE-2025-58754 (high), CVE-2026-25639 (high), CVE-2026-42033 (high), CVE-2026-42035 (high), CVE-2026-42043 (high), CVE-2026-42264 (high), CVE-2026-44486 (high), CVE-2026-44487 (high), CVE-2026-44488 (high), CVE-2026-44494 (high), CVE-2026-44495 (high), CVE-2026-44496 (high), CVE-2025-62718 (medium), CVE-2026-40175 (medium), CVE-2026-42034 (medium), CVE-2026-42036 (medium), CVE-2026-42037 (medium), CVE-2026-42038 (medium),...

```
    "node_modules/axios": {
      "version": "1.9.0",
```

### 30. axios 1.9.0: 29 known advisories

Severity: High
Locations: 2
- package-lock.json:6803
- dapp-store/pnpm-lock.yaml:852

What is wrong: axios 1.9.0 is affected by 29 published advisories: CVE-2025-58754 (high), CVE-2026-25639 (high), CVE-2026-42033 (high), CVE-2026-42035 (high), CVE-2026-42043 (high), CVE-2026-42264 (high), CVE-2026-44486 (high), CVE-2026-44487 (high), CVE-2026-44488 (high), CVE-2026-44494 (high), CVE-2026-44495 (high), CVE-2026-44496 (high), CVE-2025-62718 (medium), CVE-2026-40175 (medium), CVE-2026-42034 (medium), CVE-2026-42036 (medium), CVE-2026-42037 (medium), CVE-2026-42038 (medium),...

```
    "node_modules/axios": {
      "version": "1.9.0",
```

### 31. brace-expansion 2.0.2: 4 known advisories

Severity: High
Location: package-lock.json:6889

What is wrong: brace-expansion 2.0.2 is affected by 4 published advisories: CVE-2026-13149 (high), CVE-2026-14257 (high), CVE-2026-69152 (high), CVE-2026-33750 (medium). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/babel-plugin-module-resolver/node_modules/brace-expansion": {
      "version": "2.0.2",
```

### 32. minimatch 8.0.4: 3 known advisories

Severity: High
Location: package-lock.json:6918

What is wrong: minimatch 8.0.4 is affected by 3 published advisories: CVE-2026-26996 (high), CVE-2026-27903 (high), CVE-2026-27904 (high). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/babel-plugin-module-resolver/node_modules/minimatch": {
      "version": "8.0.4",
```

### 33. bigint-buffer 1.1.5 Vulnerable to Buffer Overflow via toBigIntLE() Function

Severity: High
Locations: 2
- package-lock.json:7169
- dapp-store/pnpm-lock.yaml:877

What is wrong: bigint-buffer 1.1.5 is affected by GHSA-3gc7-fjrx-p6mg. bigint-buffer Vulnerable to Buffer Overflow via toBigIntLE() Function Also known as CVE-2025-3194. Severity rated high by the advisory database. No fixed version has been published yet.

```
    "node_modules/bigint-buffer": {
      "version": "1.1.5",
```

### 34. brace-expansion 1.1.12: 4 known advisories

Severity: High
Location: package-lock.json:7303

What is wrong: brace-expansion 1.1.12 is affected by 4 published advisories: CVE-2026-13149 (high), CVE-2026-14257 (high), CVE-2026-69152 (high), CVE-2026-33750 (medium). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/brace-expansion": {
      "version": "1.1.12",
```

### 35. browserslist 4.25.0: 2 known advisories

Severity: High
Location: package-lock.json:7325

What is wrong: browserslist 4.25.0 is affected by 2 published advisories: CVE-2026-73088 (high), CVE-2026-73089 (high). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/browserslist": {
      "version": "4.25.0",
```

### 36. fast-uri 3.0.6: 8 known advisories

Severity: High
Locations: 2
- package-lock.json:9789
- dapp-store/pnpm-lock.yaml:1219

What is wrong: fast-uri 3.0.6 is affected by 8 published advisories: CVE-2026-13676 (high), CVE-2026-16221 (high), CVE-2026-18446 (high), CVE-2026-6321 (high), CVE-2026-6322 (high), CVE-2026-75975 (high), CVE-2026-76172 (high), CVE-2026-84292 (high). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/fast-uri": {
      "version": "3.0.6",
```

### 37. fast-uri 3.1.0: 8 known advisories

Severity: High
Locations: 2
- package-lock.json:9789
- dapp-store/pnpm-lock.yaml:1219

What is wrong: fast-uri 3.1.0 is affected by 8 published advisories: CVE-2026-13676 (high), CVE-2026-16221 (high), CVE-2026-18446 (high), CVE-2026-6321 (high), CVE-2026-6322 (high), CVE-2026-75975 (high), CVE-2026-76172 (high), CVE-2026-84292 (high). Upgrading the package to a fixed version addresses all of them.

```
    "node_modules/fast-uri": {
      "version": "3.0.6",
```

### 38. A transaction deserialized from a deep link or a remote response is signed or sent without being rebuilt locally, so whoever supplied those bytes chose the instructions this wallet approves.

Severity: High
Location: supabase/functions/withdraw-smp/index.ts:115

What is wrong: Reconstruct the transaction from values the app validated.

### 39. csv-parse 4.16.3: node-csv: Prototype replacement still reachable via columns path

Severity: Medium
Location: dapp-store/pnpm-lock.yaml:1077

What is wrong: csv-parse 4.16.3 is affected by GHSA-8cw4-87c7-c6xx. node-csv: Prototype replacement still reachable via columns path Also known as CVE-2026-85063. Severity rated medium by the advisory database. Fixed in 7.0.2.

```
  csv-parse@4.16.3:
```

### 40. follow-redirects 1.15.11 leaks Custom Authentication Headers to Cross-Domain Redirect Targets

Severity: Medium
Locations: 2
- dapp-store/pnpm-lock.yaml:1240
- package-lock.json:10005

What is wrong: follow-redirects 1.15.11 is affected by GHSA-r4q5-vmmm-2653. follow-redirects leaks Custom Authentication Headers to Cross-Domain Redirect Targets Also known as CVE-2026-40895. Severity rated medium by the advisory database. Fixed in 1.16.0.

```
  follow-redirects@1.15.11:
```

### 41. stream-json 1.9.1: pick/ignore/filter/replace filters are O(depth) on nested input - small crafted JSON blocks the event loop for seconds-\>minutes (DoS)

Severity: Medium
Locations: 2
- dapp-store/pnpm-lock.yaml:1803
- package-lock.json:18534

What is wrong: stream-json 1.9.1 is affected by GHSA-528h-pc64-c93x. stream-json: pick/ignore/filter/replace filters are O(depth) on nested input - small crafted JSON blocks the event loop for seconds-minutes (DoS) Also known as CVE-2026-71429. Severity rated medium by the advisory database. Fixed in 3.5.0.

```
  stream-json@1.9.1:
```

### 42. ajv 8.17.1 has ReDoS when using \`$data\` option

Severity: Medium
Locations: 2
- dapp-store/pnpm-lock.yaml:768
- package-lock.json:6582

What is wrong: ajv 8.17.1 is affected by GHSA-2g4f-4pwh-qvx6. ajv has ReDoS when using $data option Also known as CVE-2025-69873. Severity rated medium by the advisory database. Fixed in 6.14.0.

```
  ajv@8.17.1:
```

### 43. bn.js 4.11.6 affected by an infinite loop

Severity: Medium
Locations: 2
- dapp-store/pnpm-lock.yaml:900
- package-lock.json:7241

What is wrong: bn.js 4.11.6 is affected by GHSA-378v-28hj-76wf. bn.js affected by an infinite loop Also known as CVE-2026-2739. Severity rated medium by the advisory database. Fixed in 4.12.3.

```
  bn.js@4.11.6:
```

### 44. follow-redirects 1.15.9 leaks Custom Authentication Headers to Cross-Domain Redirect Targets

Severity: Medium
Locations: 2
- package-lock.json:10005
- dapp-store/pnpm-lock.yaml:1240

What is wrong: follow-redirects 1.15.9 is affected by GHSA-r4q5-vmmm-2653. follow-redirects leaks Custom Authentication Headers to Cross-Domain Redirect Targets Also known as CVE-2026-40895. Severity rated medium by the advisory database. Fixed in 1.16.0.

```
    "node_modules/follow-redirects": {
      "version": "1.15.9",
```

### 45. uuid 9.0.1: Missing buffer bounds check in v3/v5/v6 when buf is provided

Severity: Medium
Locations: 2
- package-lock.json:19547
- dapp-store/pnpm-lock.yaml:1952

What is wrong: uuid 9.0.1 is affected by GHSA-w5hq-g745-h8pq. uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided Also known as CVE-2026-41907, CVE-2026-41988. Severity rated medium by the advisory database. Fixed in 11.1.1.

```
    "node_modules/uuid": {
      "version": "8.3.2",
```

### 46. uuid 8.3.2: Missing buffer bounds check in v3/v5/v6 when buf is provided

Severity: Medium
Locations: 2
- package-lock.json:19547
- dapp-store/pnpm-lock.yaml:1952

What is wrong: uuid 8.3.2 is affected by GHSA-w5hq-g745-h8pq. uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided Also known as CVE-2026-41907, CVE-2026-41988. Severity rated medium by the advisory database. Fixed in 11.1.1.

```
    "node_modules/uuid": {
      "version": "8.3.2",
```

### 47. uuid 7.0.3: Missing buffer bounds check in v3/v5/v6 when buf is provided

Severity: Medium
Locations: 2
- package-lock.json:19895
- dapp-store/pnpm-lock.yaml:1952

What is wrong: uuid 7.0.3 is affected by GHSA-w5hq-g745-h8pq. uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided Also known as CVE-2026-41907, CVE-2026-41988. Severity rated medium by the advisory database. Fixed in 11.1.1.

```
    "node_modules/xcode/node_modules/uuid": {
      "version": "7.0.3",
```

### 48. bn.js 5.2.2 affected by an infinite loop

Severity: Medium
Locations: 2
- package-lock.json:7241
- dapp-store/pnpm-lock.yaml:900

What is wrong: bn.js 5.2.2 is affected by GHSA-378v-28hj-76wf. bn.js affected by an infinite loop Also known as CVE-2026-2739. Severity rated medium by the advisory database. Fixed in 4.12.3.

```
    "node_modules/bn.js": {
      "version": "5.2.2",
```

### 49. bn.js 5.2.1 affected by an infinite loop

Severity: Medium
Locations: 2
- package-lock.json:7241
- dapp-store/pnpm-lock.yaml:900

What is wrong: bn.js 5.2.1 is affected by GHSA-378v-28hj-76wf. bn.js affected by an infinite loop Also known as CVE-2026-2739. Severity rated medium by the advisory database. Fixed in 4.12.3.

```
    "node_modules/bn.js": {
      "version": "5.2.2",
```

### 50. bn.js 4.12.2 affected by an infinite loop

Severity: Medium
Locations: 2
- package-lock.json:7241
- dapp-store/pnpm-lock.yaml:900

What is wrong: bn.js 4.12.2 is affected by GHSA-378v-28hj-76wf. bn.js affected by an infinite loop Also known as CVE-2026-2739. Severity rated medium by the advisory database. Fixed in 4.12.3.

```
    "node_modules/bn.js": {
      "version": "5.2.2",
```

### 51. decode-uri-component 0.2.2: Denial of service via exponential decoding of malformed percent-encoded input

Severity: Medium
Location: package-lock.json:8205

What is wrong: decode-uri-component 0.2.2 is affected by GHSA-vcc3-ghjq-m6fr. decode-uri-component: Denial of service via exponential decoding of malformed percent-encoded input Also known as CVE-2026-45822. Severity rated medium by the advisory database. Fixed in 0.5.0. It comes in through @react-navigation/native, @react-navigation/stack, expo-router, so that is what to upgrade.

```
    "node_modules/decode-uri-component": {
      "version": "0.2.2",
```

### 52. ajv 8.11.0 has ReDoS when using \`$data\` option

Severity: Medium
Locations: 2
- package-lock.json:9249
- dapp-store/pnpm-lock.yaml:768

What is wrong: ajv 8.11.0 is affected by GHSA-2g4f-4pwh-qvx6. ajv has ReDoS when using $data option Also known as CVE-2025-69873. Severity rated medium by the advisory database. Fixed in 6.14.0.

```
    "node_modules/expo-dev-launcher/node_modules/ajv": {
      "version": "8.11.0",
```

### 53. dompurify 3.2.6: 19 known advisories

Severity: Medium
Location: package.json:31

What is wrong: dompurify 3.2.6 is affected by 19 published advisories: CVE-2025-15599 (medium), CVE-2026-0540 (medium), CVE-2026-41238 (medium), CVE-2026-41239 (medium), CVE-2026-41240 (medium), CVE-2026-49458 (medium), CVE-2026-49459 (medium), CVE-2026-49978 (medium), CVE-2026-65898 (medium), CVE-2026-65902 (medium), CVE-2026-65903 (medium), CVE-2026-65912 (medium), CVE-2026-65913 (medium), CVE-2026-65914 (medium), CVE-2026-75838 (medium), CVE-2026-65899 (low), CVE-2026-65900 (low),...

```
    "dompurify": "^3.2.5",
```

### 54. Key material is being passed to a logger.

Severity: Medium
Location: supabase/functions/airdrop-function/index.ts:58

What is wrong: Logs get collected, shipped to third parties and kept far longer than anyone intends. Log the public key if you need to identify the wallet.

### 55. Key material is being passed to a logger.

Severity: Medium
Location: supabase/functions/withdraw-smp/index.ts:41

What is wrong: Logs get collected, shipped to third parties and kept far longer than anyone intends. Log the public key if you need to identify the wallet.

### 56. @smithy/config-resolver 4.1.5: AWS SDK for JavaScript v3 adopted defense in depth enhancement for region parameter value

Severity: Low
Location: dapp-store/pnpm-lock.yaml:1

What is wrong: @smithy/config-resolver 4.1.5 is affected by GHSA-6475-r3vj-m8vf. AWS SDK for JavaScript v3 adopted defense in depth enhancement for region parameter value Severity rated low by the advisory database. Fixed in 4.4.0.

```
lockfileVersion: '9.0'
```

### 57. elliptic 6.6.1 Uses a Cryptographic Primitive with a Risky Implementation

Severity: Low
Location: dapp-store/pnpm-lock.yaml:1150

What is wrong: elliptic 6.6.1 is affected by GHSA-848j-6mx2-7j84. Elliptic Uses a Cryptographic Primitive with a Risky Implementation Also known as CVE-2025-14505. Severity rated low by the advisory database. No fixed version has been published yet.

```
  elliptic@6.6.1:
```

### 58. @babel/core 7.27.4: Arbitrary File Read via sourceMappingURL Comment

Severity: Low
Location: package.json:96

What is wrong: @babel/core 7.27.4 is affected by GHSA-4x5r-pxfx-6jf8. @babel/core: Arbitrary File Read via sourceMappingURL Comment Also known as CVE-2026-49356. Severity rated low by the advisory database. Fixed in 7.29.6. This is a development dependency and does not ship to users.

```
    "@babel/core": "^7.24.0",
```
