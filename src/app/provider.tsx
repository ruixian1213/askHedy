import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip, Field } from '../components/ui';
import { useSettings } from '../store/settings';
import { listModels, testProvider } from '../lib/llm';
import { PROVIDER_PRESETS, ProviderConfig, ProviderPreset } from '../lib/llm/types';
import { colors, radius, spacing } from '../lib/theme';

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function ProviderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const providers = useSettings((s) => s.providers);
  const upsert = useSettings((s) => s.upsertProvider);
  const remove = useSettings((s) => s.removeProvider);
  const existing = useMemo(() => providers.find((p) => p.id === id), [providers, id]);

  const initialPreset = existing
    ? PROVIDER_PRESETS.find((p) => p.baseUrl === existing.baseUrl) ?? PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1]
    : PROVIDER_PRESETS[2]; // OpenRouter 預設

  const [preset, setPreset] = useState<ProviderPreset>(initialPreset);
  const [name, setName] = useState(existing?.name ?? initialPreset.name);
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? initialPreset.baseUrl);
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [model, setModel] = useState(existing?.model ?? initialPreset.defaultModel);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>(initialPreset.models);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [modelFilter, setModelFilter] = useState('');

  const applyPreset = (p: ProviderPreset) => {
    setPreset(p);
    if (!existing) setName(p.name);
    setBaseUrl(p.baseUrl);
    setModel(p.defaultModel);
    setModels(p.models);
  };

  const build = (): ProviderConfig => ({
    id: existing?.id ?? uid(),
    name: name.trim() || preset.name,
    kind: preset.kind,
    baseUrl: baseUrl.trim(),
    apiKey: apiKey.trim(),
    model: model.trim(),
    extraHeaders: preset.extraHeaders,
  });

  const fetchModels = async () => {
    if (!apiKey.trim()) return Alert.alert('請先填 API key');
    setLoadingModels(true);
    try {
      const list = await listModels(build());
      setModels(list);
      if (!list.length) Alert.alert('沒有取得任何模型');
    } catch (e) {
      Alert.alert('取得模型失敗', e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingModels(false);
    }
  };

  const test = async () => {
    if (!apiKey.trim() || !model.trim()) return Alert.alert('請先填 API key 與模型');
    setTesting(true);
    try {
      const r = await testProvider(build());
      Alert.alert('連線成功 🎉', `模型回覆：${r}`);
    } catch (e) {
      Alert.alert('連線失敗', e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!apiKey.trim()) return Alert.alert('請填 API key');
    if (!model.trim()) return Alert.alert('請填模型名稱');
    if (!/^https?:\/\//.test(baseUrl.trim())) return Alert.alert('Base URL 格式', '需以 http:// 或 https:// 開頭');
    await upsert(build());
    router.back();
  };

  const visibleModels = models.filter((m) => !modelFilter || m.toLowerCase().includes(modelFilter.toLowerCase())).slice(0, 40);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>供應商</Text>
        <View style={styles.presets}>
          {PROVIDER_PRESETS.map((p) => (
            <Chip key={p.key} label={p.name} active={preset.key === p.key} onPress={() => applyPreset(p)} />
          ))}
        </View>
        {preset.hint && <Text style={styles.hint}>{preset.hint}</Text>}

        <Field label="名稱" value={name} onChangeText={setName} placeholder="顯示名稱" />
        <Field label="Base URL" value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <View>
          <Field
            label="API key"
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk-…"
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
            hint="只存在手機的 Secure Store，不會上傳到任何地方。"
          />
          <Pressable onPress={() => setShowKey((v) => !v)} style={styles.eye} hitSlop={8}>
            <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <Field label="模型" value={model} onChangeText={setModel} placeholder="model id" autoCapitalize="none" autoCorrect={false} />
        <View style={styles.modelTools}>
          <Button small title="從 API 取得模型列表" icon="cloud-download-outline" variant="secondary" loading={loadingModels} onPress={() => void fetchModels()} />
        </View>
        {models.length > 0 && (
          <View style={styles.modelList}>
            {models.length > 12 && (
              <Field value={modelFilter} onChangeText={setModelFilter} placeholder="篩選模型…" autoCapitalize="none" style={{ paddingVertical: 8 }} />
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {visibleModels.map((m) => (
                <Chip key={m} label={m} active={m === model} onPress={() => setModel(m)} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <Button title="測試連線" icon="flash-outline" variant="secondary" loading={testing} onPress={() => void test()} style={{ flex: 1 }} />
          <Button title="儲存" icon="checkmark" onPress={() => void save()} style={{ flex: 1 }} />
        </View>
        {existing && (
          <Button
            title="刪除這個供應商"
            variant="danger"
            style={{ marginTop: spacing.md }}
            onPress={() =>
              Alert.alert('刪除？', existing.name, [
                { text: '取消', style: 'cancel' },
                {
                  text: '刪除',
                  style: 'destructive',
                  onPress: async () => {
                    await remove(existing.id);
                    router.back();
                  },
                },
              ])
            }
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  presets: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
  eye: { position: 'absolute', right: 12, top: 34 },
  modelTools: { flexDirection: 'row', marginTop: -4, marginBottom: spacing.md },
  modelList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    paddingBottom: 4,
    marginBottom: spacing.md,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.sm },
});
