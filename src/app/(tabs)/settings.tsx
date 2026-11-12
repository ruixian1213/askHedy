import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { ScreenHeader } from '../../components/ScreenHeader';
import { HedyAvatar } from '../../components/HedyAvatar';
import { Button, Card, Row, SectionTitle } from '../../components/ui';
import { useSettings } from '../../store/settings';
import { useGoogle } from '../../store/google';
import { useChat } from '../../store/chat';
import { useGoogleSignIn } from '../../lib/hooks/useGoogleSignIn';
import { colors, radius, spacing } from '../../lib/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const providers = useSettings((s) => s.providers);
  const prefs = useSettings((s) => s.prefs);
  const setPrefs = useSettings((s) => s.setPrefs);
  const setActiveProvider = useSettings((s) => s.setActiveProvider);
  const google = useGoogle();
  const clearAll = useChat((s) => s.clearAll);
  const { signIn, busy, error, configured, ready, redirectUri } = useGoogleSignIn();
  const [name, setName] = useState(prefs.userName);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="設定" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60 }}>
        {/* Google */}
        <SectionTitle>GOOGLE 帳號</SectionTitle>
        <Card>
          {google.connected && google.profile ? (
            <>
              <View style={styles.profile}>
                {google.profile.picture ? (
                  <Image source={{ uri: google.profile.picture }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="person" size={22} color={colors.blue} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{google.profile.name ?? google.profile.email}</Text>
                  <Text style={styles.profileEmail}>{google.profile.email}</Text>
                </View>
                <View style={styles.okBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                  <Text style={styles.okText}>已連結</Text>
                </View>
              </View>
              <View style={styles.scopes}>
                {['Gmail', '日曆', 'Drive'].map((s) => (
                  <View key={s} style={styles.scope}>
                    <Ionicons name="shield-checkmark-outline" size={13} color={colors.accent} />
                    <Text style={styles.scopeText}>{s}</Text>
                  </View>
                ))}
              </View>
              <Button
                title="中斷連結"
                variant="danger"
                small
                style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
                onPress={() =>
                  Alert.alert('中斷 Google 連結？', '會撤銷授權並清除本機 token。', [
                    { text: '取消', style: 'cancel' },
                    { text: '中斷', style: 'destructive', onPress: () => void google.disconnect() },
                  ])
                }
              />
            </>
          ) : (
            <>
              <Text style={styles.cardText}>連結後 Hedy 才能讀信、寄信、看行程、找檔案。授權用的是 Google 官方 OAuth，token 只存在你的手機 Secure Enclave 裡。</Text>
              {!configured && (
                <View style={styles.warn}>
                  <Ionicons name="warning-outline" size={16} color={colors.yellow} />
                  <Text style={styles.warnText}>尚未填入 Google iOS client id，請依 README 設定 app.json 後重新建置。</Text>
                </View>
              )}
              <Button
                title="連結 Google 帳號"
                icon="logo-google"
                loading={busy}
                disabled={!ready && configured}
                onPress={() => void signIn()}
                style={{ marginTop: spacing.md }}
              />
              {error && <Text style={styles.errorText}>{error}</Text>}
              {configured && <Text style={styles.redirect}>Redirect URI：{redirectUri}</Text>}
            </>
          )}
        </Card>

        {/* AI providers */}
        <SectionTitle right={<Button small title="新增" icon="add" variant="secondary" onPress={() => router.push('/provider')} />}>
          AI 模型
        </SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {providers.length === 0 ? (
            <Text style={[styles.cardText, { paddingVertical: 12 }]}>還沒有模型。按「新增」加入 OpenRouter、OpenAI、Claude 或任何 OpenAI 相容端點。</Text>
          ) : (
            providers.map((p) => {
              const active = p.id === prefs.activeProviderId;
              return (
                <Row
                  key={p.id}
                  title={p.name}
                  subtitle={`${p.model} · ${p.kind === 'anthropic' ? 'Anthropic' : 'OpenAI 相容'}`}
                  left={
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={active ? colors.primary : colors.textMuted}
                      onPress={() => void setActiveProvider(p.id)}
                    />
                  }
                  onPress={() => router.push({ pathname: '/provider', params: { id: p.id } })}
                />
              );
            })
          )}
        </Card>

        {/* About you */}
        <SectionTitle>關於你</SectionTitle>
        <Card>
          <Text style={styles.label}>你的名字（Hedy 會這樣叫你，也用來署名）</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={() => void setPrefs({ userName: name.trim() })}
            placeholder="例如：小安"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>自動執行動作</Text>
              <Text style={styles.switchSub}>開啟後寄信、建立行程等不再跳確認卡片（建議關閉）</Text>
            </View>
            <Switch value={prefs.autoApprove} onValueChange={(v) => void setPrefs({ autoApprove: v })} trackColor={{ true: colors.primary }} />
          </View>
          <Row title="Hedy 的記憶" subtitle="她記住的關於你的事" onPress={() => router.push('/memory')} />
        </Card>

        {/* Data */}
        <SectionTitle>資料</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          <Row title="對話紀錄" subtitle="瀏覽或切換過去的對話" onPress={() => router.push('/conversations')} />
          <Row
            title="清除所有對話"
            danger
            onPress={() =>
              Alert.alert('清除所有對話？', '此動作無法復原。', [
                { text: '取消', style: 'cancel' },
                { text: '清除', style: 'destructive', onPress: () => void clearAll() },
              ])
            }
            right={<Ionicons name="trash-outline" size={18} color={colors.danger} />}
          />
        </Card>

        <View style={styles.about}>
          <HedyAvatar size={56} ring />
          <Text style={styles.aboutTitle}>askHedy</Text>
          <Text style={styles.aboutSub}>v{Constants.expoConfig?.version ?? '1.0.0'} · 你的 iPhone 小助理</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  profileName: { fontSize: 16, fontWeight: '700', color: colors.text },
  profileEmail: { fontSize: 13, color: colors.textSecondary },
  okBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  okText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  scopes: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  scope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  scopeText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  cardText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  warn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.yellowSoft,
    padding: 10,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  warnText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  redirect: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.lg, marginBottom: spacing.sm },
  switchTitle: { fontSize: 15, color: colors.text, fontWeight: '500' },
  switchSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  about: { alignItems: 'center', marginTop: spacing.xl * 1.5, gap: 4 },
  aboutTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 6 },
  aboutSub: { fontSize: 12, color: colors.textMuted },
});
