/**
 * Irys Storage service for decentralized file storage
 * Simplified version for mobile app using API endpoints
 */

const API_BASE_URL = 'https://sempaihq.com/api';

/**
 * Upload file to Irys (Arweave) storage
 */
export const uploadToIrys = async (file, tags = {}) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add tags as JSON string
    Object.keys(tags).forEach(key => {
      formData.append(`tag_${key}`, tags[key]);
    });

    const response = await fetch(`${API_BASE_URL}/irys/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[IrysService] File uploaded:', data.id);
    return data;
  } catch (error) {
    console.error('[IrysService] Error uploading file:', error);
    throw error;
  }
};

/**
 * Upload JSON data to Irys
 */
export const uploadJSONToIrys = async (jsonData, tags = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/irys/upload-json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: jsonData,
        tags
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[IrysService] JSON uploaded:', data.id);
    return data;
  } catch (error) {
    console.error('[IrysService] Error uploading JSON:', error);
    throw error;
  }
};

/**
 * Get file from Irys
 */
export const getFromIrys = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/irys/get/${id}`, {
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
    console.error('[IrysService] Error getting file:', error);
    throw error;
  }
};

/**
 * Get file price estimate
 */
export const getUploadPrice = async (bytes) => {
  try {
    const response = await fetch(`${API_BASE_URL}/irys/price?bytes=${bytes}`, {
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
    console.error('[IrysService] Error getting price:', error);
    throw error;
  }
};

/**
 * Upload image for NFT metadata
 */
export const uploadNFTImage = async (imageUri, nftName, description) => {
  try {
    const tags = {
      'Content-Type': 'image/png',
      'NFT-Name': nftName,
      'Description': description || '',
      'App': 'SempaiHQ Mobile'
    };

    const response = await fetch(`${API_BASE_URL}/irys/upload-nft-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUri,
        tags
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[IrysService] NFT image uploaded:', data.id);
    return data;
  } catch (error) {
    console.error('[IrysService] Error uploading NFT image:', error);
    throw error;
  }
};

export default {
  uploadToIrys,
  uploadJSONToIrys,
  getFromIrys,
  getUploadPrice,
  uploadNFTImage
};
