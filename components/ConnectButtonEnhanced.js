import React, { useState, useCallback, useEffect, useContext, createContext, useMemo } from 'react';
import { View, Text, TouchableOpacity, Platform, TextInput, Clipboard, ToastAndroid, ActivityIndicator, ScrollView, Animated } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as solanaWeb3 from '@solana/web3.js';
import * as Crypto from 'expo-crypto';
import bs58 from 'bs58';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { RPC_URL } from '../constants';
import { getConnectButtonStyles } from '../styles/ConnectButtonStyles';
import TokenClaimModal from './TokenClaimModal';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { confirmWalletChange } from '../services/kaijiGuard'; // KAIJI: blocks wallet changes in a tourney, warns during a match
import { useTheme } from '../context/ThemeContext';
import { toast } from './Toast';
import { DeviceEventEmitter } from 'react-native';
import {
  isV2, sealVault, openVaultWithPassword, lockForServer, unlockFromServer,
  walletFromRecoveryWords, signWalletProof, addressOf, MIN_PASSWORD_LENGTH,
} from '../services/walletVault';
import { readerAction } from '../services/readerActions';

import { gelAlert } from './gel/GelAlert';
import { GelModal, GelButton, GelInput, GelOption } from './gel/GelKit';
import GelOrb from './nav/GelOrb';
// Opens the "Secure my wallet" flow (components/wallet/SecureWalletFlow).
export const SECURE_WALLET_EVENT = 'sempai:secure-wallet';
export const openSecureWalletFlow = (mode = 'create') => DeviceEventEmitter.emit(SECURE_WALLET_EVENT, { mode });

export const EmbeddedWalletContext = createContext();

const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');

const WALLET_TYPES = {
  EMBEDDED: 'embedded'
};

/**
 * The signed-in person's own `users` row. Looked up by account id (which
 * can't be faked); the email match is only a fallback for older accounts
 * whose row predates id syncing. Never trust email alone — that's how a
 * wallet could be pulled into someone else's account.
 */
const findMyUserRow = async (authId, email, columns = 'id, wallet_address') => {
  if (authId) {
    const { data, error } = await supabase.from('users').select(columns).eq('id', authId).maybeSingle();
    if (error) return { data: null, error };
    if (data) return { data, error: null };
  }
  if (!email) return { data: null, error: null };
  // Emails are private, so the match happens on the server against the
  // signed-in account's own email (returns nothing if it's ambiguous).
  const { data: legacyId, error: rpcError } = await supabase.rpc('my_user_id_by_email');
  if (rpcError || !legacyId) return { data: null, error: null };
  const { data, error } = await supabase.from('users').select(columns).eq('id', legacyId).maybeSingle();
  if (error) return { data: null, error };
  return { data: data || null, error: null };
};

/**
 * The wallet's private key (base58) from this phone's stored walletData.
 *  · secure wallets (v2): the key is kept on the phone in secure storage
 *    (it was unlocked with the user's password when they set it up)
 *  · old wallets: an encrypted copy that the server decrypts for the owner
 */
const privateKeyFromWalletData = async (walletData) => {
  if (walletData?.v === 2 && typeof walletData.secret === 'string' && walletData.secret) {
    return walletData.secret;
  }
  if (walletData?.encryptedPrivateKey) {
    return invokeEncryptionFunction('decrypt', walletData.encryptedPrivateKey);
  }
  throw new Error('Private key unavailable');
};

const UI_AUDIT = process.env.EXPO_PUBLIC_UI_AUDIT === '1' && Platform.OS === 'web';
const AUDIT_WALLET = UI_AUDIT ? { publicKey: new solanaWeb3.PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4') } : null;

const secureStoreWrapper = {
  setItemAsync: async (key, value, useBiometrics = false) => {
    try {
      if (typeof value !== 'string') {
        throw new Error(`Value for ${key} must be a string, got ${typeof value}`);
      }
      if (Platform.OS === 'web') {
        await SecureStore.setItemAsync(key, value); // web: wallet secrets → this tab only
      } else if (useBiometrics) {
        try {
          await SecureStore.setItemAsync(key, value, {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to access your wallet',
            authenticationType: SecureStore.AUTHENTICATION_TYPE?.BIOMETRIC,
          });
        } catch (biometricError) {
          console.warn('[secureStoreWrapper] Biometric failed, using fallback:', biometricError.message);
          await SecureStore.setItemAsync(key, value);
        }
      } else {
        await SecureStore.setItemAsync(key, value);
      }
      console.log(`[secureStoreWrapper] Set ${key}`);
    } catch (err) {
      console.error(`[secureStoreWrapper] Failed to set ${key}:`, err.message);
      throw err;
    }
  },
  getItemAsync: async (key, useBiometrics = false) => {
    try {
      if (Platform.OS === 'web') {
        const value = await SecureStore.getItemAsync(key);
        console.log(`[secureStoreWrapper] Got ${key}: ${value ? 'exists' : 'null'}`);
        return value;
      } else if (useBiometrics) {
        try {
          const value = await SecureStore.getItemAsync(key, {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to access your wallet',
            authenticationType: SecureStore.AUTHENTICATION_TYPE?.BIOMETRIC,
          });
          console.log(`[secureStoreWrapper] Got ${key}: ${value ? 'exists' : 'null'}`);
          return value;
        } catch (biometricError) {
          console.warn('[secureStoreWrapper] Biometric failed, using fallback:', biometricError.message);
          const value = await SecureStore.getItemAsync(key);
          console.log(`[secureStoreWrapper] Got ${key} (fallback): ${value ? 'exists' : 'null'}`);
          return value;
        }
      } else {
        const value = await SecureStore.getItemAsync(key);
        console.log(`[secureStoreWrapper] Got ${key}: ${value ? 'exists' : 'null'}`);
        return value;
      }
    } catch (err) {
      console.error(`[secureStoreWrapper] Failed to get ${key}:`, err.message);
      throw err;
    }
  },
  deleteItemAsync: async (key) => {
    try {
      if (Platform.OS === 'web') {
        await SecureStore.deleteItemAsync(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
      console.log(`[secureStoreWrapper] Deleted ${key}`);
    } catch (err) {
      // Non-fatal: key may not exist yet
      console.warn(`[secureStoreWrapper] Error deleting ${key} (may not exist):`, err.message);
    }
  },
};

// Kept outside the component so encryptPrivateKey helpers can call it.
//
// Calls the wallet-encryption edge function directly (the app's server key is
// accepted there). It used to go through the website's /api/wallet-encryption
// route and, on ANY error, "encrypt" with base64 — i.e. store private keys in
// plain text. Encryption now never falls back.
const isGenuineSecretKey = (plain) => {
  try {
    const t = String(plain || '').trim();
    const sk = t.startsWith('[') ? Uint8Array.from(JSON.parse(t)) : bs58.decode(t);
    return sk.length === 64;
  } catch {
    return false;
  }
};

const invokeEncryptionFunction = async (action, data) => {
  const { data: res, error } = await supabase.functions.invoke('wallet-encryption', { body: { action, data } });
  if (!error && typeof res?.result === 'string') return res.result;

  // Read-only compatibility: keys saved by the old base64 fallback can still
  // be opened — but only if the result is a genuine 64-byte secret key.
  if (action === 'decrypt') {
    try {
      const legacy = atob(data);
      if (isGenuineSecretKey(legacy)) {
        console.warn('[invokeEncryptionFunction] Opened a legacy (unencrypted) wallet key — it will be re-encrypted on next save');
        return legacy;
      }
    } catch {
      /* not legacy base64 */
    }
  }
  const message = error?.message || res?.error || 'Wallet encryption service unavailable';
  console.error(`[invokeEncryptionFunction] ${action} failed:`, message);
  throw new Error(`Couldn't ${action === 'encrypt' ? 'secure' : 'unlock'} your wallet — ${message}. Please try again.`);
};

export const EmbeddedWalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [secretKey, setSecretKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [transactionPassword, setTransactionPassword] = useState(null);
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [resolveTransaction, setResolveTransaction] = useState(null);
  const [pendingMode, setPendingMode] = useState('send'); // 'send' | 'sign'

  const [walletType, setWalletType] = useState(null);
  const [showWalletSelection, setShowWalletSelection] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const { user, isLoading: authLoading } = useAuth();

  // ─── Disconnect ─────────────────────────────────────────────────────────────

  const disconnectWallet = useCallback(async () => {
    try {
      console.log('[disconnectWallet] Disconnecting wallet');
      // Gracefully handle keys that may not exist yet
      await secureStoreWrapper.deleteItemAsync('walletData');
      await secureStoreWrapper.deleteItemAsync('walletSecretV2');
      await secureStoreWrapper.deleteItemAsync('useBiometrics');
      try { await AsyncStorage.removeItem('walletAddress'); } catch (_) {}
      setWallet(null);
      setSecretKey(null);
      setTransactionPassword(null);
      setUseBiometrics(false);
      setIsWalletConnected(false);
      setWalletType(null);
      setError(null);
      console.log('[disconnectWallet] Wallet disconnected');
    } catch (err) {
      console.error('[disconnectWallet] Error:', err.message);
      setError('Failed to disconnect wallet: ' + err.message);
    }
  }, []);

  // ─── Restore wallet on mount ─────────────────────────────────────────────────
  // Runs for ALL users (authenticated or not). Authenticated users additionally
  // verify the stored public key matches the database record.

  useEffect(() => {
    if (authLoading) return;

    const restoreWallet = async () => {
      try {
        setIsLoading(true);
        console.log('[restoreWallet] Starting restore. User:', user?.email ?? 'unauthenticated');

        const storedWalletType = await AsyncStorage.getItem('preferredWalletType');

        // Try to read stored wallet data (works for both auth states)
        const storedUseBiometrics = (await secureStoreWrapper.getItemAsync('useBiometrics', false)) === 'true';
        setUseBiometrics(storedUseBiometrics);

        const walletDataStr = await secureStoreWrapper.getItemAsync('walletData', storedUseBiometrics);
        if (!walletDataStr) {
          console.log('[restoreWallet] No embedded wallet data in storage');
          return;
        }

        let walletData;
        try {
          walletData = JSON.parse(walletDataStr);
        } catch (parseError) {
          console.error('[restoreWallet] Failed to parse wallet data:', parseError.message);
          throw new Error('Invalid wallet data format');
        }

        // New wallets (v2): the key is kept in this phone's secure storage —
        // no server needed to open it.
        if (walletData?.v === 2) {
          const secretB58 = walletData.secret;
          if (!secretB58) { console.log('[restoreWallet] v2 wallet key missing on this phone'); return; }
          const bytes = bs58.decode(secretB58);
          const kp = solanaWeb3.Keypair.fromSecretKey(bytes);
          if (kp.publicKey.toString() !== walletData.publicKey) throw new Error('Stored wallet does not match');
          if (user && !user.isGuest) {
            const { data: me } = await findMyUserRow(user.id, user.email);
            if (me?.wallet_address && me.wallet_address !== walletData.publicKey) {
              console.log('[restoreWallet] Account uses a different wallet now, clearing this one');
              await disconnectWallet();
              return;
            }
          }
          setWallet({ publicKey: kp.publicKey });
          setSecretKey(bytes);
          setTransactionPassword(walletData.storedPassword || null);
          setIsWalletConnected(true);
          setWalletType(WALLET_TYPES.EMBEDDED);
          console.log('[restoreWallet] Secure wallet restored:', walletData.publicKey);
          return;
        }

        const { publicKey, encryptedPrivateKey, storedPassword } = walletData;
        if (!publicKey || !encryptedPrivateKey || !storedPassword) {
          console.log('[restoreWallet] Missing embedded wallet data fields');
          return;
        }

        let privateKeyBase58;
        try {
          privateKeyBase58 = await invokeEncryptionFunction('decrypt', encryptedPrivateKey);
          console.log('[restoreWallet] Private key decrypted via edge function');
        } catch (decryptionError) {
          console.error('[restoreWallet] Decryption failed:', decryptionError.message);
          throw new Error('Failed to decrypt stored private key');
        }

        const privateKeyBytes = bs58.decode(privateKeyBase58);
        if (privateKeyBytes.length !== 64) {
          throw new Error(`Invalid private key format: length ${privateKeyBytes.length}`);
        }

        const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
        if (keypair.publicKey.toString() !== publicKey) {
          console.error('[restoreWallet] Public key mismatch:', {
            stored: publicKey,
            derived: keypair.publicKey.toString(),
          });
          throw new Error('Private key does not match stored public key');
        }

        // For authenticated users, verify the wallet still matches their DB record
        if (user && !user.isGuest) {
          const { data: userData, error: userError } = await findMyUserRow(user.id, user.email);

          if (userError) {
            console.warn('[restoreWallet] Supabase query failed, restoring anyway:', userError.message);
          } else if (userData && userData.wallet_address && userData.wallet_address !== publicKey) {
            console.log('[restoreWallet] Wallet mismatch with DB record, clearing');
            await disconnectWallet();
            return;
          }
        }

        setWallet({ publicKey: keypair.publicKey });
        setSecretKey(privateKeyBytes);
        setTransactionPassword(storedPassword);
        setIsWalletConnected(true);
        setWalletType(WALLET_TYPES.EMBEDDED);
        console.log('[restoreWallet] Embedded wallet restored:', publicKey);

      } catch (err) {
        console.error('[restoreWallet] Error:', err.message);
        setError('Failed to restore wallet: ' + err.message);
        // Only wipe if the data is genuinely corrupt; non-fatal read errors are
        // handled above. Here we still clear to avoid a broken state.
        try { await disconnectWallet(); } catch (_) {}
      } finally {
        setIsLoading(false);
      }
    };

    restoreWallet();
  }, [user, authLoading]); // intentionally omitting disconnectWallet to avoid loop

  // ─── Secure wallet (v2) ──────────────────────────────────────────────────────
  // The key is locked on this phone with the user's wallet password before it
  // is backed up (services/walletVault). This phone keeps it in secure storage.

  /** Keep a verified wallet on this phone and make it the active wallet. */
  const adoptVerifiedWallet = useCallback(async (secretKeyBytes, password) => {
    const kp = solanaWeb3.Keypair.fromSecretKey(secretKeyBytes);
    const address = kp.publicKey.toString();
    const hashedPassword = password
      ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password)
      : null;
    await secureStoreWrapper.setItemAsync(
      'walletData',
      JSON.stringify({ v: 2, publicKey: address, secret: bs58.encode(secretKeyBytes), storedPassword: hashedPassword }),
      useBiometrics,
    );
    await secureStoreWrapper.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false', false);
    await AsyncStorage.setItem('walletAddress', address);
    await AsyncStorage.setItem('preferredWalletType', WALLET_TYPES.EMBEDDED);
    setWallet({ publicKey: kp.publicKey });
    setSecretKey(secretKeyBytes);
    setTransactionPassword(hashedPassword);
    setIsWalletConnected(true);
    setWalletType(WALLET_TYPES.EMBEDDED);
    return address;
  }, [useBiometrics]);

  /**
   * Lock a wallet with the user's password, back it up (server can't open it),
   * switch the account to it (history follows) and use it on this phone.
   */
  const secureNewWallet = useCallback(async ({ secretKey: sk, password }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in with Google first.');
    const vault = await sealVault({ secretKey: sk, password });
    const stored = await lockForServer(vault);
    const ts = Date.now();
    const res = await readerAction('wallet_secure', {
      address: addressOf(sk),
      vault: stored,
      ts,
      signature: signWalletProof(sk, session.user.id, ts),
    });
    if (!res.ok) throw new Error(res.error || 'Couldn’t save your secure wallet. Please try again.');
    await adoptVerifiedWallet(sk, password);
    return res; // { address, oldAddress, moved }
  }, [adoptVerifiedWallet]);

  /** Forgot the password, or a new phone: 12 words → same wallet, new password. */
  const restoreWithRecoveryWords = useCallback(async (words, newPassword) => {
    const { secretKey: sk, address } = await walletFromRecoveryWords(words);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in with Google first.');
    const { data: me } = await findMyUserRow(session.user.id, session.user.email);
    if (me?.wallet_address && me.wallet_address !== address) {
      throw new Error('These recovery words belong to a different wallet than the one on your account.');
    }
    await secureNewWallet({ secretKey: sk, password: newPassword });
    return { address };
  }, [secureNewWallet]);

  /** The account's OLD-format wallet key (this phone first, else the old server copy). */
  const loadLegacyWalletKey = useCallback(async () => {
    if (secretKey && wallet?.publicKey) return { secretKey, address: wallet.publicKey.toString() };
    const { data: rows } = await supabase.rpc('get_my_wallet_key', {});
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.private_key || isV2(row.private_key)) return null;
    const b58 = await invokeEncryptionFunction('decrypt', row.private_key);
    return { secretKey: bs58.decode(b58), address: row.address };
  }, [secretKey, wallet]);

  // ─── Create ─────────────────────────────────────────────────────────────────
  // New wallets are made in the guided flow (password → 12 words → confirm).
  const createEmbeddedWallet = useCallback(async () => {
    openSecureWalletFlow('create');
    return null;
  }, []);

  // Old server-encrypted creation, kept only for reference — no longer used.
  const createEmbeddedWalletLegacy = useCallback(async (password) => {
    // Try to get current session
    let authUser, authError;
    try {
      const result = await supabase.auth.getUser();
      authUser = result.data;
      authError = result.error;
    } catch (e) {
      authError = e;
    }

    // If no session, try to refresh
    if (authError || !authUser?.user) {
      console.log('[createEmbeddedWallet] No session found, trying to refresh...');
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !session?.user) {
        throw new Error('No active session. Please sign in with a full account.');
      }
      authUser = { user: session.user };
    }
    
    // Use Supabase user data
    const actualUser = authUser.user;
    
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be a string and at least 8 characters long');
    }
    try {
      setIsLoading(true);
      console.log('[createEmbeddedWallet] Creating embedded wallet for:', actualUser.email);

      const keypair = solanaWeb3.Keypair.generate();
      const publicKey = keypair.publicKey;
      const secretKeyBytes = keypair.secretKey;
      const secretKeyBase58 = bs58.encode(secretKeyBytes);

      const encryptedPrivateKey = await invokeEncryptionFunction('encrypt', secretKeyBase58);
      const hashedPassword = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);

      let referralCode;
      let isUnique = false;
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      while (!isUnique) {
        referralCode = Array.from({ length: 8 }, () =>
          characters.charAt(Math.floor(Math.random() * characters.length))
        ).join('');
        const { data } = await supabase.from('users').select('id').eq('referral_code', referralCode).maybeSingle();
        isUnique = !data;
      }

      const userMetadata = actualUser.user_metadata || {};
      const name  = userMetadata.full_name || actualUser.email.split('@')[0];
      const email = actualUser.email;

      // Preserve an uploaded profile picture and profile-completed flag —
      // the Google avatar is only a fallback for brand-new users.
      const { data: existingUserRow } = await supabase
        .from('users')
        .select('image, has_updated_profile')
        .eq('id', actualUser.id)
        .maybeSingle();
      const image = existingUserRow?.image || userMetadata.avatar_url || null;
      const hasUpdatedProfile = existingUserRow?.has_updated_profile ?? false;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert(
          { id: actualUser.id, email, name, image, wallet_address: publicKey.toString(), referral_code: referralCode, has_updated_profile: hasUpdatedProfile },
          { onConflict: 'id' }
        )
        .select('id')
        .single();

      if (userError) throw new Error(`User upsert failed: ${userError.message}`);
      if (!userData) throw new Error('User upsert succeeded but returned no data');

      // Use upsert to replace existing wallet if it exists
      const { error: walletError } = await supabase
        .from('user_wallets')
        .upsert({ user_id: userData.id, address: publicKey.toString(), private_key: encryptedPrivateKey }, { onConflict: 'user_id' });
      if (walletError) throw new Error(`Wallet upsert failed: ${walletError.message}`);

      const encryptedPrivateKeyForStore = await invokeEncryptionFunction('encrypt', secretKeyBase58);
      const walletData = {
        publicKey: publicKey.toString(),
        encryptedPrivateKey: encryptedPrivateKeyForStore,
        storedPassword: hashedPassword,
      };

      await secureStoreWrapper.setItemAsync('walletData', JSON.stringify(walletData), useBiometrics);
      await secureStoreWrapper.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false', false);
      await AsyncStorage.setItem('walletAddress', publicKey.toString());
      await AsyncStorage.setItem('preferredWalletType', WALLET_TYPES.EMBEDDED);

      setWallet({ publicKey });
      setSecretKey(secretKeyBytes);
      setTransactionPassword(hashedPassword);
      setIsWalletConnected(true);
      setWalletType(WALLET_TYPES.EMBEDDED);
      console.log('[createEmbeddedWallet] Embedded wallet created:', publicKey.toString());
      return { publicKey: publicKey.toString(), privateKey: secretKeyBase58 };
    } catch (err) {
      console.error('[createEmbeddedWallet] Error:', err.message);
      setError('Failed to create embedded wallet: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, useBiometrics]);

  // ─── Retrieve ────────────────────────────────────────────────────────────────

  const retrieveEmbeddedWallet = useCallback(async (password) => {
    // Verify actual auth status from Supabase, not just local state
    const { data: authUser, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser.user) {
      throw new Error('No active session. Please sign in with a full account.');
    }
    
    // Use Supabase user data, not local state
    const actualUser = authUser.user;
    
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be a string and at least 8 characters long');
    }
    try {
      setIsLoading(true);
      console.log('[retrieveEmbeddedWallet] Retrieving embedded wallet for:', actualUser.email);

      try { await disconnectWallet(); } catch (_) {}

      const { data: userData, error: userError } = await findMyUserRow(actualUser.id, actualUser.email);
      if (userError || !userData) throw new Error('User not found. Please ensure your account is registered.');
      if (!userData.wallet_address) throw new Error('No wallet address associated with this user. Please create a new wallet.');

      // Owner-only route first (works once the app signs in as the reader);
      // the direct read is the fallback while the app still uses its own key.
      let walletData = null;
      const { data: ownKeys } = await supabase.rpc('get_my_wallet_key', { p_address: userData.wallet_address });
      if (Array.isArray(ownKeys) && ownKeys.length) walletData = ownKeys[0];
      if (!walletData) {
        const { data: row } = await supabase
          .from('user_wallets')
          .select('address, private_key')
          .eq('user_id', userData.id)
          .eq('address', userData.wallet_address)
          .maybeSingle();
        walletData = row || null;
      }
      if (!walletData) throw new Error('No wallet found for this user. Please create a new wallet or contact support.');
      if (typeof walletData.address !== 'string' || typeof walletData.private_key !== 'string') {
        throw new Error('Invalid wallet data format in database.');
      }

      // New format: the server returns the locked vault; only the wallet
      // password (on this phone) opens it.
      if (isV2(walletData.private_key)) {
        const vaultJson = await unlockFromServer(walletData.private_key);
        const { secretKey: sk, address } = await openVaultWithPassword(vaultJson, password);
        if (address !== walletData.address) throw new Error('Wallet check failed. Please contact support.');
        await adoptVerifiedWallet(sk, password);
        console.log('[retrieveEmbeddedWallet] Secure wallet opened:', address);
        return { publicKey: address };
      }

      const privateKeyBase58 = await invokeEncryptionFunction('decrypt', walletData.private_key);
      const privateKeyBytes  = bs58.decode(privateKeyBase58);
      if (privateKeyBytes.length !== 64) {
        throw new Error(`Invalid private key format after decryption: length ${privateKeyBytes.length}`);
      }

      const keypair      = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
      const publicKey    = keypair.publicKey;
      const publicKeyStr = publicKey.toString();

      if (publicKeyStr !== walletData.address) throw new Error('Public key mismatch. Please contact support.');

      const hashedPassword = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);

      const encryptedPrivateKeyForStore = await invokeEncryptionFunction('encrypt', privateKeyBase58);

      const walletDataObj = {
        publicKey: publicKeyStr,
        encryptedPrivateKey: encryptedPrivateKeyForStore,
        storedPassword: hashedPassword,
      };

      await secureStoreWrapper.setItemAsync('walletData', JSON.stringify(walletDataObj), useBiometrics);
      await secureStoreWrapper.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false', false);
      await AsyncStorage.setItem('walletAddress', publicKeyStr);
      await AsyncStorage.setItem('preferredWalletType', WALLET_TYPES.EMBEDDED);

      setWallet({ publicKey });
      setSecretKey(privateKeyBytes);
      setTransactionPassword(hashedPassword);
      setIsWalletConnected(true);
      setWalletType(WALLET_TYPES.EMBEDDED);
      console.log('[retrieveEmbeddedWallet] Embedded wallet retrieved:', publicKeyStr);
      return { publicKey: publicKeyStr, privateKey: privateKeyBase58 };
    } catch (err) {
      console.error('[retrieveEmbeddedWallet] Error:', err.message);
      setError(`Failed to retrieve embedded wallet: ${err.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, useBiometrics, disconnectWallet, adoptVerifiedWallet]);

  // ─── Import wallet ───────────────────────────────────────────────────────────

  const importWalletFromPrivateKey = useCallback(async (privateKeyInput, password) => {
    if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Your wallet password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (!privateKeyInput || typeof privateKeyInput !== 'string') {
      throw new Error('Private key is required');
    }
    try {
      setIsLoading(true);
      let privateKeyBytes;
      try {
        privateKeyBytes = bs58.decode(privateKeyInput.trim());
      } catch {
        throw new Error('Invalid private key format. Please enter a valid Base58 private key.');
      }
      if (privateKeyBytes.length !== 64) {
        throw new Error(`Invalid private key length: expected 64 bytes, got ${privateKeyBytes.length}`);
      }
      // Throws if the 64 bytes are not a genuine keypair
      solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);

      try { await disconnectWallet(); } catch (_) {}

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Signed in: lock it with the password and make it the account's wallet.
        await secureNewWallet({ secretKey: privateKeyBytes, password });
      } else {
        // Guest: keep it on this phone only.
        await adoptVerifiedWallet(privateKeyBytes, password);
      }
      const address = addressOf(privateKeyBytes);
      console.log('[importWalletFromPrivateKey] Wallet imported:', address);
      return { publicKey: address };
    } catch (err) {
      console.error('[importWalletFromPrivateKey] Error:', err.message);
      setError(`Failed to import wallet: ${err.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, useBiometrics, disconnectWallet, secureNewWallet, adoptVerifiedWallet]);

  // ─── Password verification ───────────────────────────────────────────────────

  const verifyPassword = useCallback(async (password) => {
    if (!transactionPassword) return false;
    const hashedInput = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
    return hashedInput === transactionPassword;
  }, [transactionPassword]);

  // ─── Sign & send ─────────────────────────────────────────────────────────────

  const signAndSendTransaction = useCallback(async (transaction, inputPassword) => {
    try {
      console.log('[signAndSendTransaction] Starting. Wallet type:', walletType);

      console.log('[signAndSendTransaction] Using embedded wallet');
      const biometricsEnabled = (await AsyncStorage.getItem('useBiometrics')) === 'true';

      if (!biometricsEnabled && !inputPassword) {
        console.log('[signAndSendTransaction] No password provided, showing modal');
        setPendingTransaction(transaction);
        setPendingMode('send');
        setPasswordModalVisible(true);
        return new Promise((resolve, reject) => {
          setResolveTransaction({ resolve, reject });
        });
      }

      if (!wallet?.publicKey) throw new Error('No wallet connected');
      if (!transaction)       throw new Error('No transaction provided');

      // Only verify password if biometrics is not enabled
      if (!biometricsEnabled && inputPassword) {
        const isValid = await verifyPassword(inputPassword);
        if (!isValid) throw new Error('Invalid transaction password');
      }

      // Retrieve and decrypt stored private key
      // When biometrics is enabled, this will trigger biometric authentication
      let privateKeyBase58;
      try {
        const walletDataStr = await secureStoreWrapper.getItemAsync('walletData', biometricsEnabled);
        if (!walletDataStr) throw new Error('Wallet data unavailable');

        privateKeyBase58 = await privateKeyFromWalletData(JSON.parse(walletDataStr));
      } catch (err) {
        console.error('[signAndSendTransaction] Error retrieving/decrypting wallet data:', err);
        throw new Error('Failed to retrieve or decrypt wallet data: ' + err.message);
      }

      const privateKeyBytes = bs58.decode(privateKeyBase58);
      const keypair         = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);

      if (wallet.publicKey.toString() !== keypair.publicKey.toString()) {
        throw new Error('Private key does not match wallet public key');
      }

      if (!transaction.feePayer) {
        transaction.feePayer = keypair.publicKey;
      }

      if (transaction instanceof solanaWeb3.VersionedTransaction) {
        console.log('[signAndSendTransaction] Handling VersionedTransaction');
        transaction.sign([keypair]);
        const serializedTx = transaction.serialize();
        const signature    = await connection.sendRawTransaction(serializedTx, { skipPreflight: false, maxRetries: 3 });
        console.log('[signAndSendTransaction] VersionedTransaction sent:', signature);
        // Signature-strategy confirmation can poll forever on dropped txs — bound it.
        const confirmation = await Promise.race([
          connection.confirmTransaction(signature, 'confirmed'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timed out')), 90000)),
        ]);
        if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        console.log('[signAndSendTransaction] VersionedTransaction confirmed:', signature);
        return signature;
      } else {
        console.log('[signAndSendTransaction] Handling legacy transaction');
        // Refresh blockhash at send time so blockhash-strategy confirmation
        // expires correctly instead of polling forever on dropped transactions.
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        if (!transaction.feePayer) {
          transaction.feePayer = keypair.publicKey;
        }
        const signature    = await connection.sendTransaction(transaction, [keypair]);
        console.log('[signAndSendTransaction] Legacy transaction sent:', signature);
        const confirmation = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed'
        );
        if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        console.log('[signAndSendTransaction] Legacy transaction confirmed:', signature);
        return signature;
      }

    } catch (err) {
      console.error('[signAndSendTransaction] Error:', err.message);
      let errorMessage = 'Transaction failed';
      if (err.message.includes('insufficient funds'))          errorMessage = 'Insufficient SOL balance for this transaction';
      else if (err.message.includes('Invalid transaction password')) errorMessage = 'Invalid password. Please check your credentials.';
      else if (err.message.includes('Private key does not match'))   errorMessage = 'Wallet security error. Please reconnect your wallet.';
      else if (err.message.includes('network'))               errorMessage = 'Network error. Please check your internet connection.';
      else if (err.message.includes('timeout'))               errorMessage = 'Transaction timed out. Please try again.';
      throw new Error(errorMessage);
    }
  }, [walletType, wallet, verifyPassword]);

  // ─── Sign only (without sending) ──────────────────────────────────────────────

  const signTransactionOnly = useCallback(async (transaction, inputPassword) => {
    try {
      console.log('[signTransactionOnly] Starting. Wallet type:', walletType);

      const biometricsEnabled = (await AsyncStorage.getItem('useBiometrics')) === 'true';

      if (!biometricsEnabled && !inputPassword) {
        console.log('[signTransactionOnly] No password provided, showing modal');
        setPendingTransaction(transaction);
        setPendingMode('sign');
        setPasswordModalVisible(true);
        return new Promise((resolve, reject) => {
          setResolveTransaction({ resolve, reject });
        });
      }

      if (!wallet?.publicKey) throw new Error('No wallet connected');
      if (!transaction)       throw new Error('No transaction provided');

      // Only verify password if biometrics is not enabled
      if (!biometricsEnabled && inputPassword) {
        const isValid = await verifyPassword(inputPassword);
        if (!isValid) throw new Error('Invalid transaction password');
      }

      // Retrieve and decrypt stored private key
      let privateKeyBase58;
      try {
        const walletDataStr = await secureStoreWrapper.getItemAsync('walletData', biometricsEnabled);
        if (!walletDataStr) throw new Error('Wallet data unavailable');

        privateKeyBase58 = await privateKeyFromWalletData(JSON.parse(walletDataStr));
      } catch (err) {
        console.error('[signTransactionOnly] Error retrieving/decrypting wallet data:', err);
        throw new Error('Failed to retrieve or decrypt wallet data: ' + err.message);
      }

      const privateKeyBytes = bs58.decode(privateKeyBase58);
      const keypair         = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);

      if (wallet.publicKey.toString() !== keypair.publicKey.toString()) {
        throw new Error('Private key does not match wallet public key');
      }

      if (!transaction.feePayer) {
        transaction.feePayer = keypair.publicKey;
      }

      if (transaction instanceof solanaWeb3.VersionedTransaction) {
        console.log('[signTransactionOnly] Handling VersionedTransaction');
        transaction.sign([keypair]);
        return Buffer.from(transaction.serialize()).toString('base64');
      } else {
        console.log('[signTransactionOnly] Handling legacy transaction');
        transaction.partialSign(keypair);
        return transaction.serialize().toString('base64');
      }

    } catch (err) {
      console.error('[signTransactionOnly] Error:', err.message);
      let errorMessage = 'Transaction signing failed';
      if (err.message.includes('Invalid transaction password')) errorMessage = 'Invalid password. Please check your credentials.';
      else if (err.message.includes('Private key does not match'))   errorMessage = 'Wallet security error. Please reconnect your wallet.';
      else if (err.message.includes('network'))               errorMessage = 'Network error. Please check your internet connection.';
      throw new Error(errorMessage);
    }
  }, [walletType, wallet, verifyPassword]);

  // ─── Provider ────────────────────────────────────────────────────────────────

  // Design-review builds only (EXPO_PUBLIC_UI_AUDIT=1, web): pretend a read-only wallet is connected so
  // wallet pages can be screenshotted. It has no key, so nothing can be signed. Real builds never set it.
  const auditWallet = UI_AUDIT ? AUDIT_WALLET : null;

  return (
    <EmbeddedWalletContext.Provider
      value={{
        wallet: auditWallet || wallet,
        secretKey,
        isWalletConnected: !!auditWallet || isWalletConnected,
        walletType,
        createEmbeddedWallet,
        retrieveEmbeddedWallet,
        importWalletFromPrivateKey,
        disconnectWallet,
        adoptVerifiedWallet,
        secureNewWallet,
        restoreWithRecoveryWords,
        loadLegacyWalletKey,
        signAndSendTransaction,
        signTransactionOnly,
        isLoading,
        error,
        useBiometrics,
        setUseBiometrics,
        showModal,
        setShowModal,
      }}
    >
      {children}
      <PasswordModal
        isVisible={isPasswordModalVisible}
        onClose={() => {
          setPasswordModalVisible(false);
          if (resolveTransaction) {
            resolveTransaction.reject(new Error('Password entry cancelled'));
          }
        }}
        onSubmit={async (password) => {
          setPasswordModalVisible(false);
          if (pendingTransaction && resolveTransaction) {
            try {
              const result = pendingMode === 'sign'
                ? await signTransactionOnly(pendingTransaction, password)
                : await signAndSendTransaction(pendingTransaction, password);
              resolveTransaction.resolve(result);
            } catch (error) {
              resolveTransaction.reject(error);
            }
          }
        }}
        onUseBiometrics={async () => {
          if (pendingTransaction && resolveTransaction) {
            try {
              console.log('[onUseBiometrics] Starting biometric authentication...');

              // Enable biometrics for this transaction
              await setUseBiometrics(true);
              await AsyncStorage.setItem('useBiometrics', 'true');
              console.log('[onUseBiometrics] Biometrics enabled in state');

              setPasswordModalVisible(false);
              console.log('[onUseBiometrics] Modal closed, signing transaction...');
              const result = pendingMode === 'sign'
                ? await signTransactionOnly(pendingTransaction)
                : await signAndSendTransaction(pendingTransaction);
              console.log('[onUseBiometrics] Transaction signed:', result);
              resolveTransaction.resolve(result);
            } catch (error) {
              console.error('[onUseBiometrics] Error:', error);
              // Re-open modal to allow password entry as fallback
              setPasswordModalVisible(true);
              // Don't reject yet - let user try password
              // Only reject if they cancel the modal
            }
          }
        }}
      />
      <WalletSelectionModal
        isVisible={showWalletSelection}
        onClose={() => setShowWalletSelection(false)}
        onSelectEmbedded={() => {
          setWalletType(WALLET_TYPES.EMBEDDED);
          setShowWalletSelection(false);
          AsyncStorage.setItem('preferredWalletType', WALLET_TYPES.EMBEDDED);
        }}
      />
      <WalletConnectionModal
        isVisible={showModal}
        onClose={() => setShowModal(false)}
      />
    </EmbeddedWalletContext.Provider>
  );
};

// ─── Password Modal ───────────────────────────────────────────────────────────

const PasswordModal = ({ isVisible, onClose, onSubmit, onUseBiometrics }) => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getConnectButtonStyles(colors), [isDark]);
  const [password, setPassword] = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const hasHardware = await SecureStore.isAvailableAsync();
        setBiometricsAvailable(hasHardware);
      } catch (error) {
        setBiometricsAvailable(false);
      }
    };
    if (isVisible) {
      checkBiometrics();
    }
  }, [isVisible]);

  const handleSubmit = () => {
    onSubmit(password);
    setPassword('');
  };

  const handleBiometrics = () => {
    if (onUseBiometrics) {
      onUseBiometrics();
    }
  };

  const bio = biometricsAvailable && onUseBiometrics;
  return (
    <GelModal
      visible={isVisible}
      onClose={onClose}
      variant="sheet"
      icon="lock"
      title="Confirm it's you"
      subtitle={bio ? 'Use your fingerprint, or enter your wallet password.' : 'Enter your wallet password to continue.'}
      actions={[
        { label: 'Cancel', variant: 'secondary', onPress: onClose },
        { label: 'Confirm', icon: 'check', onPress: handleSubmit, disabled: !password },
      ]}
    >
      {bio ? (
        <View style={{ marginTop: 16 }}>
          <GelButton label="Use fingerprint" icon="fingerprint" variant="secondary" onPress={handleBiometrics} />
        </View>
      ) : null}
      <GelInput
        label="Password"
        placeholder="Your wallet password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        autoFocus={!bio}
      />
    </GelModal>
  );
};

// ─── Wallet Selection Modal ───────────────────────────────────────────────────

const WalletSelectionModal = ({ isVisible, onClose, onSelectEmbedded }) => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getConnectButtonStyles(colors), [isDark]);

  return (
    <GelModal visible={isVisible} onClose={onClose} variant="sheet" icon="wallet" title="Choose a wallet">
      <GelOption
        icon="shield-alt"
        title="SempaiHQ wallet"
        description="Locked with your password and fingerprint, backed up by 12 recovery words."
        onPress={onSelectEmbedded}
      />
    </GelModal>
  );
};

// ─── Connect Button ───────────────────────────────────────────────────────────

const ConnectButton = ({ compact = false, label }) => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getConnectButtonStyles(colors), [isDark]);
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet          = walletContext?.wallet;
  const walletType      = walletContext?.walletType;
  const isLoading       = walletContext?.isLoading;
  const disconnectWallet  = walletContext?.disconnectWallet;
  const { user } = useAuth();
  const [showDropdown, setShowDropdown]           = useState(false);
  const [showReferralPrompt, setShowReferralPrompt] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  if (!walletContext) {
    const [localShowModal, setLocalShowModal] = useState(false);
    return (
      <>
        <TouchableOpacity
          onPress={() => setLocalShowModal(true)}
          style={[styles.connectButtonWrapper, compact && styles.connectButtonWrapperCompact]}
        >
          <LinearGradient
            colors={[colors.accent, colors.accentDeep]}
            style={styles.connectButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.connectButtonText}>Connect Wallet</Text>
          </LinearGradient>
        </TouchableOpacity>
        <WalletConnectionModal
          isVisible={localShowModal}
          onClose={() => setLocalShowModal(false)}
        />
      </>
    );
  }

  const handleReferralPrompt = () => setShowReferralPrompt(false);

  const getWalletLabel = () => {
    if (walletType === WALLET_TYPES.EMBEDDED) return 'Embedded';
    return null;
  };

  const renderDropdown = () => {
    if (!showDropdown || !wallet) return null;
    return (
      <View style={styles.dropdown} pointerEvents="auto">
        <View style={styles.dropdownHeader}>
          <Text style={styles.dropdownTitle}>Wallet Options</Text>
          <TouchableOpacity onPress={() => setShowDropdown(false)}>
            <MaterialCommunityIcons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
        <View style={styles.dropdownItem}>
          <Text style={styles.dropdownItemText}>Type: {getWalletLabel()}</Text>
        </View>
        <View style={styles.dropdownItem}>
          <Text style={styles.dropdownItemText}>
            Address: {wallet.publicKey.toString().slice(0, 4)}...{wallet.publicKey.toString().slice(-4)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.dropdownAction}
          onPress={() => {
            Clipboard.setString(wallet.publicKey.toString());
            toast.success('Wallet address copied to clipboard');
          }}
        >
          <Text style={styles.dropdownActionText}>Copy Address</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dropdownAction, styles.disconnectAction]}
          onPress={() => { setShowDropdown(false); setShowDisconnectModal(true); }}
        >
          <Text style={[styles.dropdownActionText, styles.disconnectActionText]}>Disconnect Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDisconnectModal = () => {
    return (
      <GelModal
        visible={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        icon="unlink"
        tone="#E5484D"
        title="Disconnect wallet?"
        subtitle="You can reconnect any time with your password or your 12 recovery words."
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setShowDisconnectModal(false) },
          {
            label: 'Disconnect',
            variant: 'danger',
            onPress: async () => {
              if (!(await confirmWalletChange())) return; // KAIJI guard
              await disconnectWallet();
              setShowDisconnectModal(false);
            },
          },
        ]}
      />
    );
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.connectButtonWrapper, compact && styles.connectButtonWrapperCompact]}
          onPress={() => {
            if (wallet) {
              setShowDropdown((prev) => !prev);
            } else {
              walletContext?.setShowModal?.(true);
            }
          }}
          disabled={isLoading}
        >
          <LinearGradient
            colors={[colors.accent, colors.accentDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.connectButtonGradient, compact && styles.connectButtonGradientCompact]}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={[styles.connectButtonText, compact && styles.connectButtonTextCompact]}>Load</Text>
              </View>
            ) : wallet ? (
              <View style={styles.walletInfoContainer}>
                <View style={styles.walletAddressContainer}>
                  <MaterialCommunityIcons
                    name="wallet-outline"
                    size={14}
                    color="#ffffff"
                    style={styles.walletIcon}
                  />
                  <Text style={[styles.connectButtonText, compact && styles.connectButtonTextCompact]}>
                    {getWalletLabel()}: {wallet.publicKey.toString().slice(0, 2)}...{wallet.publicKey.toString().slice(-2)}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={showDropdown ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#ffffff"
                  style={styles.dropdownIcon}
                />
              </View>
            ) : (
              <View style={styles.walletInfoContainer}>
                <MaterialCommunityIcons name="wallet-plus-outline" size={14} color="#ffffff" style={styles.walletIcon} />
                <Text style={[styles.connectButtonText, compact && styles.connectButtonTextCompact]}>
                  {label ? label : (user && !user.isGuest ? 'Connect' : 'Sign In')}
                </Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
        {renderDropdown()}
        {renderDisconnectModal()}
      </View>
    </>
  );
};

// ─── Wallet Connection Modal ──────────────────────────────────────────────────

const WalletConnectionModal = ({ isVisible, onClose }) => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getConnectButtonStyles(colors), [isDark]);
  const walletContext = useContext(EmbeddedWalletContext);
  const createEmbeddedWallet  = walletContext?.createEmbeddedWallet;
  const retrieveEmbeddedWallet = walletContext?.retrieveEmbeddedWallet;
  const importWalletFromPrivateKey = walletContext?.importWalletFromPrivateKey;
  const { user } = useAuth();

  const [mode, setMode]                   = useState('menu');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [hasExistingWallet, setHasExistingWallet] = useState(false);
  const [loading, setLoading]             = useState(false);
  const [fadeAnim]  = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  if (!walletContext) {
    return (
      <GelModal
        visible={isVisible}
        onClose={onClose}
        icon="exclamation-circle"
        title="Wallet isn't ready"
        subtitle="Please restart the app and try again."
        actions={[{ label: 'Close', onPress: onClose }]}
      />
    );
  }

  useEffect(() => {
    const checkExistingWallet = async () => {
      if (user && !user.isGuest) {
        try {
          const { data: userData } = await findMyUserRow(user.id, user.email, 'wallet_address');
          const hasWallet = !!userData?.wallet_address;
          setHasExistingWallet(hasWallet);

          if (hasWallet) {
            try {
              const storedWalletData = await AsyncStorage.getItem('walletAddress');
              const storedWalletType = await AsyncStorage.getItem('preferredWalletType');
              if (storedWalletData !== userData.wallet_address || storedWalletType !== WALLET_TYPES.EMBEDDED) {
                setMode('retrieve');
              }
            } catch (error) {
              console.log('[WalletConnectionModal] Error checking local wallet:', error.message);
            }
          }
        } catch (error) {
          console.log('[WalletConnectionModal] Error checking existing wallet:', error.message);
        }
      }
    };

    if (isVisible) {
      checkExistingWallet();
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      scaleAnim.setValue(0.9);
      setMode('menu');
    }
  }, [isVisible, user]);

  const handleModeChange = (newMode) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,    duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setMode(newMode);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleCreateWallet = async () => {
    if (password !== confirmPassword) { gelAlert('Error', 'Passwords do not match'); return; }

    // KAIJI guard: blocked during a tourney, warns during a match
    if (!(await confirmWalletChange())) return;
    
    // If user already has a wallet, warn them before creating a new one
    if (hasExistingWallet) {
      gelAlert(
        'Replace Existing Wallet?',
        'You already have a wallet linked to this account. Creating a new wallet will replace the old one. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Create New', 
            onPress: async () => {
              setLoading(true);
              try {
                const result = await createEmbeddedWallet(password);
                if (result) { 
                  toast.success('New wallet created successfully!'); 
                  onClose(); 
                }
              } catch (error) {
                toast.error(error.message);
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
      return;
    }
    
    setLoading(true);
    try {
      const result = await createEmbeddedWallet(password);
      if (result) { toast.success('Embedded wallet created successfully!'); onClose(); }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieveWallet = async () => {
    // KAIJI guard: blocked during a tourney, warns during a match
    if (!(await confirmWalletChange())) return;

    setLoading(true);
    try {
      const result = await retrieveEmbeddedWallet(password);
      if (result) { toast.success('Embedded wallet retrieved successfully!'); onClose(); }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };


  const handleImportWallet = async () => {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      gelAlert('Error', `Your wallet password needs at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (!confirmPassword || password !== confirmPassword) {
      gelAlert('Error', 'Passwords do not match');
      return;
    }

    // KAIJI guard: blocked during a tourney, warns during a match
    if (!(await confirmWalletChange())) return;

    setLoading(true);
    try {
      const result = await importWalletFromPrivateKey(privateKeyInput, password);
      if (result) {
        toast.success('Wallet imported successfully!');
        onClose();
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const GREEN = '#22A06B';
  const PURPLE = '#8E44D6';
  const back = (
    <View style={{ position: 'absolute', top: 6, left: 6, zIndex: 5 }}>
      <GelOrb icon="arrow-left" size={30} iconSize={12} onPress={() => handleModeChange('menu')} label="Back" breathe={false} />
    </View>
  );
  const sheet = {
    visible: isVisible,
    onClose,
    variant: 'sheet',
    scroll: mode !== 'menu',
  };

  if (mode === 'create') {
    return (
      <GelModal
        {...sheet}
        icon="plus"
        title="Create a wallet"
        subtitle="Choose a password to lock it on this phone."
        actions={[{ label: 'Create wallet', icon: 'check', loading, onPress: handleCreateWallet }]}
      >
        {back}
        <GelInput label="Password" placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} secureTextEntry value={password} onChangeText={setPassword} autoComplete="new-password" textContentType="newPassword" importantForAutofill="yes" />
        <GelInput label="Confirm password" placeholder="Type it again" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} autoComplete="new-password" textContentType="newPassword" importantForAutofill="yes" />
      </GelModal>
    );
  }

  if (mode === 'retrieve') {
    return (
      <GelModal
        {...sheet}
        icon="download"
        tone={GREEN}
        title="Restore your wallet"
        subtitle={hasExistingWallet ? 'Enter your password to open the wallet linked to this account.' : 'Enter your wallet password.'}
        actions={[{ label: 'Restore wallet', icon: 'unlock', loading, onPress: handleRetrieveWallet }]}
      >
        {back}
        <GelInput label="Password" placeholder="Your wallet password" secureTextEntry value={password} onChangeText={setPassword} autoComplete="password" textContentType="password" importantForAutofill="yes" onSubmitEditing={handleRetrieveWallet} returnKeyType="done" />
        <GelButton
          label="Forgot it? Use your 12 recovery words"
          variant="ghost"
          small
          style={{ marginTop: 10 }}
          onPress={() => { onClose(); openSecureWalletFlow('restore'); }}
        />
      </GelModal>
    );
  }

  if (mode === 'import') {
    return (
      <GelModal
        {...sheet}
        icon="key"
        tone={PURPLE}
        title="Import a wallet"
        subtitle="Paste your private key, then choose a password to lock it on this phone."
        actions={[{ label: 'Import wallet', icon: 'check', loading, onPress: handleImportWallet }]}
      >
        {back}
        <GelInput label="Private key" placeholder="Your private key (base58)" value={privateKeyInput} onChangeText={setPrivateKeyInput} multiline autoCapitalize="none" autoCorrect={false} />
        <GelInput label="Password" placeholder="At least 8 characters" secureTextEntry value={password} onChangeText={setPassword} />
        <GelInput label="Confirm password" placeholder="Type it again" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
      </GelModal>
    );
  }

  return (
    <GelModal
      {...sheet}
      icon="wallet"
      title="Your wallet"
      subtitle="Create a new one, or bring back the one you already have."
    >
      <View style={{ marginTop: 8 }}>
        <GelOption
          icon="plus"
          title="Create a new wallet"
          description="Locked with your password, backed up by 12 recovery words — only you can open it."
          onPress={async () => { if (!(await confirmWalletChange())) return; onClose(); openSecureWalletFlow('create'); }}
        />
        <GelOption
          icon="download"
          tone={GREEN}
          title="Restore my wallet"
          description={hasExistingWallet ? 'Open the wallet linked to this account.' : 'Open your wallet with its password.'}
          onPress={() => handleModeChange('retrieve')}
        />
        <GelOption
          icon="key"
          tone={PURPLE}
          title="Import a wallet"
          description="Use a private key from another wallet."
          onPress={() => handleModeChange('import')}
        />
      </View>
    </GelModal>
  );
};

export default ConnectButton;