import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Loading } from '../../components/ui';
import { archiveEmail, EmailDetail, getEmail, markRead, trashEmail } from '../../lib/google/gmail';
import { formatDateTime, parseSender } from '../../lib/format';
import { useChat } from '../../store/chat';
import { colors, spacing } from '../../lib/theme';

export default function MailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const startTask = useChat((s) => s.startTask);
  const [mail, setMail] = useState<EmailDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getEmail(id)
      .then((m) => {
        setMail(m);
        if (m.unread) void markRead(m.id).catch(() => undefined);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  const askHedy = (prompt: string) => {
    void startTask(prompt);
    router.navigate('/(tabs)');
  };

  const doAction = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      router.back();
    } catch (e) {
      Alert.alert('失敗', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (error) return <EmptyState icon="warning-outline" title="無法載入信件" message={error} />;
  if (!mail) return <Loading />;

  const sender = parseSender(mail.from);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.subject}>{mail.subject}</Text>
      <View style={styles.meta}>
        <Text style={styles.sender}>{sender.name}</Text>
        <Text style={styles.email}>{sender.email}</Text>
        <Text style={styles.email}>收件人：{mail.to}</Text>
        {mail.cc ? <Text style={styles.email}>副本：{mail.cc}</Text> : null}
        <Text style={styles.date}>{formatDateTime(mail.date)}</Text>
      </View>

      <View style={styles.hedyRow}>
        <Button
          small
          icon="sparkles"
          title="摘要重點"
          variant="secondary"
          onPress={() => askHedy(`請讀取並摘要這封信（message_id=${mail.id}），告訴我重點、是否需要回覆或行動。`)}
        />
        <Button
          small
          icon="chatbubble-ellipses"
          title="草擬回覆"
          variant="secondary"
          onPress={() => askHedy(`請讀取這封信（message_id=${mail.id}），幫我草擬一封合適的回覆，先給我看內容再寄。`)}
        />
      </View>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.body} selectable>
          {mail.bodyText || '(沒有文字內容)'}
        </Text>
      </Card>

      {mail.attachments.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={styles.attachTitle}>附件</Text>
          {mail.attachments.map((a) => (
            <View key={a.attachmentId} style={styles.attach}>
              <Ionicons name="attach" size={16} color={colors.textSecondary} />
              <Text style={styles.attachName} numberOfLines={1}>
                {a.filename}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Button
          icon="arrow-undo"
          title="回覆"
          onPress={() => router.push({ pathname: '/compose', params: { replyTo: mail.id, subject: mail.subject, to: mail.from } })}
          style={{ flex: 1 }}
        />
        <Button
          icon="archive-outline"
          title="封存"
          variant="secondary"
          loading={busy === 'archive'}
          onPress={() => void doAction('archive', () => archiveEmail(mail.id))}
        />
        <Button
          icon="trash-outline"
          title="刪除"
          variant="danger"
          loading={busy === 'trash'}
          onPress={() =>
            Alert.alert('移到垃圾桶？', mail.subject, [
              { text: '取消', style: 'cancel' },
              { text: '刪除', style: 'destructive', onPress: () => void doAction('trash', () => trashEmail(mail.id)) },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subject: { fontSize: 20, fontWeight: '800', color: colors.text, lineHeight: 28 },
  meta: { marginTop: spacing.sm, gap: 2 },
  sender: { fontSize: 15, fontWeight: '700', color: colors.text },
  email: { fontSize: 13, color: colors.textSecondary },
  date: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  hedyRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  body: { fontSize: 15, lineHeight: 23, color: colors.text },
  attachTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  attachName: { fontSize: 14, color: colors.text, flex: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.xl },
});
