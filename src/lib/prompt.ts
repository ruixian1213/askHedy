import { Alert, Platform } from 'react-native';

/**
 * 跨平台的文字輸入對話框：
 * iOS 用 Alert.prompt，網頁用 window.prompt，Android 沒有原生 prompt 就提示改用輸入框。
 */
export function promptText(title: string, message: string, onSubmit: (text: string) => void) {
  if (Platform.OS === 'ios') {
    Alert.prompt(title, message, (text) => onSubmit(text ?? ''), 'plain-text');
    return;
  }
  if (Platform.OS === 'web') {
    const text = globalThis.prompt?.(`${title}\n${message}`) ?? '';
    onSubmit(text);
    return;
  }
  Alert.alert(title, `${message}\n\n（請直接在 Hedy 對話框輸入）`);
}
