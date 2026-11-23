import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useBazaarTheme } from '../styles/BazaarStyles';
import { BAZAAR_AUTHOR_SHARE_PCT, BAZAAR_LEND_PRICE_SMP, BAZAAR_TIERS } from '../utils/bazaar';
import { toast } from '../components/Toast';
import { GelGate } from '../components/gel/GelGate';

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

const base64ToArrayBuffer = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Turn raw Supabase/storage errors into something a user can act on.
const friendlyUploadError = (err) => {
  const msg = String(err?.message || err || '');
  const lower = msg.toLowerCase();

  if (lower.includes('row-level security') || lower.includes('row security') || lower.includes('42501')) {
    return 'You need to be signed in to publish a book. Please sign out and sign back in with Google, then try again.';
  }
  if (lower.includes('jwt') || lower.includes('session') || lower.includes('401') || lower.includes('403')) {
    return 'Your session has expired. Please sign out and sign back in, then try again.';
  }
  if (lower.includes('file upload failed')) {
    if (lower.includes('payload') || lower.includes('size') || lower.includes('too large')) {
      return 'The file is too large. Please choose a book under 50MB.';
    }
    if (lower.includes('mime') || lower.includes('type')) {
      return 'That file type is not supported. Please upload a PDF or EPUB.';
    }
    if (lower.includes('duplicate') || lower.includes('already exists')) {
      return 'A file with that name was already uploaded. Please try again.';
    }
    return 'The book file could not be uploaded. Check your internet connection and try again.';
  }
  if (lower.includes('failed to save book')) {
    return 'The book details could not be saved. Please try again — if it keeps failing, contact support.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout')) {
    return 'Network problem. Check your connection and try again.';
  }
  return 'Something went wrong while publishing. Please try again.';
};

const UploadBookScreen = () => {
  const { colors: BAZAAR_COLORS, styles } = useBazaarTheme();
  const navigation = useNavigation();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const activePublicKey = wallet?.publicKey;
  const insets = useSafeAreaInsets();
  // Clear the floating GlobalBottomNav (68px) so the publish button stays tappable.
  const bottomNavClearance = Math.max(insets.bottom, 8) + 12 + 68 + 8;

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState(null); // { uri, arrayBuffer, name }
  const [bookFile, setBookFile] = useState(null); // { uri, name, size, type }
  const [ownRights, setOwnRights] = useState(false);
  const [allowLending, setAllowLending] = useState(true);
  const [tier, setTier] = useState(BAZAAR_TIERS[0]); // { price, copies }
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      if (!activePublicKey) {
        setLoadingUser(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('users')
          .select('id, name, wallet_address')
          .eq('wallet_address', activePublicKey.toString())
          .maybeSingle();
        setUser(data || null);
        if (data?.name) setAuthorName(data.name);
      } catch (e) {
        console.error('[UploadBook] user fetch failed:', e.message);
      } finally {
        setLoadingUser(false);
      }
    };
    loadUser();
  }, [activePublicKey]);

  const pickCover = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission needed — Allow photo access to choose a cover image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [2, 3],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setCover({
        uri: asset.uri,
        arrayBuffer: base64ToArrayBuffer(base64),
        name: `cover-${Date.now()}.jpg`,
      });
    } catch (err) {
      console.error('[UploadBook] cover pick error:', err.message);
      toast.error('Failed to select image.');
    }
  };

  const pickBookFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/epub+zip', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const ext = (asset.name || '').split('.').pop().toLowerCase();
      const type = ext === 'pdf' ? 'pdf' : ext === 'epub' ? 'epub' : null;
      if (!type) {
        toast.error('Unsupported file — Please choose a PDF or EPUB file.');
        return;
      }
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        toast.error('File too large — Books must be 50MB or smaller.');
        return;
      }
      setBookFile({ uri: asset.uri, name: asset.name, size: asset.size || 0, type });
    } catch (err) {
      console.error('[UploadBook] file pick error:', err.message);
      toast.error('Failed to select file.');
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Sign in required — Connect your wallet and make sure your account exists.');
      return;
    }
    if (!title.trim()) {
      toast.error('Missing title — Please enter a book title.');
      return;
    }
    if (!bookFile) {
      toast.error('Missing file — Please choose a PDF or EPUB file.');
      return;
    }
    if (!ownRights && !allowLending) {
      toast.info('Pick an option — Enable at least one: sell your book or allow lending.');
      return;
    }

    // Storage + table RLS key off the Supabase Auth session (Google sign-in),
    // not the wallet. Catch a missing/mismatched session before uploading.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Sign in required — Publishing needs an active Google sign-in session. Please sign out and sign back in with the Google account linked to your profile, then try again.');
      return;
    }
    if (user.id && session.user?.id && user.id !== session.user.id) {
      // Older accounts have a profile id that predates Google sign-in; the
      // server confirms it's theirs by their own sign-in email.
      const { data: legacyId } = await supabase.rpc('my_user_id_by_email');
      if (legacyId !== user.id) {
        toast.info(`Wrong Google account — you're signed in as ${session.user?.email}, but this wallet belongs to a different account. Sign out and sign in with the Google account linked to this wallet.`);
        return;
      }
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const safeName = bookFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/${timestamp}-${safeName}`;

      // Upload book file
      const base64 = await FileSystem.readAsStringAsync(bookFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const { error: fileError } = await supabase.storage
        .from('bazaar-books')
        .upload(filePath, base64ToArrayBuffer(base64), {
          contentType: bookFile.type === 'pdf' ? 'application/pdf' : 'application/epub+zip',
          upsert: false,
        });
      if (fileError) throw new Error(`File upload failed: ${fileError.message}`);

      // Upload cover (optional)
      let coverUrl = null;
      if (cover) {
        const coverPath = `${user.id}/${timestamp}-cover.jpg`;
        const { error: coverError } = await supabase.storage
          .from('bazaar-covers')
          .upload(coverPath, cover.arrayBuffer, { contentType: 'image/jpeg', upsert: false });
        if (!coverError) {
          coverUrl = supabase.storage.from('bazaar-covers').getPublicUrl(coverPath).data.publicUrl;
        }
      }

      // Insert book row with consent record
      const { error: insertError } = await supabase.from('bazaar_books').insert({
        author_id: user.id,
        title: title.trim(),
        author_name: authorName.trim() || user.name || 'Unknown',
        description: description.trim() || null,
        cover_url: coverUrl,
        file_path: filePath,
        file_name: bookFile.name,
        file_type: bookFile.type,
        file_size: bookFile.size,
        price_usd: tier.price,
        max_copies: tier.copies,
        author_share_pct: BAZAAR_AUTHOR_SHARE_PCT,
        ownership_confirmed: ownRights,
        sale_enabled: ownRights,
        lending_enabled: allowLending,
        lend_price_smp: BAZAAR_LEND_PRICE_SMP,
        status: 'active',
        terms_accepted_at: new Date().toISOString(),
        ip_attestation: ownRights
          ? `Author confirms they own or control the rights to "${title.trim()}" and grant Sempai HQ a non-exclusive license to distribute it in the Bazaar.`
          : `Uploader does not claim ownership of "${title.trim()}". Listed for lending only (${BAZAAR_LEND_PRICE_SMP} SMP to platform).`,
      });
      if (insertError) throw new Error(`Failed to save book: ${insertError.message}`);

      toast.success('Published — Your book is now live in the Bazaar!');
      navigation.goBack();
    } catch (err) {
      console.error('[UploadBook] Submit error:', err.message);
      toast.error(`Upload failed — ${friendlyUploadError(err)}`);
    } finally {
      setUploading(false);
    }
  };

  if (loadingUser) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BAZAAR_COLORS.accent} />
        </View>
      </View>
    );
  }

  if (!user) {
    return <GelGate icon="cloud-upload-alt" headerTitle="Upload a book" subtitle="Connect a wallet to publish a book in the Bazaar." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Book</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomNavClearance }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Cover image (optional)</Text>
        <TouchableOpacity style={styles.filePicker} onPress={pickCover}>
          {cover ? (
            <Image source={{ uri: cover.uri }} style={{ width: 44, height: 66, borderRadius: 6 }} resizeMode="cover" />
          ) : (
            <Ionicons name="image-outline" size={28} color={BAZAAR_COLORS.textMuted} />
          )}
          <Text style={styles.filePickerText}>
            {cover ? 'Cover selected — tap to change' : 'Tap to choose a cover image'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Book file (PDF or EPUB, max 50MB)</Text>
        <TouchableOpacity style={styles.filePicker} onPress={pickBookFile}>
          <Ionicons
            name={bookFile?.type === 'pdf' ? 'document-text-outline' : 'book-outline'}
            size={28}
            color={bookFile ? BAZAAR_COLORS.accent : BAZAAR_COLORS.textMuted}
          />
          <Text style={styles.filePickerText} numberOfLines={2}>
            {bookFile ? `${bookFile.name} (${(bookFile.size / 1048576).toFixed(1)} MB)` : 'Tap to choose a PDF or EPUB file'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Book title"
          placeholderTextColor={BAZAAR_COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Author name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name or pen name"
          placeholderTextColor={BAZAAR_COLORS.textMuted}
          value={authorName}
          onChangeText={setAuthorName}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          placeholder="What is this book about?"
          placeholderTextColor={BAZAAR_COLORS.textMuted}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <View style={{ backgroundColor: BAZAAR_COLORS.bgCard, borderRadius: 14, borderWidth: 1, borderColor: BAZAAR_COLORS.border, padding: 16, marginTop: 20 }}>
          <Text style={styles.payTitle}>How the Bazaar works</Text>
          <Text style={styles.splitNote}>
            <Text style={{ color: BAZAAR_COLORS.accent, fontWeight: '700' }}>Sell</Text> — if you own the book, sell a limited edition
            for $1 (100 copies) or $3 (50 copies). You receive {BAZAAR_AUTHOR_SHARE_PCT}% of every sale directly to your wallet.{"\n\n"}
            <Text style={{ color: BAZAAR_COLORS.gold, fontWeight: '700' }}>Lend</Text> — anyone can offer a book for borrowing at a flat {BAZAAR_LEND_PRICE_SMP.toLocaleString()} SMP.
            The full amount goes to the platform; you earn nothing from lends.{"\n\n"}
            If you don't own the book, only lending is allowed.
          </Text>
        </View>

        <Text style={[styles.label, { marginTop: 20 }]}>Edition</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {BAZAAR_TIERS.map((t) => {
            const on = tier.price === t.price;
            return (
              <TouchableOpacity
                key={t.price}
                onPress={() => setTier(t)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`$${t.price} edition, only ${t.copies} copies`}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? BAZAAR_COLORS.accent : BAZAAR_COLORS.border,
                  backgroundColor: on ? 'rgba(243, 99, 22, 0.12)' : BAZAAR_COLORS.bgCard,
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: '800', color: on ? BAZAAR_COLORS.accent : BAZAAR_COLORS.textPrimary }}>
                  ${t.price}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: BAZAAR_COLORS.textPrimary, marginTop: 4 }}>
                  Only {t.copies} copies
                </Text>
                <Text style={{ fontSize: 12, color: BAZAAR_COLORS.textMuted, marginTop: 2, textAlign: 'center' }}>
                  You earn ${(t.price * BAZAAR_AUTHOR_SHARE_PCT / 100).toFixed(2)} a sale · up to ${(t.price * t.copies * BAZAAR_AUTHOR_SHARE_PCT / 100).toFixed(0)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.splitNote, { marginTop: 8 }]}>
          When every copy is taken (bought or borrowed), the book shows as sold out. A refunded copy goes back on the shelf.
        </Text>

        <TouchableOpacity style={styles.checkboxRow} onPress={() => setOwnRights(!ownRights)}>
          <View style={[styles.checkbox, ownRights && styles.checkboxChecked]}>
            {ownRights && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.checkboxLabel}>
            I own or control the rights to this book — sell it for ${tier.price} (only {tier.copies} copies,
            {' '}{BAZAAR_AUTHOR_SHARE_PCT}% to me).
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkboxRow} onPress={() => setAllowLending(!allowLending)}>
          <View style={[styles.checkbox, allowLending && styles.checkboxChecked]}>
            {allowLending && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.checkboxLabel}>
            Allow others to borrow this book for {BAZAAR_LEND_PRICE_SMP.toLocaleString()} SMP (one-time, permanent access).
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, ((!ownRights && !allowLending) || uploading) && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={uploading || (!ownRights && !allowLending)}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Publish to Bazaar</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default UploadBookScreen;
