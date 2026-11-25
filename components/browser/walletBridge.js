// JavaScript injected into every page of the in-app browser (main frame only, before the page's own
// scripts run). It registers "Sempai HQ" as a Wallet Standard wallet, so Solana sites list it next to
// Phantom & co. Every request goes to the app over postMessage; the app decides (and asks the user).
// Nothing secret ever enters the page: it only ever receives the public address and signatures.
const ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGRlZnM+PHJhZGlhbEdyYWRpZW50IGlkPSJnIiBjeD0iMzUlIiBjeT0iMzAlIiByPSI3MCUiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmYjI3YSIvPjxzdG9wIG9mZnNldD0iLjYiIHN0b3AtY29sb3I9IiNmMzYzMTYiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNhNjNhMDAiLz48L3JhZGlhbEdyYWRpZW50PjwvZGVmcz48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMCIgZmlsbD0idXJsKCNnKSIvPjx0ZXh0IHg9IjMyIiB5PSI0MiIgZm9udC1mYW1pbHk9IkFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzAiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlM8L3RleHQ+PC9zdmc+';

export const WALLET_BRIDGE = `
(function () {
  if (window.__sempaiWallet) return;
  var A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58dec(s) {
    var bytes = [0];
    for (var i = 0; i < s.length; i++) {
      var c = A.indexOf(s[i]); if (c < 0) throw new Error('bad base58');
      for (var j = 0; j < bytes.length; j++) { c += bytes[j] * 58; bytes[j] = c & 255; c >>= 8; }
      while (c > 0) { bytes.push(c & 255); c >>= 8; }
    }
    for (var k = 0; k < s.length && s[k] === '1'; k++) bytes.push(0);
    return new Uint8Array(bytes.reverse());
  }
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

  var seq = 0, pending = {};
  function call(method, params) {
    return new Promise(function (resolve, reject) {
      var id = ++seq; pending[id] = { resolve: resolve, reject: reject };
      window.ReactNativeWebView.postMessage(JSON.stringify({ __sempai: 1, id: id, method: method, params: params || {} }));
    });
  }
  window.__sempaiReply = function (id, ok, data) {
    var p = pending[id]; if (!p) return; delete pending[id];
    if (ok) p.resolve(data); else { var e = new Error(data || 'User rejected the request.'); e.code = 4001; p.reject(e); }
  };

  var CHAINS = ['solana:mainnet'];
  var FEATURES = ['solana:signAndSendTransaction', 'solana:signTransaction', 'solana:signMessage'];
  var account = null, listeners = [];
  function acct(addr) { return Object.freeze({ address: addr, publicKey: b58dec(addr), chains: CHAINS, features: FEATURES }); }
  function emit() { listeners.slice().forEach(function (f) { try { f({ accounts: wallet.accounts }); } catch (e) {} }); }

  var wallet = {
    version: '1.0.0',
    name: 'Sempai HQ',
    icon: '${ICON}',
    chains: CHAINS,
    get accounts() { return account ? [account] : []; },
    features: {
      'standard:connect': { version: '1.0.0', connect: function (input) {
        return call('connect', { silent: !!(input && input.silent) }).then(function (r) { account = acct(r.address); emit(); return { accounts: [account] }; });
      } },
      'standard:disconnect': { version: '1.0.0', disconnect: function () { account = null; emit(); return call('disconnect').catch(function () {}); } },
      'standard:events': { version: '1.0.0', on: function (ev, fn) { if (ev !== 'change') return function () {}; listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; } },
      'solana:signTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy', 0], signTransaction: function () {
        var inputs = Array.prototype.slice.call(arguments), out = [];
        return inputs.reduce(function (p, i) { return p.then(function () { return call('signTransaction', { tx: b64(i.transaction) }).then(function (r) { out.push({ signedTransaction: unb64(r.tx) }); }); }); }, Promise.resolve()).then(function () { return out; });
      } },
      'solana:signAndSendTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy', 0], signAndSendTransaction: function () {
        var inputs = Array.prototype.slice.call(arguments), out = [];
        return inputs.reduce(function (p, i) { return p.then(function () { return call('signAndSendTransaction', { tx: b64(i.transaction) }).then(function (r) { out.push({ signature: b58dec(r.signature) }); }); }); }, Promise.resolve()).then(function () { return out; });
      } },
      'solana:signMessage': { version: '1.0.0', signMessage: function () {
        var inputs = Array.prototype.slice.call(arguments), out = [];
        return inputs.reduce(function (p, i) { return p.then(function () { return call('signMessage', { msg: b64(i.message) }).then(function (r) { out.push({ signedMessage: i.message, signature: b58dec(r.signature) }); }); }); }, Promise.resolve()).then(function () { return out; });
      } }
    }
  };

  function register(api) { try { api.register(wallet); } catch (e) {} }
  try { window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register })); } catch (e) {}
  window.addEventListener('wallet-standard:app-ready', function (e) { if (e && e.detail) register(e.detail); });
  window.__sempaiWallet = wallet;
})();
true;
`;
