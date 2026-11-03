// @ts-check

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

const FALLBACK_IMAGE = 'https://placehold.co/300x400/png?text=No+Image';
const SMP_DIRECTORY = 'smp-novels';
const KEY_VERSION = 'v1';
const KEY_PREFIX = 'smp_encryption_key_';

/**
 * @param {any} error
 */
export function isErrorNetworkError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  return lowerMessage.includes("network request failed") ||
         lowerMessage.includes("network error") ||
         lowerMessage.includes("fetch failed") ||
         lowerMessage.includes("econnrefused") ||
         lowerMessage.includes("enotfound") ||
         lowerMessage.includes("timeout") ||
         lowerMessage.includes("failed to fetch");
}

/**
 * Generate encryption key from user ID
 * @param {string} userId - User ID to derive key from
 * @returns {Promise<string>} - Hex string of the encryption key
 */
async function generateUserKey(userId) {
  // Derive key from user ID using SHA-256 (crypto-js)
  const keyStorageKey = `${KEY_PREFIX}${KEY_VERSION}_${userId || 'guest'}`;

  try {
    // Check if we already have a key stored
    const existingKey = await SecureStore.getItemAsync(keyStorageKey);
    if (existingKey) {
      return existingKey;
    }
  } catch (e) {
    // SecureStore might not be available, continue to generate
  }

  // Generate key from user ID using crypto-js
  const key = CryptoJS.SHA256((userId || 'guest') + KEY_VERSION).toString();

  // Store the key for future use
  try {
    await SecureStore.setItemAsync(keyStorageKey, key);
  } catch (e) {
    // SecureStore might not be available, that's okay
  }

  return key;
}

/**
 * Encrypt data using AES encryption (crypto-js)
 * @param {string} data - JSON string to encrypt
 * @param {string} key - Encryption key (hex string)
 * @returns {Promise<string>} - Encrypted data (IV:encrypted format)
 */
async function encryptData(data, key) {
  try {
    // Generate random IV using expo-crypto
    const ivBytes = await Crypto.getRandomBytesAsync(16);
    const ivWordArray = CryptoJS.lib.WordArray.create(ivBytes);

    // Encrypt using AES-CBC with crypto-js
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: ivWordArray,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    // Combine IV and encrypted data
    const ivHex = CryptoJS.enc.Hex.stringify(ivWordArray);
    const encryptedData = encrypted.toString();
    const combined = ivHex + ':' + encryptedData;

    return combined;
  } catch (error) {
    console.error('[encryptData] Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES encryption (crypto-js)
 * @param {string} encryptedData - Encrypted data (IV:encrypted format)
 * @param {string} key - Encryption key (hex string)
 * @returns {Promise<string>} - Decrypted JSON string
 */
async function decryptData(encryptedData, key) {
  try {
    // Split IV and encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const ivHex = parts[0];
    const encrypted = parts[1];

    // Convert IV to WordArray
    const iv = CryptoJS.enc.Hex.parse(ivHex);

    // Decrypt using AES-CBC
    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedStr) {
      throw new Error('Decryption failed - invalid key or corrupted data');
    }

    return decryptedStr;
  } catch (error) {
    console.error('[decryptData] Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Get the .smp file storage directory
 * @returns {string} - Directory path
 */
function getSmpDirectory() {
  return FileSystem.documentDirectory + SMP_DIRECTORY + '/';
}

/**
 * Ensure the .smp directory exists
 */
async function ensureSmpDirectory() {
  const dir = getSmpDirectory();
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/**
 * Save a novel for offline reading in encrypted .smp format
 * @param {Object} novel - Novel object with metadata
 * @param {Array<string>} unlockedChapters - Array of unlocked chapter IDs
 * @param {string} userId - User ID for encryption key
 */
export async function saveNovelForOffline(novel, unlockedChapters, userId) {
  try {
    await ensureSmpDirectory();

    const key = await generateUserKey(userId);
    const fileId = novel.id;
    const filePath = getSmpDirectory() + fileId + '.smp';

    console.log('\n=== SAVE OFFLINE START ===');
    console.log('Novel ID:', novel.id);
    console.log('Novel Title:', novel.title);
    console.log('User ID:', userId);
    console.log('File Path:', filePath);
    console.log('File Directory:', getSmpDirectory());

    // Extract chapters to save (first 3 + unlocked)
    const chaptersToSave = [];
    const chaptertitles = novel.chaptertitles || {};
    const chaptercontents = novel.chaptercontents || {};

    console.log('\n--- CHAPTERS TO SAVE ---');
    console.log('Total chaptertitles available:', Object.keys(chaptertitles).length);
    console.log('Total chaptercontents available:', Object.keys(chaptercontents).length);
    console.log('Unlocked chapters provided:', unlockedChapters.length, unlockedChapters);

    // Always save first 3 chapters (indices 0, 1, 2)
    console.log('\nFirst 3 chapters (always free):');
    for (let i = 0; i < 3; i++) {
      const chapterId = String(i);
      if (chaptercontents[chapterId]) {
        const chapter = {
          chapter_number: chapterId,
          title: chaptertitles[chapterId] || `Chapter ${i + 1}`,
          content: chaptercontents[chapterId],
          is_unlocked: true
        };
        chaptersToSave.push(chapter);
        console.log(`  ✓ Chapter ${chapterId}: "${chapter.title}"`);
        console.log(`    Content length: ${chapter.content.length} characters`);
        console.log(`    Content preview: ${chapter.content.substring(0, 100)}...`);
      } else {
        console.log(`  ✗ Chapter ${chapterId}: NOT FOUND in chaptercontents`);
      }
    }

    // Save additional unlocked chapters
    console.log('\nAdditional unlocked chapters:');
    for (const chapterId of unlockedChapters) {
      const chapterNum = parseInt(chapterId, 10);
      if (chapterNum <= 2) {
        console.log(`  - Chapter ${chapterId}: Skipped (already in first 3 free chapters)`);
        continue;
      }
      if (chaptercontents[chapterId]) {
        const chapter = {
          chapter_number: chapterId,
          title: chaptertitles[chapterId] || `Chapter ${chapterNum + 1}`,
          content: chaptercontents[chapterId],
          is_unlocked: true
        };
        chaptersToSave.push(chapter);
        console.log(`  ✓ Chapter ${chapterId}: "${chapter.title}"`);
        console.log(`    Content length: ${chapter.content.length} characters`);
        console.log(`    Content preview: ${chapter.content.substring(0, 100)}...`);
      } else {
        console.log(`  ✗ Chapter ${chapterId}: NOT FOUND in chaptercontents`);
      }
    }

    console.log('\n--- DATA PREPARATION ---');
    console.log('Total chapters to save:', chaptersToSave.length);

    // Determine if saved with user or guest key
    const savedWithKey = (userId && userId !== 'guest') ? 'user' : 'guest';
    console.log('Saved with key:', savedWithKey);

    // Prepare data structure
    const data = {
      version: 1,
      novel_id: novel.id,
      novel: {
        id: novel.id,
        title: novel.title,
        summary: novel.summary,
        tags: novel.tags,
        viewers_count: novel.viewers_count,
        is_visible: novel.is_visible,
        featured: novel.featured,
        status: novel.status,
        averageRating: novel.averageRating,
        writer: novel.writer,
        user_id: novel.user_id,
        image: novel.image,
        chaptertitles: novel.chaptertitles || {}
      },
      chapters: chaptersToSave,
      saved_with_key: savedWithKey,
      encrypted: true
    };

    console.log('Data structure prepared with keys:', Object.keys(data));
    console.log('Novel object keys:', Object.keys(data.novel));

    // Encrypt and save
    const jsonData = JSON.stringify(data);
    console.log('JSON data length:', jsonData.length, 'characters');

    const encryptedData = await encryptData(jsonData, key);
    console.log('Encrypted data length:', encryptedData.length, 'characters');

    await FileSystem.writeAsStringAsync(filePath, encryptedData, {
      encoding: FileSystem.EncodingType.UTF8
    });
    console.log('✓ File written successfully to:', filePath);

    // Download and save image (not encrypted for performance)
    if (novel.image && novel.image !== FALLBACK_IMAGE) {
      try {
        const imagePath = getSmpDirectory() + fileId + '.jpg';
        console.log('\n--- IMAGE SAVE ---');
        console.log('Image URL:', novel.image);
        console.log('Image Path:', imagePath);
        await FileSystem.downloadAsync(novel.image, imagePath);
        console.log('✓ Image downloaded successfully');
      } catch (imageError) {
        console.warn('[saveNovelForOffline] Failed to download image:', imageError);
        // Don't fail the save if image download fails
      }
    }

    console.log('\n=== SAVE OFFLINE COMPLETE ===');
    console.log(`✓ Saved novel "${novel.title}" with ${chaptersToSave.length} chapters`);
    console.log(`✓ File location: ${filePath}`);
    console.log(`✓ Image location: ${getSmpDirectory() + fileId + '.jpg'}`);
    console.log('========================\n');
  } catch (error) {
    console.error('\n=== SAVE OFFLINE FAILED ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========================\n');
    throw error;
  }
}

/**
 * Load a novel from offline encrypted .smp file
 * @param {string} novelId - Novel ID
 * @param {string} userId - User ID for decryption key
 * @returns {Promise<Object|null>} - Object with { novel, chapters, saved_with_key } or null
 */
export async function getNovelForOffline(novelId, userId) {
  try {
    console.log('[getNovelForOffline] Loading novel:', novelId, 'with userId:', userId);
    const key = await generateUserKey(userId);
    const filePath = getSmpDirectory() + novelId + '.smp';

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      console.log('[getNovelForOffline] File does not exist:', filePath);
      return null;
    }

    console.log('[getNovelForOffline] File exists, reading...');
    const encryptedData = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8
    });

    let decryptedJson;
    let usedKey = 'user';
    try {
      console.log('[getNovelForOffline] Attempting decryption with user key');
      decryptedJson = await decryptData(encryptedData, key);
      console.log('[getNovelForOffline] Decrypted successfully with user key');
    } catch (decryptError) {
      // If decryption fails with user key, try guest key (for migration purposes)
      console.log('[getNovelForOffline] Failed to decrypt with user key, trying guest key');
      try {
        const guestKey = await generateUserKey('guest');
        decryptedJson = await decryptData(encryptedData, guestKey);
        usedKey = 'guest';
        console.log('[getNovelForOffline] Successfully decrypted with guest key');
      } catch (guestError) {
        console.log('[getNovelForOffline] Failed to decrypt with guest key too');
        throw decryptError; // Throw original error if guest key also fails
      }
    }

    const data = JSON.parse(decryptedJson);

    // Ensure saved_with_key field exists (for old files without it)
    if (!data.saved_with_key) {
      data.saved_with_key = usedKey;
    }

    // Check if image exists locally
    const imagePath = getSmpDirectory() + novelId + '.jpg';
    const imageInfo = await FileSystem.getInfoAsync(imagePath);
    if (imageInfo.exists) {
      data.novel.image = imagePath;
    }

    console.log('[getNovelForOffline] Decrypted novel "' + data.novel.title + '" with ' + usedKey + ' key');
    return data;
  } catch (error) {
    console.error('[getNovelForOffline] Failed to load novel:', error);
    // Don't auto-delete - let user re-save with correct key
    return null;
  }
}

/**
 * Check if a novel is saved offline
 * @param {string} novelId - Novel ID
 * @returns {Promise<boolean>} - True if saved
 */
export async function isNovelSavedOffline(novelId) {
  try {
    const filePath = getSmpDirectory() + novelId + '.smp';
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    return fileInfo.exists;
  } catch (error) {
    console.error('[isNovelSavedOffline] Failed to check:', error);
    return false;
  }
}

/**
 * List all cached novels offline
 * @param {string} userId - User ID for decryption
 * @returns {Promise<Array>} - Array of novel objects with saved_with_key metadata
 */
export async function getCachedNovelsOffline(userId) {
  try {
    await ensureSmpDirectory();
    const dir = getSmpDirectory();
    const files = await FileSystem.readDirectoryAsync(dir);

    const novels = [];
    for (const file of files) {
      if (file.endsWith('.smp')) {
        const novelId = file.replace('.smp', '');
        const data = await getNovelForOffline(novelId, userId);
        if (data && data.novel) {
          // Include saved_with_key in the novel object for UI display
          novels.push({
            ...data.novel,
            saved_with_key: data.saved_with_key
          });
        }
      }
    }

    console.log(`[getCachedNovelsOffline] Found ${novels.length} saved novels`);
    return novels;
  } catch (error) {
    console.error('[getCachedNovelsOffline] Failed to list novels:', error);
    return [];
  }
}

/**
 * Delete a novel from offline storage
 * @param {string} novelId - Novel ID
 */
export async function deleteNovelForOffline(novelId) {
  try {
    const filePath = getSmpDirectory() + novelId + '.smp';
    const imagePath = getSmpDirectory() + novelId + '.jpg';

    await FileSystem.deleteAsync(filePath, { idempotent: true });
    await FileSystem.deleteAsync(imagePath, { idempotent: true });

    console.log(`[deleteNovelForOffline] Deleted novel ${novelId}`);
  } catch (error) {
    console.error('[deleteNovelForOffline] Failed to delete novel:', error);
    throw error;
  }
}

/**
 * Clear old cache directory (migration cleanup)
 */
export async function clearOldCache() {
  try {
    const oldCacheDir = FileSystem.cacheDirectory + 'offline-cache/';
    const dirInfo = await FileSystem.getInfoAsync(oldCacheDir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(oldCacheDir, { idempotent: true });
      console.log('[clearOldCache] Deleted old cache directory');
    }
  } catch (error) {
    console.error('[clearOldCache] Failed to clear old cache:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Clear all .smp files (for migration when user ID changes)
 */
export async function clearAllSmpFiles() {
  try {
    const smpDir = getSmpDirectory();
    const dirInfo = await FileSystem.getInfoAsync(smpDir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(smpDir, { idempotent: true });
      console.log('[clearAllSmpFiles] Deleted all .smp files');
    }
  } catch (error) {
    console.error('[clearAllSmpFiles] Failed to clear .smp files:', error);
    // Don't throw - this is non-critical
  }
}
