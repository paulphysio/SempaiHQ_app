// @ts-check

import { File, Directory, Paths } from "expo-file-system/next";

const FALLBACK_IMAGE = 'https://placehold.co/300x400/png?text=No+Image';

/**
 * @param {any} error
 */
export function isErrorNetworkError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("network request failed");
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
  if (destination.exists) destination.delete();
  return File.downloadFileAsync(url, destination);
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
  for (let path of novelsCacheDirectory.list()) {
    if (!(path instanceof Directory)) continue;
    const novel = getNovel(path.name);
    if (!novel) continue;

    novels.push({
      id: novel.id,
      title: novel.title,
      image: novel.image,
      summary: novel.summary,
      user_id: novel.user_id,
      tags: novel.tags,
      isAdult: novel.tags?.includes("Adult(18+)") || false,
      viewers_count: novel.viewers_count,
      viewers: novel.viewers_count,

      // TODO: placeholder
      averageRating: "-",
      writer: {
        name: "-",
        isWriter: true,
      },
    });
  }

  return novels;
}

/**
 * @param {!{ id: string; image: string }} novel
 */
export async function saveNovel(novel) {
  try {
    const { cacheDirectory, dataFile, imageFile } = getNovelCache(novel.id);
    cacheDirectory.create();

    dataFile.write(JSON.stringify(novel));
    if (novel.image && novel.image !== FALLBACK_IMAGE) {
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
