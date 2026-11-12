import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../components/ui';
import { useChat } from '../store/chat';
import { formatRelative } from '../lib/format';
import { colors, spacing } from '../lib/theme';

export default function ConversationsScreen() {
  const router = useRouter();
  const conversations = useChat((s) => s.conversations);
  const currentId = useChat((s) => s.currentId);
  const select = useChat((s) => s.selectConversation);
  const del = useChat((s) => s.deleteConversation);

  return (
    <FlatList
      data={conversations.filter((c) => c.messages.length > 0)}
      keyExtractor={(c) => c.id}
      ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="還沒有對話" message="回到 Hedy 分頁開始聊天吧。" />}
      renderItem={({ item }) => {
        const last = [...item.messages].reverse().find((m) => m.role === 'assistant' && m.content);
        return (
          <Pressable
            onPress={() => {
              select(item.id);
              router.back();
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
          >
            <Ionicons
              name={item.id === currentId ? 'chatbubble-ellipses' : 'chatbubble-outline'}
              size={22}
              color={item.id === currentId ? colors.primary : colors.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {last?.content ?? '…'}
              </Text>
            </View>
            <Text style={styles.time}>{formatRelative(new Date(item.updatedAt).toISOString())}</Text>
            <Pressable
              hitSlop={8}
              onPress={() =>
                Alert.alert('刪除對話？', item.title, [
                  { text: '取消', style: 'cancel' },
                  { text: '刪除', style: 'destructive', onPress: () => void del(item.id) },
                ])
              }
            >
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        );
      }}
      contentContainerStyle={{ paddingBottom: 40 }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  time: { fontSize: 12, color: colors.textMuted },
});
