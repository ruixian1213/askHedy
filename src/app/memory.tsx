import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, EmptyState } from '../components/ui';
import { clearMemory, deleteMemory, loadMemory, MemoryNote } from '../lib/agent/memory';
import { formatRelative } from '../lib/format';
import { colors, spacing } from '../lib/theme';

export default function MemoryScreen() {
  const [notes, setNotes] = useState<MemoryNote[]>([]);
  const refresh = useCallback(() => {
    void loadMemory().then(setNotes);
  }, []);
  useFocusEffect(refresh);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={<Text style={styles.intro}>Hedy 在對話中學到關於你的事會記在這裡，並在每次對話時參考。你可以隨時刪除。</Text>}
        ListEmptyComponent={<EmptyState icon="bulb-outline" title="還沒有記憶" message="跟 Hedy 聊聊你的偏好，或直接說「記住我喜歡…」。" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Ionicons name="bulb" size={18} color={colors.yellow} />
            <View style={{ flex: 1 }}>
              <Text style={styles.note}>{item.note}</Text>
              <Text style={styles.time}>{formatRelative(item.createdAt)}</Text>
            </View>
            <Pressable hitSlop={8} onPress={() => void deleteMemory(item.id).then(refresh)}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
      />
      {notes.length > 0 && (
        <View style={styles.footer}>
          <Button
            title="清除全部記憶"
            variant="danger"
            onPress={() =>
              Alert.alert('清除全部記憶？', '', [
                { text: '取消', style: 'cancel' },
                { text: '清除', style: 'destructive', onPress: () => void clearMemory().then(refresh) },
              ])
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  note: { fontSize: 14, color: colors.text, lineHeight: 20 },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  footer: { padding: spacing.lg, backgroundColor: colors.background },
});
