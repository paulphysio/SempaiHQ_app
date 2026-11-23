import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { GelModal } from './GelKit';

/*
 * gelAlert — drop-in for React Native's Alert.alert, drawn as a bubbly
 * GelModal (and it works on the web, where Alert.alert does nothing).
 *
 *   gelAlert('Delete chapter?', 'This cannot be undone.', [
 *     { text: 'Cancel', style: 'cancel' },
 *     { text: 'Delete', style: 'destructive', onPress: remove },
 *   ]);
 *
 * Buttons: style 'cancel' → quiet, 'destructive' → red, otherwise the last
 * one is the main (orange) action. No buttons → a single "OK".
 * Options: { cancelable } (default true when there's a cancel button),
 *          { icon } FontAwesome5 name to show in the orb.
 */
let push = null;
const queue = [];

export function gelAlert(title, message, buttons, options = {}) {
  const item = {
    id: Date.now() + Math.random(),
    title: title || '',
    message: message || '',
    buttons: buttons?.length ? buttons : [{ text: 'OK' }],
    options: options || {},
  };
  if (push) push(item);
  else queue.push(item); // host not mounted yet — shown as soon as it is
}

const guessIcon = (title, buttons) => {
  if (buttons.some((b) => b.style === 'destructive')) return 'exclamation-triangle';
  const t = String(title).toLowerCase();
  if (/error|fail|couldn|could not|invalid|denied|wrong/.test(t)) return 'exclamation-circle';
  if (/success|done|saved|sent|unlocked|welcome/.test(t)) return 'check';
  if (/wallet|connect/.test(t)) return 'wallet';
  if (/delete|remove/.test(t)) return 'trash';
  if (/sign in|account/.test(t)) return 'user';
  return 'info';
};

export function GelAlertHost() {
  const { colors } = useTheme();
  const [items, setItems] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    push = (item) => {
      setItems((cur) => [...cur, item]);
      setVisible(true);
    };
    if (queue.length) {
      setItems((cur) => [...cur, ...queue.splice(0)]);
      setVisible(true);
    }
    return () => { push = null; };
  }, []);

  const current = items[0];
  const finish = (btn) => {
    setVisible(false);
    // let the close animation play, then run the action and show the next alert
    setTimeout(() => {
      setItems((cur) => cur.slice(1));
      if (items.length > 1) setVisible(true);
      try { btn?.onPress?.(); } catch (e) { console.warn('[gelAlert] button failed:', e?.message); }
    }, 180);
  };

  if (!current) return null;
  const { title, message, buttons, options } = current;
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const cancelable = options.cancelable ?? !!cancelBtn;
  const destructive = buttons.some((b) => b.style === 'destructive');
  // order: cancel first (left), main action last (right)
  const ordered = [...buttons].sort((a, b) => (a.style === 'cancel' ? -1 : b.style === 'cancel' ? 1 : 0));
  const actions = ordered.map((b, i) => ({
    label: b.text || 'OK',
    variant: b.style === 'destructive' ? 'danger' : b.style === 'cancel' ? 'secondary' : i === ordered.length - 1 ? 'primary' : 'secondary',
    onPress: () => finish(b),
  }));

  return (
    <GelModal
      visible={visible}
      onClose={() => finish(cancelBtn)}
      dismissable={cancelable}
      showClose={false}
      title={title}
      icon={options.icon || guessIcon(title, buttons)}
      tone={destructive ? '#E5484D' : undefined}
      actions={actions}
      maxWidth={400}
    >
      {message ? (
        <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 }}>
          {message}
        </Text>
      ) : null}
    </GelModal>
  );
}
