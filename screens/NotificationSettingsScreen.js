// Choose which phone notifications you get. Saved on the server (reader-actions → notification_prefs),
// so it applies to every device and the server never sends a muted category.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, Platform, Linking, AppState, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../context/ThemeContext';
import { GelGlass, GelButton } from '../components/gel/GelKit';
import { GelPageHeader } from '../components/gel/GelGate';
import GelOrb from '../components/nav/GelOrb';
import { toast } from '../components/Toast';
import { readerAction } from '../services/readerActions';

const GROUPS = [
  { key: 'messages', icon: 'comment-dots', title: 'Messages', desc: 'When someone sends you a private message' },
  { key: 'community', icon: 'users', title: 'Community chat', desc: 'When someone replies to you in Community' },
  { key: 'social', icon: 'heart', title: 'Likes, replies & followers', desc: 'Crazy Corner likes and replies, new followers, posts from people you follow, comments on your work' },
  { key: 'releases', icon: 'book-open', title: 'New releases', desc: 'New novels and manga, and new chapters of what you read' },
  { key: 'bazaar', icon: 'store', title: 'Bazaar', desc: 'When a new book lands in the Bazaar' },
  { key: 'kaiji', icon: 'chess-knight', title: 'Kaiji', desc: 'Open games, challenges, tournaments and your match results' },
  { key: 'money', icon: 'coins', title: 'Sales & earnings', desc: 'When your book sells or is borrowed' },
  { key: 'announcements', icon: 'bullhorn', title: 'Announcements', desc: 'News from SempaiHQ and the creators you follow' },
];

export default function NotificationSettingsScreen() {
  const { colors, isDark } = useTheme();
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(null);
  const [perm, setPerm] = useState(null); // granted | denied | undetermined | web

  const checkPerm = useCallback(async () => {
    if (Platform.OS === 'web') return setPerm('web');
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPerm(status);
    } catch {
      setPerm(null);
    }
  }, []);

  useEffect(() => {
    checkPerm();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && checkPerm()); // back from phone settings
    readerAction('notif_prefs_get').then((res) => {
      if (res?.ok === false) {
        toast.error(res.error || 'Could not load your settings');
        setPrefs(Object.fromEntries(GROUPS.map((g) => [g.key, true])));
      } else setPrefs((res?.data || res)?.prefs || Object.fromEntries(GROUPS.map((g) => [g.key, true])));
    });
    return () => sub.remove();
  }, [checkPerm]);

  const flip = async (key, on) => {
    const before = prefs;
    setPrefs({ ...prefs, [key]: on });
    setSaving(key);
    const res = await readerAction('notif_prefs_set', { prefs: { [key]: on } });
    setSaving(null);
    if (res?.ok === false) {
      setPrefs(before);
      toast.error(res.error || 'Could not save — try again');
    }
  };

  const askPermission = async () => {
    if (perm === 'denied') return Linking.openSettings();
    const { status } = await Notifications.requestPermissionsAsync();
    setPerm(status);
  };

  const allOn = prefs && GROUPS.every((g) => prefs[g.key] !== false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GelPageHeader title="Notifications" subtitle="Choose what reaches your phone" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 130 }}>
        {perm && perm !== 'granted' && perm !== 'web' ? (
          <GelGlass radius={24} glow padding={16} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View pointerEvents="none"><GelOrb icon="bell-slash" size={44} lit tone="#F59E0B" breathe={false} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 15 }}>Notifications are off on this phone</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 }}>
                  Your choices below are saved, but nothing can arrive until you allow notifications for SempaiHQ.
                </Text>
              </View>
            </View>
            <GelButton label={perm === 'denied' ? 'Open phone settings' : 'Allow notifications'} icon="bell" onPress={askPermission} style={{ marginTop: 12 }} small />
          </GelGlass>
        ) : null}
        {perm === 'web' ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12, marginHorizontal: 4 }}>
            Phone notifications come from the SempaiHQ app. These settings apply to every phone you're signed in on.
          </Text>
        ) : null}

        <GelGlass radius={28} glow={false} padding={6}>
          {!prefs ? (
            <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={colors.accent} /></View>
          ) : (
            GROUPS.map((g, i) => {
              const on = prefs[g.key] !== false;
              return (
                <View
                  key={g.key}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12,
                    borderTopWidth: i ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : `rgba(${colors.accentRgb},0.10)`,
                  }}
                >
                  <View pointerEvents="none"><GelOrb icon={g.icon} size={38} lit={on} breathe={false} iconSize={14} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 15 }}>{g.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: 2 }}>{g.desc}</Text>
                  </View>
                  {saving === g.key ? <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 4 }} /> : null}
                  <Switch
                    value={on}
                    onValueChange={(v) => flip(g.key, v)}
                    trackColor={{ false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.15)', true: colors.accent }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.15)'}
                    accessibilityLabel={`${g.title} notifications`}
                  />
                </View>
              );
            })
          )}
        </GelGlass>
        {prefs && !allOn ? (
          <Text style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 10, marginHorizontal: 4 }}>
            Muted categories still show up in your in-app bell — they just won't buzz your phone.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
