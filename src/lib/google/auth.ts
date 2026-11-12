import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { secureDelete, secureGet, secureSet } from '../storage';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google OAuth（iOS 原生用戶端 + PKCE，不需要 client secret）。
 *
 * 設定方式：
 * 1. Google Cloud Console → 建立「iOS」類型 OAuth 用戶端，Bundle ID 填 app.json 的 ios.bundleIdentifier。
 * 2. 把取得的 client id 填進 app.json → expo.extra.googleIosClientId。
 * 3. 把「反轉的 client id」（com.googleusercontent.apps.xxxx）加進 app.json → expo.scheme 陣列。
 * 4. 重新 EAS build（scheme 變更需要重新建置）。
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
];

export const googleDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
};

export function getGoogleClientId(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { googleIosClientId?: string };
  return extra.googleIosClientId ?? '';
}

export function isGoogleConfigured(): boolean {
  const id = getGoogleClientId();
  return !!id && !id.startsWith('REPLACE_WITH');
}

/** iOS 用戶端的 redirect 一律是「反轉 client id」當 scheme */
export function getGoogleRedirectUri(): string {
  const clientId = getGoogleClientId();
  const reversed = clientId.split('.').reverse().join('.');
  return `${reversed}:/oauthredirect`;
}

const TOKEN_KEY = 'hedy.google.tokens';
const PROFILE_KEY = 'hedy.google.profile';

export type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  scopes: string[];
};

export type GoogleProfile = { email: string; name?: string; picture?: string };

export async function saveTokens(t: StoredTokens) {
  await secureSet(TOKEN_KEY, JSON.stringify(t));
}
export async function loadTokens(): Promise<StoredTokens | null> {
  const raw = await secureGet(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as StoredTokens) : null;
}
export async function saveProfile(p: GoogleProfile) {
  await secureSet(PROFILE_KEY, JSON.stringify(p));
}
export async function loadProfile(): Promise<GoogleProfile | null> {
  const raw = await secureGet(PROFILE_KEY);
  return raw ? (JSON.parse(raw) as GoogleProfile) : null;
}
export async function clearGoogleSession() {
  const t = await loadTokens();
  if (t?.refreshToken || t?.accessToken) {
    try {
      await AuthSession.revokeAsync(
        { token: t.refreshToken ?? t.accessToken, clientId: getGoogleClientId() },
        googleDiscovery,
      );
    } catch {
      // 撤銷失敗也要清掉本機資料
    }
  }
  await secureDelete(TOKEN_KEY);
  await secureDelete(PROFILE_KEY);
}

export function tokensFromResponse(
  r: AuthSession.TokenResponse,
  previous?: StoredTokens | null,
): StoredTokens {
  const expiresIn = r.expiresIn ?? 3600;
  return {
    accessToken: r.accessToken,
    refreshToken: r.refreshToken ?? previous?.refreshToken,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
    scopes: r.scope ? r.scope.split(' ') : previous?.scopes ?? GOOGLE_SCOPES,
  };
}

let refreshing: Promise<string> | null = null;

/** 取得有效的 access token；過期就自動用 refresh token 換新 */
export async function getAccessToken(): Promise<string> {
  const t = await loadTokens();
  if (!t) throw new Error('尚未連結 Google 帳號，請到「設定」完成授權。');
  if (Date.now() < t.expiresAt) return t.accessToken;
  if (!t.refreshToken) throw new Error('Google 授權已過期，請重新登入。');
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await AuthSession.refreshAsync(
          { clientId: getGoogleClientId(), refreshToken: t.refreshToken },
          googleDiscovery,
        );
        const next = tokensFromResponse(r, t);
        await saveTokens(next);
        return next.accessToken;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(googleDiscovery.userInfoEndpoint!, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`取得使用者資料失敗 (${res.status})`);
  const j = (await res.json()) as GoogleProfile;
  return { email: j.email, name: j.name, picture: j.picture };
}
