import { useCallback, useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import {
  fetchProfile,
  getGoogleClientId,
  getGoogleRedirectUri,
  GOOGLE_SCOPES,
  googleDiscovery,
  isGoogleConfigured,
  tokensFromResponse,
} from '../google/auth';
import { useGoogle } from '../../store/google';

/** 封裝 Google OAuth（Authorization Code + PKCE），成功後寫入 SecureStore 與 store */
export function useGoogleSignIn() {
  const setSession = useGoogle((s) => s.setSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = getGoogleClientId();
  const redirectUri = getGoogleRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: GOOGLE_SCOPES,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: { access_type: 'offline', prompt: 'consent' },
    },
    googleDiscovery,
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      setError(response.error?.message ?? response.params?.error_description ?? '授權失敗');
      return;
    }
    if (response.type !== 'success' || !request) return;
    const code = response.params.code;
    if (!code) {
      setError('Google 沒有回傳授權碼');
      return;
    }
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const token = await AuthSession.exchangeCodeAsync(
          {
            clientId,
            code,
            redirectUri,
            extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
          },
          googleDiscovery,
        );
        const tokens = tokensFromResponse(token);
        const profile = await fetchProfile(tokens.accessToken);
        await setSession(tokens, profile);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, [response, request, clientId, redirectUri, setSession]);

  const signIn = useCallback(async () => {
    setError(null);
    if (!isGoogleConfigured()) {
      setError('尚未設定 Google iOS client id。請依 README 在 app.json 填入 googleIosClientId 與 scheme 後重新建置。');
      return;
    }
    await promptAsync();
  }, [promptAsync]);

  return { ready: !!request, busy, error, signIn, configured: isGoogleConfigured(), redirectUri };
}
