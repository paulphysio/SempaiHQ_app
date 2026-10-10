// @ts-check

import { File, Directory, Paths } from "expo-file-system/next";

/**
 * @param {any} error
 */
export function isErrorNetworkError(error) {
  return error?.message?.toLowerCase().includes("network request failed");
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
  const { cacheDirectory, dataFile, imageFile } = getNovelCache(novel.id);
  cacheDirectory.create();

  dataFile.write(JSON.stringify(novel));
  if (novel.image) await downloadOrOverwriteFileAsync(novel.image, imageFile);
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
    console.error(`could not load novel ${id} from cache: {e?.message}`);
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
      `could not load chapters for novel ${id} from cache: {e?.message}`,
    );
    return null;
  }
}

/**
 * @param {!{ novel_id: string }[]} chapters
 */
export function saveNovelChapters(chapters) {
  const novelChaptersMap = new Map();
  for (let chapter of chapters) {
    let novelChapters = novelChaptersMap.get(chapter.novel_id);
    if (!novelChapters) {
      novelChapters = [];
      novelChaptersMap.set(chapter.novel_id, []);
    }
    novelChapters.push(chapter);
  }

  for (let [novelId, novelChapters] of novelChaptersMap) {
    const { chaptersFile } = getNovelCache(novelId);
    chaptersFile.write(JSON.stringify(novelChapters));
  }
}
