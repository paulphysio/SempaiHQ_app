import { Keypair } from "@solana/web3.js";

const AIRDROP_KEYPAIR = Keypair.fromSecretKey(
  Uint8Array.from([193,153,44,7,137,250,5,138,50,40,229,182,90,59,170,84,192,9,103,85,107,11,219,150,82,102,37,70,133,159,188,103,0,21,89,124,144,103,243,253,33,180,181,112,35,56,103,93,147,219,195,243,209,219,165,21,181,240,91,239,174,104,31,9])
);
console.log("Airdrop Wallet Public Key:", AIRDROP_KEYPAIR.publicKey.toString());