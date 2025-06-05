const bs58 = require('bs58');
const { Keypair } = require('@solana/web3.js');

const privateKey = '3PM34CTcAKzdbKCiDMh9qBQxcrFVYqNFUJFJzNqdVgNk5ty1jmb6oeMwiZ55 chZDvqJMd4aKsajjDUd3nZi62nLg';
const keypairArray = Array.from(bs58.decode(privateKey));
console.log('Secret Key (JSON Array):', JSON.stringify(keypairArray));
const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairArray));
console.log('Public Key:', keypair.publicKey.toString());