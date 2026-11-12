import { create } from 'zustand';
import { clearGoogleSession, GoogleProfile, loadProfile, loadTokens, saveProfile, saveTokens, StoredTokens } from '../lib/google/auth';

type GoogleState = {
  loaded: boolean;
  connected: boolean;
  profile: GoogleProfile | null;
  load: () => Promise<void>;
  setSession: (tokens: StoredTokens, profile: GoogleProfile) => Promise<void>;
  disconnect: () => Promise<void>;
};

export const useGoogle = create<GoogleState>((set) => ({
  loaded: false,
  connected: false,
  profile: null,
  load: async () => {
    const [tokens, profile] = await Promise.all([loadTokens(), loadProfile()]);
    set({ loaded: true, connected: !!tokens, profile });
  },
  setSession: async (tokens, profile) => {
    await saveTokens(tokens);
    await saveProfile(profile);
    set({ connected: true, profile });
  },
  disconnect: async () => {
    await clearGoogleSession();
    set({ connected: false, profile: null });
  },
}));
