import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'hedy.memory.notes';
const MAX = 60;

export type MemoryNote = { id: string; note: string; createdAt: string };

export async function loadMemory(): Promise<MemoryNote[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as MemoryNote[]) : [];
}

export async function saveMemory(note: string) {
  const list = await loadMemory();
  list.unshift({ id: String(Date.now()), note: note.trim(), createdAt: new Date().toISOString() });
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export async function deleteMemory(id: string) {
  const list = await loadMemory();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((n) => n.id !== id)));
}

export async function clearMemory() {
  await AsyncStorage.removeItem(KEY);
}
