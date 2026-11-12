import { create } from 'zustand';
import { secureGet, secureSet } from '../lib/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProviderConfig } from '../lib/llm/types';

const PROVIDERS_KEY = 'hedy.providers'; // SecureStore（含 API key）
const PREFS_KEY = 'hedy.prefs'; // AsyncStorage

export type Prefs = {
  userName: string;
  activeProviderId: string | null;
  /** true 時，寄信/建立行程等動作不再跳確認卡片 */
  autoApprove: boolean;
  onboarded: boolean;
};

const defaultPrefs: Prefs = { userName: '', activeProviderId: null, autoApprove: false, onboarded: false };

type SettingsState = {
  loaded: boolean;
  providers: ProviderConfig[];
  prefs: Prefs;
  load: () => Promise<void>;
  upsertProvider: (p: ProviderConfig) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string | null) => Promise<void>;
  setPrefs: (patch: Partial<Prefs>) => Promise<void>;
  activeProvider: () => ProviderConfig | null;
};

export const useSettings = create<SettingsState>((set, get) => ({
  loaded: false,
  providers: [],
  prefs: defaultPrefs,

  load: async () => {
    const [rawProviders, rawPrefs] = await Promise.all([
      secureGet(PROVIDERS_KEY),
      AsyncStorage.getItem(PREFS_KEY),
    ]);
    const providers = rawProviders ? (JSON.parse(rawProviders) as ProviderConfig[]) : [];
    const prefs = { ...defaultPrefs, ...(rawPrefs ? (JSON.parse(rawPrefs) as Partial<Prefs>) : {}) };
    if (!prefs.activeProviderId && providers.length) prefs.activeProviderId = providers[0].id;
    set({ providers, prefs, loaded: true });
  },

  upsertProvider: async (p) => {
    const providers = get().providers.some((x) => x.id === p.id)
      ? get().providers.map((x) => (x.id === p.id ? p : x))
      : [...get().providers, p];
    await secureSet(PROVIDERS_KEY, JSON.stringify(providers));
    set({ providers });
    if (!get().prefs.activeProviderId) await get().setActiveProvider(p.id);
  },

  removeProvider: async (id) => {
    const providers = get().providers.filter((x) => x.id !== id);
    await secureSet(PROVIDERS_KEY, JSON.stringify(providers));
    set({ providers });
    if (get().prefs.activeProviderId === id) await get().setActiveProvider(providers[0]?.id ?? null);
  },

  setActiveProvider: async (id) => get().setPrefs({ activeProviderId: id }),

  setPrefs: async (patch) => {
    const prefs = { ...get().prefs, ...patch };
    set({ prefs });
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  },

  activeProvider: () => {
    const { providers, prefs } = get();
    return providers.find((p) => p.id === prefs.activeProviderId) ?? providers[0] ?? null;
  },
}));
