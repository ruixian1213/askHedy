import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button, Chip, EmptyState, Loading } from '../../components/ui';
import { useGoogle } from '../../store/google';
import { EmailSummary, listEmails } from '../../lib/google/gmail';
import { formatRelative, parseSender } from '../../lib/format';
import { colors, spacing } from '../../lib/theme';

type Filter = 'all' | 'unread' | 'starred';
const FILTER_QUERY: Record<Filter, string> = {
  all: 'in:inbox',
  unread: 'in:inbox is:unread',
  starred: 'is:starred',
};

export default function InboxScreen() {
  const router = useRouter();
  const connected = useGoogle((s) => s.connected);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [emails, setEmails] = useState<EmailSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!connected) return;
      if (!silent) setRefreshing(true);
      setError(null);
      try {
        const q = search.trim() ? `${search.trim()} ${filter === 'all' ? '' : FILTER_QUERY[filter]}` : FILTER_QUERY[filter];
        setEmails(await listEmails({ query: q, maxResults: 25 }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setRefreshing(false);
      }
    },
    [connected, filter, search],
  );

  useEffect(() => {
    void load();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      if (emails) void load(true);
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!connected) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="信箱" />
        <EmptyState
          icon="mail-outline"
          title="還沒連結 Gmail"
          message="到「設定」連結 Google 帳號後，就能在這裡看信、回信，也能讓 Hedy 幫你處理。"
          action={<Button title="前往設定" onPress={() => router.navigate('/(tabs)/settings')} />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="信箱" actions={[{ icon: 'create-outline', onPress: () => router.push('/compose') }]} />
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void load()}
          placeholder="搜尋信件（支援 Gmail 語法）"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCapitalize="none"
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
      <View style={styles.filters}>
        <Chip label="全部" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="未讀" active={filter === 'unread'} onPress={() => setFilter('unread')} />
        <Chip label="星號" active={filter === 'starred'} onPress={() => setFilter('starred')} />
      </View>

      {emails === null && !error ? (
        <Loading text="正在載入信件…" />
      ) : error ? (
        <EmptyState icon="warning-outline" title="載入失敗" message={error} action={<Button title="重試" onPress={() => void load()} />} />
      ) : (
        <FlatList
          data={emails ?? []}
          keyExtractor={(m) => m.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="checkmark-done-outline" title="沒有信件" message="這個條件下沒有信，太棒了！" />}
          renderItem={({ item }) => <EmailRow email={item} onPress={() => router.push({ pathname: '/mail/[id]', params: { id: item.id } })} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

function EmailRow({ email, onPress }: { email: EmailSummary; onPress: () => void }) {
  const sender = parseSender(email.from);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.avatar, { backgroundColor: avatarColor(sender.email) }]}>
        <Text style={styles.avatarText}>{sender.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={[styles.sender, email.unread && styles.bold]} numberOfLines={1}>
            {sender.name}
          </Text>
          <Text style={styles.time}>{formatRelative(email.date)}</Text>
        </View>
        <Text style={[styles.subject, email.unread && styles.bold]} numberOfLines={1}>
          {email.subject}
        </Text>
        <Text style={styles.snippet} numberOfLines={2}>
          {email.snippet}
        </Text>
      </View>
      {email.unread && <View style={styles.dot} />}
    </Pressable>
  );
}

const PALETTE = ['#F27D8D', '#6AA7F2', '#5EC4A7', '#F6C453', '#B78CF2', '#F2A36A'];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
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
  filters: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sender: { fontSize: 15, color: colors.text, flex: 1, marginRight: 8 },
  time: { fontSize: 12, color: colors.textMuted },
  subject: { fontSize: 14, color: colors.text, marginTop: 1 },
  snippet: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  bold: { fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
