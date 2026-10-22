// @ts-check

import { File, Directory, Paths } from "expo-file-system/next";

const FALLBACK_IMAGE = 'https://placehold.co/300x400/png?text=No+Image';

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
 * @param {...!(string | Directory | File)} path
 */
function getOrCreateDirectory(...path) {
  const directory = new Directory(...path);
  if (!directory.exists) directory.create();
  return directory;
}

/**
 * @param {!string} url
 * @param {!File} destination
 */
async function downloadOrOverwriteFileAsync(url, destination) {
  try {
    if (destination.exists) {
      destination.delete();
    }
    return File.downloadFileAsync(url, destination);
  } catch (error) {
    // If file already exists and delete failed, try to just use the existing file
    if (destination.exists) {
      console.log('[downloadOrOverwriteFileAsync] File already exists, using existing file');
      return;
    }
    throw error;
  }
}

export const offlineCacheDirectory = getOrCreateDirectory(
  Paths.cache,
  "offline-cache",
);
const novelsCacheDirectory = getOrCreateDirectory(
  offlineCacheDirectory,
  "novels",
);

/**
 * @param {!string} id
 */
function getNovelCache(id) {
  const cacheDirectory = new Directory(novelsCacheDirectory, id);
  return {
    cacheDirectory,
    dataFile: new File(cacheDirectory, "data.json"),
    chaptersFile: new File(cacheDirectory, "chapters.json"),
    imageFile: new File(cacheDirectory, "image.jpg"),
  };
}

export function getCachedNovels() {
  const novels = [];
  console.log('[getCachedNovels] Starting cache retrieval');
  for (let path of novelsCacheDirectory.list()) {
    if (!(path instanceof Directory)) continue;
    const novel = getNovel(path.name);
    if (!novel) continue;

    console.log('[getCachedNovels] Found cached novel:', novel.title);
    const { imageFile } = getNovelCache(path.name);
    novels.push({
      id: novel.id,
      title: novel.title,
      image: imageFile.uri,
      summary: novel.summary,
      user_id: novel.user_id,
      tags: novel.tags,
      isAdult: novel.tags?.includes("Adult(18+)") || false,
      viewers_count: novel.viewers_count,
      viewers: novel.viewers_count || novel.viewers_count,
      averageRating: novel.averageRating || "-",
      writer: novel.writer || {
        name: "-",
        isWriter: true,
      },
    });
  }

  console.log('[getCachedNovels] Returning novels:', novels.length);
  return novels;
}

/**
 * @param {Object} novel
 * @param {string} novel.id
 * @param {string} novel.image
 * @param {string} [novel.averageRating]
 * @param {Object} [novel.writer]
 */
export async function saveNovel(novel) {
  try {
    const { cacheDirectory, dataFile, imageFile } = getNovelCache(novel.id);
    cacheDirectory.create();

    // Add default values for fields that might be missing
    const novelToSave = {
      ...novel,
      averageRating: novel.averageRating || "-",
      writer: novel.writer || {
        name: "-",
        isWriter: true,
      },
      // Store the local image path for offline use
      image: imageFile.uri,
    };

    dataFile.write(JSON.stringify(novelToSave));
    if (novel.image && novel.image !== FALLBACK_IMAGE && novel.image !== imageFile.uri) {
      await downloadOrOverwriteFileAsync(novel.image, imageFile);
    }
  } catch (error) {
    console.error('[offlineCache] could not save novel:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * @param {!string} id
 */
export function getNovel(id) {
  const { dataFile, imageFile } = getNovelCache(id);
  if (!dataFile.exists) return null;
  try {
    const novel = JSON.parse(dataFile.text());
    if (novel.image && imageFile.exists) novel.image = imageFile.uri;
    return novel;
  } catch (e) {
    console.error(e);
    console.error(`could not load novel ${id} from cache: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * @param {!string} id
 */
export function deleteNovel(id) {
  const { cacheDirectory } = getNovelCache(id);
  cacheDirectory.delete();
}

/**
 * @param {!string} id
 */
export function isNovelSaved(id) {
  const { cacheDirectory } = getNovelCache(id);
  return cacheDirectory.exists;
}

/**
 * @param {!string} id
 */
export function getNovelChapters(id) {
  const { chaptersFile } = getNovelCache(id);
  if (!chaptersFile.exists) return null;
  try {
    return JSON.parse(chaptersFile.text());
  } catch (e) {
    console.error(e);
    console.error(
      `could not load chapters for novel ${id} from cache: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

/**
 * @param {!string} novelId
 * @param {!any[]} chapters
 */
export function saveNovelChapters(novelId, chapters) {
  const { cacheDirectory, chaptersFile } = getNovelCache(novelId);
  if (!cacheDirectory.exists) cacheDirectory.create();
  chaptersFile.write(JSON.stringify(chapters));
}

/**
 * Save novel with only unlocked chapters and their content for offline reading
 * @param {Object} novel - The novel object with chaptertitles and chaptercontents
 * @param {string} novel.id
 * @param {string} novel.image
 * @param {Object<string, string>} [novel.chaptertitles] - Object mapping chapter numbers to titles
 * @param {Object<string, string>} [novel.chaptercontents] - Object mapping chapter numbers to content
 * @param {string} [novel.averageRating]
 * @param {Object} [novel.writer]
 * @param {string[]} unlockedChapterIds - Array of unlocked chapter numbers (as strings)
 */
export async function saveNovelForOfflineReading(novel, unlockedChapterIds) {
  try {
    const { cacheDirectory, dataFile, imageFile, chaptersFile } = getNovelCache(novel.id);
    cacheDirectory.create();

    /** @type {Object<string, string>} */
    const chaptertitles = novel.chaptertitles || {};
    /** @type {Object<string, string>} */
    const chaptercontents = novel.chaptercontents || {};

    console.log('[saveNovelForOfflineReading] Chapter titles keys:', Object.keys(chaptertitles));
    console.log('[saveNovelForOfflineReading] Unlocked chapter IDs:', unlockedChapterIds);

    // Always save first 3 chapters (indices 0, 1, 2)
    const firstThreeChapters = [];
    for (let i = 0; i <= 2; i++) {
      const chapterNum = i.toString();
      // Try both string and integer keys
      const title1 = chaptertitles[chapterNum];
      const title2 = chaptertitles[i];
      const title = title1 || title2;
      
      if (title) {
        const content1 = chaptercontents[chapterNum];
        const content2 = chaptercontents[i];
        const content = content1 || content2 || '';
        
        firstThreeChapters.push({
          chapter_number: chapterNum,
          title: title,
          content: content,
          is_unlocked: true,
        });
        console.log(`[saveNovelForOfflineReading] Saved chapter ${chapterNum}: ${title}`);
      }
    }

    // Add other unlocked chapters (beyond index 2)
    /** @type {Array<{chapter_number: string, title: string, content: string, is_unlocked: boolean}>} */
    const otherUnlockedChapters = [];
    unlockedChapterIds.forEach(chapterNum => {
      const num = parseInt(chapterNum, 10);
      if (num > 2) {
        const title1 = chaptertitles[chapterNum];
        const title2 = chaptertitles[num];
        const title = title1 || title2;
        
        if (title) {
          const content1 = chaptercontents[chapterNum];
          const content2 = chaptercontents[num];
          const content = content1 || content2 || '';
          
          otherUnlockedChapters.push({
            chapter_number: chapterNum,
            title: title,
            content: content,
            is_unlocked: true,
          });
          console.log(`[saveNovelForOfflineReading] Saved unlocked chapter ${chapterNum}: ${title}`);
        }
      }
    });

    const allChapters = [...firstThreeChapters, ...otherUnlockedChapters];
    console.log(`[saveNovelForOfflineReading] Total chapters saved: ${allChapters.length}`);

    // Save novel metadata
    const novelToSave = {
      ...novel,
      averageRating: novel.averageRating || "-",
      writer: novel.writer || {
        name: "-",
        isWriter: true,
      },
      image: imageFile.uri,
      // Store chapter data directly in novel for offline reading
      offline_chapters: allChapters,
    };

    dataFile.write(JSON.stringify(novelToSave));

    // Save image
    if (novel.image && novel.image !== FALLBACK_IMAGE && novel.image !== imageFile.uri) {
      await downloadOrOverwriteFileAsync(novel.image, imageFile);
    }

    // Save chapters separately
    chaptersFile.write(JSON.stringify(allChapters));

    console.log(`[offlineCache] Saved ${allChapters.length} chapters for offline reading`);
  } catch (error) {
    console.error('[offlineCache] could not save novel for offline reading:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
