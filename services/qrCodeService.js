import { View, Text } from 'react-native';

/**
 * QR Code generation service
 * Generates QR codes for wallet addresses, payment requests, and sharing
 */

/**
 * Generate QR code data for wallet address
 */
export const generateWalletQRCode = (walletAddress) => {
  if (!walletAddress) return null;
  
  // Solana wallet address QR code format
  return `solana:${walletAddress}`;
};

/**
 * Generate QR code data for payment request
 */
export const generatePaymentQRCode = (walletAddress, amount, tokenType = 'SMP') => {
  if (!walletAddress || !amount) return null;
  
  // Payment request format
  return `solana:${walletAddress}?amount=${amount}&token=${tokenType}`;
};

/**
 * Generate QR code data for sharing content
 */
export const generateShareQRCode = (contentType, contentId) => {
  if (!contentType || !contentId) return null;
  
  // Share format for app content
  return `sempaihq://${contentType}/${contentId}`;
};

/**
 * Generate QR code data for novel chapter
 */
export const generateChapterQRCode = (novelId, chapterId) => {
  if (!novelId || chapterId === undefined) return null;
  
  return `sempaihq://novel/${novelId}/chapter/${chapterId}`;
};

/**
 * Generate QR code data for NFT
 */
export const generateNFTQRCode = (nftMintAddress) => {
  if (!nftMintAddress) return null;
  
  return `sempaihq://nft/${nftMintAddress}`;
};

/**
 * Validate QR code data
 */
export const validateQRCodeData = (qrData) => {
  if (!qrData || typeof qrData !== 'string') return false;
  
  // Check if it's a valid sempaihq URL or Solana address
  if (qrData.startsWith('sempaihq://')) return true;
  if (qrData.startsWith('solana:')) return true;
  
  // Check if it's a valid Solana address (base58, 32-44 chars)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(qrData);
};

/**
 * Parse QR code data
 */
export const parseQRCodeData = (qrData) => {
  if (!qrData) return null;
  
  try {
    if (qrData.startsWith('solana:')) {
      // Parse Solana address or payment request
      const address = qrData.replace('solana:', '');
      const url = new URL(address, 'https://example.com');
      
      return {
        type: 'solana',
        address: url.pathname,
        amount: url.searchParams.get('amount'),
        token: url.searchParams.get('token')
      };
    }
    
    if (qrData.startsWith('sempaihq://')) {
      // Parse app deep link
      const path = qrData.replace('sempaihq://', '');
      const parts = path.split('/');
      
      return {
        type: 'deeplink',
        contentType: parts[0],
        contentId: parts[1],
        subContent: parts[2]
      };
    }
    
    // Assume it's a raw wallet address
    if (validateQRCodeData(qrData)) {
      return {
        type: 'wallet',
        address: qrData
      };
    }
    
    return null;
  } catch (error) {
    console.error('[QRCodeService] Error parsing QR code:', error);
    return null;
  }
};

export default {
  generateWalletQRCode,
  generatePaymentQRCode,
  generateShareQRCode,
  generateChapterQRCode,
  generateNFTQRCode,
  validateQRCodeData,
  parseQRCodeData
};
