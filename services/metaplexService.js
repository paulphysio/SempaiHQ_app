import { PublicKey, Connection, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { 
  createCreateNftInstruction,
  createCreateMasterEditionV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID
} from '@solana/spl-token';
import { RPC_URL } from '../constants';

/**
 * Metaplex service for NFT minting and management
 * Simplified version for mobile app using API endpoints
 */

const API_BASE_URL = 'https://sempaihq.com/api';

/**
 * Mint a new NFT using the API
 */
export const mintNFT = async (walletAddress, metadata, imageUrl) => {
  try {
    const response = await fetch(`${API_BASE_URL}/metaplex/mint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        metadata,
        imageUrl
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[MetaplexService] NFT minted:', data.nftMint);
    return data;
  } catch (error) {
    console.error('[MetaplexService] Error minting NFT:', error);
    throw error;
  }
};

/**
 * Get NFT metadata
 */
export const getNFTMetadata = async (nftMintAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/metaplex/metadata/${nftMintAddress}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MetaplexService] Error getting NFT metadata:', error);
    throw error;
  }
};

/**
 * Get user's NFT collection
 */
export const getUserNFTs = async (walletAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/metaplex/collection/${walletAddress}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MetaplexService] Error getting user NFTs:', error);
    throw error;
  }
};

/**
 * Update NFT metadata
 */
export const updateNFTMetadata = async (nftMintAddress, newMetadata) => {
  try {
    const response = await fetch(`${API_BASE_URL}/metaplex/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nftMintAddress,
        newMetadata
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[MetaplexService] NFT metadata updated');
    return data;
  } catch (error) {
    console.error('[MetaplexService] Error updating NFT metadata:', error);
    throw error;
  }
};

/**
 * Transfer NFT
 */
export const transferNFT = async (nftMintAddress, fromAddress, toAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/metaplex/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nftMintAddress,
        fromAddress,
        toAddress
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[MetaplexService] NFT transferred');
    return data;
  } catch (error) {
    console.error('[MetaplexService] Error transferring NFT:', error);
    throw error;
  }
};

/**
 * Create metadata URI for NFT
 */
export const createMetadataURI = async (metadata) => {
  try {
    const response = await fetch(`${API_BASE_URL}/metaplex/metadata-uri`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.uri;
  } catch (error) {
    console.error('[MetaplexService] Error creating metadata URI:', error);
    throw error;
  }
};

export default {
  mintNFT,
  getNFTMetadata,
  getUserNFTs,
  updateNFTMetadata,
  transferNFT,
  createMetadataURI
};
