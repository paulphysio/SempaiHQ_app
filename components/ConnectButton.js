// The old wallet button was replaced by ConnectButtonEnhanced. Screens that
// still import this path get the current one, so there is one wallet context
// (the one App.js provides) and one safe key-retrieval path.
export { EmbeddedWalletContext, EmbeddedWalletProvider } from './ConnectButtonEnhanced';
export { default } from './ConnectButtonEnhanced';
