// Blocks APKs older than the last two builds (45 = 1.0.8, 46 = 1.2). Older builds are deprecated: they
// miss security fixes and the encrypted wallet, so they are asked to install the newest APK.
import React from 'react';
import { Platform, View, Text, Pressable, Linking, Image } from 'react-native';

export const MIN_NATIVE_BUILD = 45; // the two newest builds (45, 46) keep getting updates
export const APK_URL = 'https://expo.dev/artifacts/eas/Q2385iBn-h5Wle32oDRBkC_FrvANXme-O-Rz0lErlFQ.apk'; // build 46 (v1.2)

// Startup-safe: any failure means "don't block".
export function isDeprecatedBuild() {
  if (Platform.OS !== 'android') return false;
  try {
    const Application = require('expo-application');
    const code = parseInt(Application?.nativeBuildVersion, 10);
    return Number.isFinite(code) && code > 0 && code < MIN_NATIVE_BUILD;
  } catch {
    return false;
  }
}

export default function UpdateRequired() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0d0b14', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <Image source={require('../assets/icon.png')} style={{ width: 96, height: 96, borderRadius: 26, marginBottom: 24 }} />
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>
        Update required
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 }}>
        This version of SempaiHQ is no longer supported. Install the latest version to keep reading, earning and using your wallet. Your account and wallet stay the same.
      </Text>
      <Pressable
        onPress={() => Linking.openURL(APK_URL).catch(() => {})}
        accessibilityRole="button"
        style={({ pressed }) => ({
          backgroundColor: '#9B59B6', paddingVertical: 16, paddingHorizontal: 36, borderRadius: 999,
          opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Download the latest version</Text>
      </Pressable>
      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', marginTop: 18 }}>
        Or use the web app at app.sempaihq.com
      </Text>
    </View>
  );
}
