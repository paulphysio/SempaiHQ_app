import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Modal from 'react-native-modal';
import { AnimatedPressable, usePulse } from '../utils/animations';

const WALLET_NAME = 'Sempai Wallet';
const WALLET_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function buildInjectedBridge(walletAddress) {
  return `
(function () {
  if (window.__sempaiWalletInstalled) return true;
  window.__sempaiWalletInstalled = true;

  ['log', 'warn', 'error'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments).map(function (a) {
        try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); }
      });
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', level: level, args: args }));
      orig.apply(console, arguments);
    };
  });

  var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function base58Decode(str) {
    var bytes = [0];
    for (var i = 0; i < str.length; i++) {
      var value = ALPHABET.indexOf(str[i]);
      if (value === -1) throw new Error('Invalid base58 character');
      var carry = value;
      for (var j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }
      while (carry > 0) {
        bytes.push(carry & 0xff);
        carry >>= 8;
      }
    }
    for (var k = 0; k < str.length && str[k] === '1'; k++) bytes.push(0);
    return new Uint8Array(bytes.reverse());
  }
  function bytesToB64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function b64ToBytes(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  var pendingId = 0;
  var pending = {};
  window.__sempaiResolve = function (id, payload) {
    var p = pending[id];
    if (!p) return;
    delete pending[id];
    if (payload && payload.error) p.reject(new Error(payload.error));
    else p.resolve(payload);
  };
  function callNative(type, data) {
    return new Promise(function (resolve, reject) {
      var id = ++pendingId;
      pending[id] = { resolve: resolve, reject: reject };
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, type: type, data: data }));
    });
  }

  var publicKeyBytes = base58Decode(${JSON.stringify(walletAddress)});
  var account = {
    address: ${JSON.stringify(walletAddress)},
    publicKey: publicKeyBytes,
    chains: ['solana:mainnet'],
    features: ['solana:signAndSendTransaction', 'solana:signTransaction'],
  };

  var listeners = {};

  var wallet = {
    version: '1.0.0',
    name: ${JSON.stringify(WALLET_NAME)},
    icon: ${JSON.stringify(WALLET_ICON)},
    chains: ['solana:mainnet'],
    accounts: [account],
    features: {
      'standard:connect': {
        version: '1.0.0',
        connect: function () { return Promise.resolve({ accounts: [account] }); },
      },
      'standard:disconnect': {
        version: '1.0.0',
        disconnect: function () { return Promise.resolve(); },
      },
      'standard:events': {
        version: '1.0.0',
        on: function (event, cb) {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
          return function () {
            listeners[event] = listeners[event].filter(function (f) { return f !== cb; });
          };
        },
      },
      'solana:signAndSendTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        signAndSendTransaction: function () {
          var inputs = Array.prototype.slice.call(arguments);
          console.log('[bridge] signAndSendTransaction called, inputs:', inputs.length);
          return Promise.all(inputs.map(function (input) {
            var txB64 = bytesToB64(input.transaction);
            return callNative('signAndSendTransaction', { transaction: txB64 }).then(function (result) {
              return { signature: b64ToBytes(result.signature) };
            });
          }));
        },
      },
      'solana:signTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        signTransaction: function () {
          var inputs = Array.prototype.slice.call(arguments);
          console.log('[bridge] signTransaction called, inputs:', inputs.length);
          return Promise.all(inputs.map(function (input) {
            var txB64 = bytesToB64(input.transaction);
            return callNative('signTransaction', { transaction: txB64 }).then(function (result) {
              return { signedTransaction: b64ToBytes(result.signedTransaction) };
            });
          }));
        },
      },
    },
  };

  function register() {
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', {
      detail: function (api) { api.register(wallet); },
    }));
  }
  window.addEventListener('wallet-standard:app-ready', function (event) {
    event.detail.register(wallet);
  });
  register();

  true;
})();
`;
}

const AUTO_SELECT_SCRIPT = `
(function () {
  var tries = 0;
  var interval = setInterval(function () {
    tries++;
    var els = document.querySelectorAll('button, [role="button"], div');
    for (var i = 0; i < els.length; i++) {
      var text = (els[i].textContent || '').trim();
      if (text === ${JSON.stringify(WALLET_NAME)}) {
        els[i].click();
        clearInterval(interval);
        return;
      }
    }
    if (tries > 20) clearInterval(interval);
  }, 400);
  true;
})();
`;

const buildAutoFillAmountScript = (amount) => `
(function () {
  var target = ${JSON.stringify(String(amount))};
  var tries = 0;

  function setNativeValue(el, value) {
    var proto = Object.getPrototypeOf(el);
    var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    descriptor.set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  var interval = setInterval(function () {
    tries++;
    var inputs = document.querySelectorAll('input[inputmode="decimal"], input[type="number"], input[type="text"]');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      var rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      setNativeValue(el, target);
      console.log('[bridge] prefilled amount into input', i);
      clearInterval(interval);
      return;
    }
    if (tries > 25) {
      console.warn('[bridge] gave up trying to prefill amount');
      clearInterval(interval);
    }
  }, 400);
  true;
})();
`;

const JupiterSwapWebView = ({
  visible,
  onClose,
  swapUrl,
  walletAddress,
  prefillAmount,
  onSignAndSendTransaction,
  onSignTransaction,
}) => {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const loadingPulse = usePulse();

  const handleGoBack = () => {
    if (canGoBack && webViewRef.current) webViewRef.current.goBack();
  };

  const respondToPage = useCallback((id, payload) => {
    const script = `window.__sempaiResolve(${id}, ${JSON.stringify(payload)}); true;`;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const handleMessage = useCallback(
    async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (msg.type === 'debug') {
        console.log(`[JupiterWebView:${msg.level}]`, ...msg.args);
        return;
      }

      const { id, type, data } = msg;
      try {
        if (type === 'signAndSendTransaction') {
          if (!onSignAndSendTransaction) throw new Error('No onSignAndSendTransaction handler wired up');
          const signature = await onSignAndSendTransaction(data.transaction);
          respondToPage(id, { signature });
        } else if (type === 'signTransaction') {
          if (!onSignTransaction) throw new Error('No onSignTransaction handler wired up');
          const signedTransaction = await onSignTransaction(data.transaction);
          respondToPage(id, { signedTransaction });
        }
      } catch (err) {
        console.error('[JupiterWebView] signing error:', err.message);
        respondToPage(id, { error: err.message || 'Signing failed' });
      }
    },
    [onSignAndSendTransaction, onSignTransaction, respondToPage]
  );

  const injectedJavaScriptBeforeContentLoaded = walletAddress ? buildInjectedBridge(walletAddress) : '';

  return (
    <Modal
      isVisible={visible}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      useNativeDriver
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <AnimatedPressable onPress={handleGoBack} disabled={!canGoBack} style={styles.headerButton} scaleTo={0.85}>
            <Icon name="arrow-left" size={20} color="#fff" />
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Jupiter Swap</Text>
          <AnimatedPressable onPress={onClose} style={styles.headerButton} scaleTo={0.85}>
            <Icon name="times" size={20} color="#fff" />
          </AnimatedPressable>
        </View>

        <View style={styles.webviewContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#f36316" />
              <Animated.Text style={[styles.loadingText, { opacity: loadingPulse }]}>Loading Jupiter...</Animated.Text>
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={{ uri: swapUrl }}
            style={styles.webview}
            onLoadStart={() => {
              if (initialLoad) setLoading(true);
            }}
            onLoadEnd={() => {
              setLoading(false);
              setInitialLoad(false);
              webViewRef.current?.injectJavaScript(AUTO_SELECT_SCRIPT);
              if (prefillAmount) {
                setTimeout(() => {
                  webViewRef.current?.injectJavaScript(buildAutoFillAmountScript(prefillAmount));
                }, 1500);
              }
            }}
            onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
            injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState={false}
            mixedContentMode="compatibility"
            allowsBackForwardNavigationGestures
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Complete your swap in Jupiter, then close this window</Text>
          <AnimatedPressable onPress={onClose} style={styles.closeButton} scaleTo={0.97}>
            <Text style={styles.closeButtonText}>Close & Refresh Balances</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: { margin: 0, justifyContent: 'flex-end' },
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(243, 99, 22, 0.3)',
  },
  headerButton: { padding: 8, opacity: 0.8 },
  headerTitle: { color: '#fff', fontSize: 18, },
  webviewContainer: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1 },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1,
  },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 14 },
  footer: {
    padding: 16,
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(243, 99, 22, 0.3)',
  },
  footerText: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 12, textAlign: 'center', marginBottom: 12 },
  closeButton: { backgroundColor: 'rgba(243, 99, 22, 0.9)', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 14, },
});

export default JupiterSwapWebView;
