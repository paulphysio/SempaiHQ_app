/*
 * "Secure my wallet" — one guided flow for:
 *   create  : a brand-new wallet
 *   upgrade : move off an old wallet (its key was stored the old, unsafe way)
 *   restore : forgot password / new phone → 12 recovery words + new password
 *
 * The wallet password and the 12 words never leave the phone. Android offers
 * to save the password in Google Password Manager (autofill hints below).
 */
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Clipboard,
  ActivityIndicator, Platform, useWindowDimensions,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Connection, Keypair } from '@solana/web3.js';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GelModal, GelButton } from '../gel/GelKit';
import { toast } from '../Toast';
import { EmbeddedWalletContext } from '../ConnectButtonEnhanced';
import {
  newRecoveryWords, walletFromRecoveryWords, isValidRecoveryWords, MIN_PASSWORD_LENGTH,
} from '../../services/walletVault';
import { moveAllFunds } from '../../services/walletMove';
import { RPC_URL } from '../../constants';

const short = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '' };
  let s = 0;
  if (pw.length >= MIN_PASSWORD_LENGTH) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const label = s <= 1 ? 'Too weak' : s === 2 ? 'Okay' : s === 3 ? 'Good' : 'Strong';
  return { score: Math.min(s, 4), label };
}

// Three positions to confirm, each with 4 choices
function makeQuiz(words) {
  const picks = [...Array(12).keys()].sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => a - b);
  return picks.map((i) => {
    const decoys = words.filter((w, j) => j !== i).sort(() => Math.random() - 0.5).slice(0, 3);
    return { index: i, answer: words[i], options: [words[i], ...decoys].sort(() => Math.random() - 0.5) };
  });
}

export default function SecureWalletFlow({ visible, mode = 'create', onClose, onDone }) {
  const { colors, isDark } = useTheme();
  const { height: winH } = useWindowDimensions();
  const { user } = useAuth();
  const wallet = useContext(EmbeddedWalletContext);
  const s = useMemo(() => makeStyles({
    ...colors,
    inputWell: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
    inputRim: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(' + colors.accentRgb + ',0.18)',
  }), [colors, isDark]);

  const startStep = mode === 'upgrade' ? 'intro' : mode === 'restore' ? 'enterWords' : 'password';
  const [step, setStep] = useState(startStep);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [words, setWords] = useState([]);
  const [saved, setSaved] = useState(false);
  const [quiz, setQuiz] = useState([]);
  const [answers, setAnswers] = useState({});
  const [typedWords, setTypedWords] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const busy = useRef(false);

  useEffect(() => {
    if (visible) {
      setStep(startStep); setPassword(''); setConfirm(''); setWords([]); setSaved(false);
      setQuiz([]); setAnswers({}); setTypedWords(''); setProgress(''); setError(''); setSummary(null);
    }
  }, [visible, mode]);

  const strength = passwordStrength(password);
  const passwordOk = password.length >= MIN_PASSWORD_LENGTH && password === confirm && strength.score >= 2;

  const goWords = () => {
    if (!passwordOk) return;
    if (mode === 'restore') { run(); return; }
    // Never replace words once shown: funds may already be on their way to
    // that wallet after a failed attempt.
    if (words.length) { setStep('words'); return; }
    const w = newRecoveryWords();
    setWords(w); setQuiz(makeQuiz(w)); setAnswers({}); setSaved(false);
    setStep('words');
  };

  const quizOk = quiz.length === 3 && quiz.every((q) => answers[q.index] === q.answer);

  // The wallet maths is heavy and runs on the JS thread; give the screen a
  // moment to draw the progress before each heavy step so it never looks frozen.
  const paint = () => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60))));
  const say = async (text) => { setProgress(text); await paint(); };

  async function run() {
    if (busy.current) return;
    busy.current = true;
    setError(''); setProgress('Getting started…'); setStep('working');
    try {
      await paint();
      if (mode === 'restore') {
        await say('Checking your recovery words…');
        await wallet.restoreWithRecoveryWords(typedWords, password);
        setSummary({ address: null, restored: true });
      } else {
        await say('Creating your new wallet…');
        const { secretKey, address } = await walletFromRecoveryWords(words);
        let move = null;
        if (mode === 'upgrade') {
          await say('Unlocking your old wallet…');
          const legacy = await wallet.loadLegacyWalletKey();
          if (legacy?.secretKey) {
            const from = Keypair.fromSecretKey(legacy.secretKey);
            if (from.publicKey.toString() !== address) {
              const connection = new Connection(RPC_URL, 'confirmed');
              move = await moveAllFunds({ connection, from, to: address, onProgress: setProgress });
            }
          }
        }
        await say('Locking it with your password… (this takes a few seconds)');
        await wallet.secureNewWallet({ secretKey, password });
        setSummary({ address, move });
      }
      setStep('done');
    } catch (e) {
      const msg = e?.message || 'Something went wrong.';
      if (mode === 'restore') {
        setError(msg);
        setStep('enterWords');
      } else {
        // Same words, same new wallet — anything already moved is safe in it.
        setError(`${msg} Your 12 words still control your new wallet — tap the button to try again.`);
        setStep('confirm');
      }
    } finally {
      busy.current = false;
    }
  }

  const closeable = step !== 'working';
  const title = mode === 'restore' ? 'Restore your wallet' : mode === 'upgrade' ? 'Secure your wallet' : 'Create your wallet';

  return (
    <GelModal
      visible={visible}
      onClose={closeable && step !== 'done' ? onClose : undefined}
      dismissable={closeable && step !== 'done'}
      variant="sheet"
      icon="shield-alt"
      title={title}
      maxWidth={520}
    >
        <ScrollView style={{ maxHeight: winH * 0.66 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {!!error && (
            <View style={s.errorBox}><FontAwesome5 name="exclamation-circle" size={14} color={colors.danger} /><Text style={s.errorText}>{error}</Text></View>
          )}

          {step === 'intro' && (
            <>
              <Text style={s.lead}>Let’s move you to a safer wallet.</Text>
              <Text style={s.p}>
                Older SempaiHQ wallets were stored in a way that is no longer safe, and some were taken by an attacker.
                Your new wallet is locked with a password only you know — not even SempaiHQ can open it.
              </Text>
              <Bullet s={s} colors={colors} icon="coins" text="Your tokens and SOL move to the new wallet automatically" />
              <Bullet s={s} colors={colors} icon="book-open" text="Your unlocked chapters, purchases and history come with you" />
              <Bullet s={s} colors={colors} icon="fingerprint" text="Everyday use stays one tap — this phone remembers it securely" />
              <View style={s.gap} />
              <GelButton label="Secure my wallet" icon="shield-alt" onPress={() => setStep('password')} />
              <View style={s.gapSm} />
              <GelButton variant="ghost" label="Not now" onPress={onClose} />
            </>
          )}

          {step === 'password' && (
            <>
              <Text style={s.lead}>Create your wallet password</Text>
              <Text style={s.p}>
                It locks your wallet on this phone. When Google offers to save it, tap <Text style={s.bold}>Save</Text> — then
                it fills itself in on any new phone.
              </Text>
              {/* Lets Google Password Manager file the password under this account */}
              <TextInput value={user?.email || ''} editable={false} autoComplete="username" textContentType="username"
                importantForAutofill="yes" style={s.hiddenUser} />
              <Text style={s.label}>Wallet password</Text>
              <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                placeholderTextColor={colors.textFaint} autoComplete="new-password" textContentType="newPassword"
                importantForAutofill="yes" autoCapitalize="none" style={s.input} />
              {!!password && (
                <View style={s.meterRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[s.meterBar, { backgroundColor: i < strength.score ? (strength.score >= 3 ? colors.success : colors.warning) : colors.border }]} />
                  ))}
                  <Text style={s.meterLabel}>{strength.label}</Text>
                </View>
              )}
              <Text style={s.label}>Confirm password</Text>
              <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Type it again"
                placeholderTextColor={colors.textFaint} autoComplete="new-password" textContentType="newPassword"
                importantForAutofill="yes" autoCapitalize="none" style={s.input} />
              {!!confirm && confirm !== password && <Text style={s.hint}>Passwords don’t match yet.</Text>}
              <View style={s.gap} />
              <GelButton label="Continue" onPress={goWords} disabled={!passwordOk} />
            </>
          )}

          {step === 'words' && (
            <>
              <Text style={s.lead}>Your 12 recovery words</Text>
              <Text style={s.p}>
                These words ARE your wallet. With them you can always get it back — here, or in Phantom — even if you
                forget your password or lose your phone. Anyone who has them can take your funds, so keep them private.
              </Text>
              <View style={s.grid}>
                {words.map((w, i) => (
                  <View key={i} style={s.wordCell}><Text style={s.wordNum}>{i + 1}</Text><Text style={s.word}>{w}</Text></View>
                ))}
              </View>
              <GelButton variant="ghost" label="Copy words (then paste into your password manager)" icon="copy"
                onPress={() => { Clipboard.setString(words.join(' ')); toast.info('Copied — paste them somewhere safe, then clear your clipboard'); }} />
              <Pressable onPress={() => setSaved((v) => !v)} style={s.checkRow}>
                <FontAwesome5 name={saved ? 'check-square' : 'square'} size={18} color={saved ? colors.accent : colors.textMuted} />
                <Text style={s.checkText}>I’ve saved my 12 words somewhere safe</Text>
              </Pressable>
              <GelButton label="Continue" onPress={() => setStep('confirm')} disabled={!saved} />
            </>
          )}

          {step === 'confirm' && (
            <>
              <Text style={s.lead}>Quick check</Text>
              <Text style={s.p}>Tap the right word for each number.</Text>
              {quiz.map((q) => (
                <View key={q.index} style={s.quizBlock}>
                  <Text style={s.label}>Word #{q.index + 1}</Text>
                  <View style={s.optionRow}>
                    {q.options.map((o) => {
                      const picked = answers[q.index] === o;
                      return (
                        <Pressable key={o} onPress={() => setAnswers((a) => ({ ...a, [q.index]: o }))}
                          style={[s.option, picked && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
                          <Text style={[s.optionText, picked && { color: colors.accent }]}>{o}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              {Object.keys(answers).length === 3 && !quizOk && <Text style={s.hint}>Not quite — check your words and try again.</Text>}
              <View style={s.gap} />
              <GelButton label={mode === 'upgrade' ? 'Secure my wallet now' : 'Create my wallet'} icon="lock" onPress={run} disabled={!quizOk} />
              <View style={s.gapSm} />
              <GelButton variant="ghost" label="Show my words again" onPress={() => setStep('words')} />
            </>
          )}

          {step === 'enterWords' && (
            <>
              <Text style={s.lead}>Enter your 12 recovery words</Text>
              <Text style={s.p}>Type or paste them in order, separated by spaces.</Text>
              <TextInput value={typedWords} onChangeText={setTypedWords} multiline autoCapitalize="none" autoCorrect={false}
                placeholder="word1 word2 word3 …" placeholderTextColor={colors.textFaint}
                style={[s.input, { minHeight: 110, textAlignVertical: 'top' }]} />
              {!!typedWords && !isValidRecoveryWords(typedWords) && (
                <Text style={s.hint}>{typedWords.trim().split(/\s+/).length}/12 words — check spelling and order.</Text>
              )}
              <View style={s.gap} />
              <GelButton label="Continue" onPress={() => setStep('password')} disabled={!isValidRecoveryWords(typedWords)} />
            </>
          )}

          {step === 'working' && (
            <View style={s.center}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[s.lead, { textAlign: 'center', marginTop: 18 }]}>{progress || 'Working…'}</Text>
              <Text style={[s.p, { textAlign: 'center' }]}>Please keep the app open.</Text>
            </View>
          )}

          {step === 'done' && (
            <>
              <View style={s.center}>
                <View style={s.doneIcon}><FontAwesome5 name="check" size={26} color={colors.onAccent || '#fff'} /></View>
                <Text style={[s.lead, { textAlign: 'center' }]}>
                  {summary?.restored ? 'Wallet restored' : mode === 'upgrade' ? 'Your wallet is secure' : 'Your wallet is ready'}
                </Text>
                {!!summary?.address && <Text style={[s.p, { textAlign: 'center' }]}>New wallet: {short(summary.address)}</Text>}
              </View>
              {!!summary?.move && (
                <View style={s.card}>
                  <Text style={s.label}>Moved from your old wallet</Text>
                  {summary.move.moved.length === 0 && summary.move.solMoved === 0 && (
                    <Text style={s.p}>Nothing was left in the old wallet to move.</Text>
                  )}
                  {summary.move.moved.map((m) => <Text key={m.mint} style={s.p}>• {m.amount} ({m.mint.slice(0, 4)}…)</Text>)}
                  {summary.move.solMoved > 0 && <Text style={s.p}>• {summary.move.solMoved.toFixed(4)} SOL</Text>}
                  {summary.move.skipped.length > 0 && (
                    <Text style={[s.p, { color: colors.warning }]}>
                      {summary.move.skipped.length} item(s) couldn’t be moved{summary.move.lowSol ? ' (the old wallet had no SOL for the network fee)' : ''}.
                    </Text>
                  )}
                </View>
              )}
              <Text style={[s.p, { textAlign: 'center' }]}>
                If Google offered to save your password, make sure you tapped Save. Keep your 12 words safe.
              </Text>
              <View style={s.gap} />
              <GelButton label="Done" onPress={() => { onDone?.(summary); onClose?.(); }} />
            </>
          )}
        </ScrollView>
    </GelModal>
  );
}

const Bullet = ({ s, colors, icon, text }) => (
  <View style={s.bullet}><FontAwesome5 name={icon} size={14} color={colors.accent} style={{ width: 22 }} /><Text style={s.bulletText}>{text}</Text></View>
);

const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 48, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  headerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft, marginRight: 10 },
  title: { flex: 1, color: c.textPrimary, fontSize: 18, fontWeight: '800' },
  body: { paddingTop: 6, paddingBottom: 12 },
  lead: { color: c.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  p: { color: c.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  bold: { fontWeight: '800', color: c.textPrimary },
  label: { color: c.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: c.inputWell, borderWidth: 1, borderColor: c.inputRim, borderRadius: 25, paddingHorizontal: 18, paddingVertical: 13, color: c.textPrimary, fontSize: 16 },
  hiddenUser: { height: 1, width: 1, opacity: 0, position: 'absolute' },
  hint: { color: c.warning, fontSize: 13, marginTop: 6 },
  meterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  meterBar: { flex: 1, height: 4, borderRadius: 2, marginRight: 4 },
  meterLabel: { color: c.textMuted, fontSize: 12, marginLeft: 6, width: 64 },
  gap: { height: 22 },
  gapSm: { height: 10 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  bulletText: { flex: 1, color: c.textSecondary, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginVertical: 8 },
  wordCell: { width: '33.33%', padding: 4 },
  wordNum: { color: c.textFaint, fontSize: 11, marginBottom: 2 },
  word: { color: c.textPrimary, fontSize: 15, fontWeight: '700', backgroundColor: c.inputWell, borderRadius: 14, borderWidth: 1, borderColor: c.inputRim, paddingVertical: 9, paddingHorizontal: 10, overflow: 'hidden' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  checkText: { color: c.textPrimary, fontSize: 14, marginLeft: 10, flex: 1 },
  quizBlock: { marginBottom: 6 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  option: { margin: 4, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: c.inputRim, backgroundColor: c.inputWell },
  optionText: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
  center: { alignItems: 'center', paddingVertical: 30 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: c.success, marginBottom: 16 },
  card: { backgroundColor: c.inputWell, borderRadius: 18, borderWidth: 1, borderColor: c.inputRim, padding: 14, marginVertical: 12 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(229,72,77,0.08)', borderColor: c.danger, borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 14 },
  errorText: { color: c.danger, fontSize: 13, marginLeft: 8, flex: 1, lineHeight: 19 },
});
