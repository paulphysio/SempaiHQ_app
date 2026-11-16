import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { EmptyState } from './ui';
import { useOnline } from '../hooks/useOnline';

/*
 * Per-screen crash guard. If a screen throws while rendering, only that
 * screen shows a recovery card — the rest of the app (navigation, other
 * screens, the bottom bar) keeps working. Offline-aware wording.
 */

const Fallback = ({ error, onRetry, onBack, canGoBack }) => {
  const { colors } = useTheme();
  const online = useOnline();
  const offline = online === false;
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <EmptyState
        icon={offline ? 'wifi' : 'tools'}
        title={offline ? 'This page needs a connection' : 'Something went wrong'}
        subtitle={
          offline
            ? 'You’re offline. Your saved stories still work — try this page again once you’re back online.'
            : 'This page hit a snag. Your data is safe — try again, or go back.'
        }
        action="Try again"
        onAction={onRetry}
      />
      {canGoBack ? (
        <Text style={[styles.back, { color: colors.accent }]} onPress={onBack} accessibilityRole="button">
          Go back
        </Text>
      ) : null}
      {__DEV__ && error ? <Text style={[styles.dev, { color: colors.textMuted }]} numberOfLines={4}>{String(error?.message || error)}</Text> : null}
    </View>
  );
};

class ScreenBoundary extends React.Component {
  state = { error: null, attempt: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[ScreenBoundary] ${this.props.name || 'screen'} crashed:`, error?.message || error, info?.componentStack);
  }

  retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  back = () => {
    const nav = this.props.navigation;
    this.setState({ error: null });
    if (nav?.canGoBack?.()) nav.goBack();
    else nav?.navigate?.('Home');
  };

  render() {
    if (this.state.error) {
      return (
        <Fallback
          error={this.state.error}
          onRetry={this.retry}
          onBack={this.back}
          canGoBack={!!this.props.navigation?.canGoBack?.()}
        />
      );
    }
    // `attempt` remounts the screen fresh on "Try again".
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

const cache = new WeakMap();

/** Wrap a screen component (stable identity per component). */
export const withScreenBoundary = (Screen, name) => {
  if (!Screen) return Screen;
  if (cache.has(Screen)) return cache.get(Screen);
  const Guarded = (props) => (
    <ScreenBoundary name={name} navigation={props.navigation}>
      <Screen {...props} />
    </ScreenBoundary>
  );
  Guarded.displayName = `Guarded(${name || Screen.displayName || Screen.name || 'Screen'})`;
  cache.set(Screen, Guarded);
  return Guarded;
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  back: { textAlign: 'center', fontSize: 15, fontWeight: '800', marginTop: 4 },
  dev: { textAlign: 'center', fontSize: 11, marginTop: 16, paddingHorizontal: 24 },
});

export default ScreenBoundary;
