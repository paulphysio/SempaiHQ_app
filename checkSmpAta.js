// checkSmpAta.js
// Usage: node checkSmpAta.js <walletAddress> <mintAddress>
// Example: node checkSmpAta.js A6jwr4omFrFhLKrjc2fi9djmt6kay2iKt4oQytNKaBsN SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor

const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');

async function main() {
  const walletAddress = process.argv[2];
  const mintAddress = process.argv[3];
  if (!walletAddress || !mintAddress) {
    console.log('Usage: node checkSmpAta.js <walletAddress> <mintAddress>');
    process.exit(1);
  }

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const walletPubkey = new PublicKey(walletAddress);
  const mintPubkey = new PublicKey(mintAddress);

  try {
    const ata = await getAssociatedTokenAddress(mintPubkey, walletPubkey, false);
    console.log('Computed ATA:', ata.toBase58());
    let accountInfo;
    try {
      accountInfo = await getAccount(connection, ata, 'confirmed');
    } catch (e) {
      if (e.message && e.message.includes('Account does not exist')) {
        console.log('ATA does not exist on chain.');
        return;
      } else {
        throw e;
      }
    }
    console.log('ATA Owner:', accountInfo.owner.toBase58());
    console.log('ATA Mint:', accountInfo.mint.toBase58());
    console.log('ATA Balance:', accountInfo.amount.toString());
    console.log('ATA Decimals:', accountInfo.amount.toString().length > 6 ? '6 (SPL default)' : 'unknown');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main(); 