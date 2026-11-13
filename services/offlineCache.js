// @ts-check

import * as FileSystem from 'expo-file-system';

const FALLBACK_IMAGE = 'https://placehold.co/300x400/png?text=No+Image';
const SMP_DIRECTORY = 'smp-novels';

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
 * Save a novel for offline reading (unencrypted, device-local)
 * @param {Object} novel - Novel object with metadata
 * @param {Array<string>} unlockedChapters - Array of unlocked chapter IDs
 * @param {string} userId - User ID (not used for encryption anymore)
 */
export async function saveNovelForOffline(novel, unlockedChapters, userId) {
  try {
    await ensureSmpDirectory();

    const fileId = novel.id;
    const filePath = getSmpDirectory() + fileId + '.smp';

    console.log('\n=== SAVE OFFLINE START ===');
    console.log('Novel ID:', novel.id);
    console.log('Novel Title:', novel.title);
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

    // Prepare data structure (no encryption)
    const data = {
      version: 2,
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
      encrypted: false
    };

    console.log('Data structure prepared with keys:', Object.keys(data));
    console.log('Novel object keys:', Object.keys(data.novel));

    // Save as plain JSON (no encryption)
    const jsonData = JSON.stringify(data);
    console.log('JSON data length:', jsonData.length, 'characters');

    await FileSystem.writeAsStringAsync(filePath, jsonData, {
      encoding: FileSystem.EncodingType.UTF8
    });
    console.log('✓ File written successfully to:', filePath);

    // Download and save image
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
 * Load a novel from offline .smp file (unencrypted)
 * @param {string} novelId - Novel ID
 * @param {string} userId - User ID (not used anymore)
 * @returns {Promise<Object|null>} - Object with { novel, chapters } or null
 */
export async function getNovelForOffline(novelId, userId) {
  try {
    console.log('[getNovelForOffline] Loading novel:', novelId);
    const filePath = getSmpDirectory() + novelId + '.smp';

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      console.log('[getNovelForOffline] File does not exist:', filePath);
      return null;
    }

    console.log('[getNovelForOffline] File exists, reading...');
    const jsonData = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8
    });

    const data = JSON.parse(jsonData);

    // Check if image exists locally
    const imagePath = getSmpDirectory() + novelId + '.jpg';
    const imageInfo = await FileSystem.getInfoAsync(imagePath);
    if (imageInfo.exists) {
      data.novel.image = imagePath;
    }

    console.log('[getNovelForOffline] Successfully loaded novel:', data.novel.title);
    return data;
  } catch (error) {
    console.error('[getNovelForOffline] Failed to load novel:', error);
    // Delete corrupted file
    console.log('[getNovelForOffline] Deleting corrupted file:', filePath);
    try {
      await FileSystem.deleteAsync(filePath);
      const imagePath = getSmpDirectory() + novelId + '.jpg';
      const imageInfo = await FileSystem.getInfoAsync(imagePath);
      if (imageInfo.exists) {
        await FileSystem.deleteAsync(imagePath);
      }
      console.log('[getNovelForOffline] Corrupted files deleted successfully');
    } catch (deleteError) {
      console.error('[getNovelForOffline] Failed to delete corrupted file:', deleteError);
    }
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
 * @param {string} userId - User ID (not used anymore)
 * @returns {Promise<Array>} - Array of novel objects
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
        try {
          const data = await getNovelForOffline(novelId, userId);
          if (data && data.novel) {
            novels.push(data.novel);
          }
        } catch (loadError) {
          console.error('[getCachedNovelsOffline] Failed to load novel:', novelId, loadError);
          // Continue with other files
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
 * Clear all .smp files (for migration when user ID changes or encryption removed)
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
    console.error('[clearAllSmpFiles] Failed to clear files:', error);
    throw error;
  }
}

/**
 * Clear corrupted files (when JSON parse fails)
 */
export async function clearCorruptedFiles() {
  try {
    await ensureSmpDirectory();
    const dir = getSmpDirectory();
    const files = await FileSystem.readDirectoryAsync(dir);

    let deletedCount = 0;
    for (const file of files) {
      if (file.endsWith('.smp')) {
        const filePath = dir + file;
        try {
          // Try to read as JSON to verify it's valid
          const content = await FileSystem.readAsStringAsync(filePath);
          JSON.parse(content); // Will throw if invalid JSON
        } catch (parseError) {
          // File is corrupted, delete it
          console.log('[clearCorruptedFiles] Deleting corrupted file:', file);
          try {
            await FileSystem.deleteAsync(filePath, { idempotent: true });
            // Also delete associated image
            const imagePath = dir + file.replace('.smp', '.jpg');
            const imageInfo = await FileSystem.getInfoAsync(imagePath);
            if (imageInfo.exists) {
              await FileSystem.deleteAsync(imagePath, { idempotent: true });
            }
            deletedCount++;
          } catch (deleteError) {
            console.error('[clearCorruptedFiles] Failed to delete corrupted file:', file, deleteError);
          }
        }
      }
    }

    console.log(`[clearCorruptedFiles] Deleted ${deletedCount} corrupted files`);
    return deletedCount;
  } catch (error) {
    console.error('[clearCorruptedFiles] Failed to clear corrupted files:', error);
    return 0;
  }
}
