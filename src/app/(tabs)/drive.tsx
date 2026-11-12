import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button, EmptyState, Loading } from '../../components/ui';
import { useGoogle } from '../../store/google';
import { useChat } from '../../store/chat';
import { DriveFile, fileKind, FOLDER_MIME, formatSize, listFiles } from '../../lib/google/drive';
import { formatRelative } from '../../lib/format';
import { promptText } from '../../lib/prompt';
import { colors, spacing } from '../../lib/theme';

type Crumb = { id: string | undefined; name: string };

const ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  folder: { name: 'folder', color: colors.yellow },
  doc: { name: 'document-text', color: colors.blue },
  sheet: { name: 'grid', color: colors.accent },
  slides: { name: 'easel', color: '#F2A36A' },
  image: { name: 'image', color: '#B78CF2' },
  pdf: { name: 'document', color: colors.danger },
  video: { name: 'videocam', color: '#B78CF2' },
  file: { name: 'document-outline', color: colors.textSecondary },
};

export default function DriveScreen() {
  const router = useRouter();
  const connected = useGoogle((s) => s.connected);
  const startTask = useChat((s) => s.startTask);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: undefined, name: '我的雲端硬碟' }]);
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folder = crumbs[crumbs.length - 1];

  const load = useCallback(async () => {
    if (!connected) return;
    setRefreshing(true);
    setError(null);
    try {
      const q = search.trim();
      setFiles(await listFiles(q ? { query: q, pageSize: 40 } : { folderId: folder.id ?? 'root', pageSize: 60 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [connected, folder.id, search]);

  useEffect(() => {
    void load();
  }, [folder.id, connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const openFile = (f: DriveFile) => {
    if (f.mimeType === FOLDER_MIME) {
      setSearch('');
      setCrumbs((c) => [...c, { id: f.id, name: f.name }]);
      return;
    }
    Alert.alert(f.name, [f.mimeType, formatSize(f.size), f.modifiedTime ? `修改於 ${formatRelative(f.modifiedTime)}` : ''].filter(Boolean).join(' · '), [
      { text: '關閉', style: 'cancel' },
      ...(f.webViewLink ? [{ text: '開啟', onPress: () => void WebBrowser.openBrowserAsync(f.webViewLink!) }] : []),
      {
        text: '讓 Hedy 摘要',
        onPress: () => {
          void startTask(`請讀取 Drive 檔案「${f.name}」（file_id=${f.id}）並摘要重點。`);
          router.navigate('/(tabs)');
        },
      },
    ]);
  };

  if (!connected) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="雲端硬碟" />
        <EmptyState
          icon="folder-outline"
          title="還沒連結 Google Drive"
          message="到「設定」連結 Google 帳號後，就能在這裡瀏覽檔案，也能讓 Hedy 幫你找與摘要。"
          action={<Button title="前往設定" onPress={() => router.navigate('/(tabs)/settings')} />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="雲端硬碟"
        actions={[
          {
            icon: 'sparkles-outline',
            onPress: () =>
              promptText('讓 Hedy 找檔案', '例如：上個月的報價單', (t) => {
                if (!t?.trim()) return;
                void startTask(`請在 Drive 找：${t}`);
                router.navigate('/(tabs)');
              }),
          },
        ]}
      />
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void load()}
          placeholder="搜尋檔案名稱或內容"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable
            onPress={() => {
              setSearch('');
              setTimeout(() => void load(), 0);
            }}
          >
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {!search.trim() && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crumbs}>
          {crumbs.map((c, i) => (
            <Pressable key={`${c.id ?? 'root'}-${i}`} onPress={() => setCrumbs(crumbs.slice(0, i + 1))} style={styles.crumb}>
              <Text style={[styles.crumbText, i === crumbs.length - 1 && styles.crumbActive]}>{c.name}</Text>
              {i < crumbs.length - 1 && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
            </Pressable>
          ))}
        </ScrollView>
      )}

      {files === null && !error ? (
        <Loading text="正在載入檔案…" />
      ) : error ? (
        <EmptyState icon="warning-outline" title="載入失敗" message={error} action={<Button title="重試" onPress={() => void load()} />} />
      ) : (
        <FlatList
          data={files ?? []}
          keyExtractor={(f) => f.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="folder-open-outline" title="沒有檔案" />}
          renderItem={({ item }) => {
            const ic = ICONS[fileKind(item.mimeType)];
            return (
              <Pressable onPress={() => openFile(item)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name={ic.name} size={26} color={ic.color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta}>
                    {[item.modifiedTime ? formatRelative(item.modifiedTime) : '', formatSize(item.size)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  crumbs: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center' },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  crumbText: { fontSize: 13, color: colors.textMuted },
  crumbActive: { color: colors.text, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 15, color: colors.text, fontWeight: '500' },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
