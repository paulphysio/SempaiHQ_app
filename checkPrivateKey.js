// checkPrivateKey.js
// Usage: node checkPrivateKey.js <privateKey>
// <privateKey> can be a Base58 string or a JSON array string

const bs58 = require('bs58');
const solanaWeb3 = require('@solana/web3.js');

function printUsage() {
  console.log('Usage: node checkPrivateKey.js <privateKey>');
  console.log('  <privateKey> can be a Base58 string or a JSON array string');
  console.log('Example:');
  console.log('  node checkPrivateKey.js 3PM34CTcAKzdbKCiDMlDMh9qBQxcrFVYqNFUJFJzNqdVgNk5ty1jmb6oeMwiZ55chZDvqJMd4aKsajjDUd3nZi62nLg');
  console.log('  node checkPrivateKey.js "[99,12,34,...]"');
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    printUsage();
    process.exit(1);
  }

  let secretKey;
  try {
    if (arg.trim().startsWith('[')) {
      // JSON array
      const arr = JSON.parse(arg);
      secretKey = Uint8Array.from(arr);
      console.log('[INFO] Parsed as JSON array.');
    } else {
      // Base58 string
      secretKey = bs58.decode(arg.trim());
      console.log('[INFO] Parsed as Base58 string.');
    }
  } catch (e) {
    console.error('[ERROR] Failed to parse private key:', e.message);
    process.exit(1);
  }

  try {
    const keypair = solanaWeb3.Keypair.fromSecretKey(secretKey);
    console.log('Public Address:', keypair.publicKey.toString());
    console.log('Secret Key (Base58):', bs58.encode(keypair.secretKey));
    console.log('Secret Key (JSON array):', JSON.stringify(Array.from(keypair.secretKey)));
  } catch (e) {
    console.error('[ERROR] Failed to create Keypair:', e.message);
    process.exit(1);
  }
}

main(); 