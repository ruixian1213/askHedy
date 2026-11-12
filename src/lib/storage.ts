import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * 機密資料儲存：iOS / Android 用 Keychain（expo-secure-store），
 * 網頁預覽時退回 localStorage（僅供開發預覽，瀏覽器不是安全的金鑰保存處）。
 */
const isWeb = Platform.OS === 'web';

export async function secureGet(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function secureDelete(key: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
