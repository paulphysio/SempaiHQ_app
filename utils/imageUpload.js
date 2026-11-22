import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

/*
 * Pictures for upload. Storage needs the actual bytes — passing the picker's
 * {uri, name, type} object makes it save that object as text instead.
 */
export async function readImageBytes(uri) {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Shrinks a picked photo to a light JPEG (longest side ≤ maxSide). */
export async function shrinkImage(asset, maxSide = 1600, quality = 0.82) {
  const w = asset.width || 0;
  const h = asset.height || 0;
  const resize = w >= h ? { width: Math.min(w || maxSide, maxSide) } : { height: Math.min(h || maxSide, maxSide) };
  const out = await ImageManipulator.manipulateAsync(asset.uri, [{ resize }], {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: out.uri, width: out.width, height: out.height };
}
