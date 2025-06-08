const bs58 = require('bs58');

const key = '3PM34CTcAKzdbKCiDMlDMh9qBQxcrFVYqNFUJFJzNqdVgNk5ty1jmb6oeMwiZ55chZDvqJMd4aKsajjDUd3nZi62nLg';
try {
  // For bs58@6.0.0, use the default export
  const decoded = bs58.default.decode(key);
  console.log('Decoded length:', decoded.length);
  console.log('Decoded bytes:', decoded);
} catch (error) {
  console.error('Decoding error:', error.message);
}