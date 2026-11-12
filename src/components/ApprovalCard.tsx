import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { PendingApproval } from '../store/chat';

const LABELS: Record<string, string> = {
  to: '收件人',
  cc: '副本',
  subject: '主旨',
  body: '內容',
  message_id: '信件 ID',
  reply_all: '回覆所有人',
  action: '動作',
  summary: '標題',
  start: '開始',
  end: '結束',
  all_day: '整天',
  description: '說明',
  location: '地點',
  attendees: '與會者',
  event_id: '行程 ID',
  name: '名稱',
  content: '內容',
  folder_id: '資料夾 ID',
  parent_id: '上層資料夾',
  file_id: '檔案 ID',
  target_folder_id: '目標資料夾',
  new_name: '新名稱',
  mime_type: '類型',
  reminder_minutes: '提醒（分鐘前）',
};

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (Array.isArray(v)) return v.map(String).join(', ');
  if (typeof v === 'object') return JSON.stringify(v, null, 1);
  return String(v);
}

export function ApprovalCard({ pending, onDecide }: { pending: PendingApproval; onDecide: (ok: boolean) => void }) {
  const entries = Object.entries(pending.call.arguments).filter(([, v]) => v !== undefined && v !== '');
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Hedy 想要：{pending.label}</Text>
          <Text style={styles.subtitle}>確認內容後再允許</Text>
        </View>
      </View>
      <ScrollView style={styles.body} nestedScrollEnabled>
        {entries.map(([k, v]) => (
          <View key={k} style={styles.field}>
            <Text style={styles.fieldLabel}>{LABELS[k] ?? k}</Text>
            <Text style={styles.fieldValue} selectable>
              {fmt(v)}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <Button title="拒絕" variant="ghost" onPress={() => onDecide(false)} style={{ flex: 1 }} />
        <Button title="允許" icon="checkmark" onPress={() => onDecide(true)} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    padding: spacing.md,
    maxHeight: 360,
    ...shadow,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  body: { maxHeight: 220 },
  field: { marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
});
