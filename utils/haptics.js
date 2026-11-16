import { NativeModules, Platform } from 'react-native';

/**
 * Light haptic ticks for navigation chrome. Safe on every build: if the
 * native module isn't linked in the installed binary (e.g. an OTA JS update
 * on an older APK), every call is a silent no-op.
 */
let impl = null;
try {
  if (NativeModules.RNHapticFeedback || NativeModules.RNHapticFeedbackModule) {
    // eslint-disable-next-line global-require
    impl = require('react-native-haptic-feedback').default;
  }
} catch {
  impl = null;
}

const OPTIONS = { enableVibrateFallback: false, ignoreAndroidSystemSettings: false };

const fire = (type) => {
  if (!impl) return;
  try {
    impl.trigger(type, OPTIONS);
  } catch {
    /* never let feedback break a tap */
  }
};

export const haptics = {
  /** Tab / button selection. */
  tap: () => fire(Platform.OS === 'ios' ? 'selection' : 'clockTick'),
  /** Opening a panel or sheet. */
  open: () => fire('impactLight'),
  /** Something succeeded. */
  success: () => fire('notificationSuccess'),
};
