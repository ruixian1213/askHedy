import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Field } from '../components/ui';
import { replyToEmail, sendEmail } from '../lib/google/gmail';
import { chat } from '../lib/llm';
import { useSettings } from '../store/settings';
import { promptText } from '../lib/prompt';
import { colors, spacing } from '../lib/theme';

export default function ComposeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ replyTo?: string; to?: string; subject?: string }>();
  const isReply = !!params.replyTo;
  const activeProvider = useSettings((s) => s.activeProvider);
  const userName = useSettings((s) => s.prefs.userName);

  const [to, setTo] = useState(params.to ?? '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(params.subject ? (isReply && !/^re:/i.test(params.subject) ? `Re: ${params.subject}` : params.subject) : '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const draftWithHedy = () => {
    const provider = activeProvider();
    if (!provider) {
      Alert.alert('還沒設定 AI 模型', '請先到「設定」新增一個供應商。');
      return;
    }
    promptText('讓 Hedy 幫你寫', '用一句話說明你想表達什麼', async (brief) => {
        if (!brief?.trim()) return;
        setDrafting(true);
        try {
          const r = await chat({
            provider,
            maxTokens: 1500,
            messages: [
              {
                role: 'system',
                content: `你是 HEDY，幫使用者${userName ? `（${userName}）` : ''}撰寫電子郵件。只輸出信件內文（純文字，不含主旨、不含任何說明），語氣依對象調整，結尾署名${userName || '使用者'}。使用與使用者相同的語言。`,
              },
              {
                role: 'user',
                content: `收件人：${to || '（未填）'}\n主旨：${subject || '（未填）'}\n${body ? `目前草稿：\n${body}\n\n` : ''}我想說：${brief}`,
              },
            ],
          });
          setBody(r.text.trim());
        } catch (e) {
          Alert.alert('草擬失敗', e instanceof Error ? e.message : String(e));
        } finally {
          setDrafting(false);
        }
      });
  };

  const doSend = () => {
    if (!isReply && !to.trim()) return Alert.alert('請填收件人');
    if (!body.trim()) return Alert.alert('內容是空的');
    Alert.alert(isReply ? '寄出回覆？' : '寄出郵件？', `給：${to}\n主旨：${subject || '(無主旨)'}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '寄出',
        onPress: async () => {
          setSending(true);
          try {
            if (isReply && params.replyTo) await replyToEmail({ messageId: params.replyTo, body });
            else await sendEmail({ to, cc: cc || undefined, subject, body });
            router.back();
          } catch (e) {
            Alert.alert('寄送失敗', e instanceof Error ? e.message : String(e));
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Field label="收件人" value={to} onChangeText={setTo} placeholder="someone@example.com" autoCapitalize="none" keyboardType="email-address" editable={!isReply} />
        {!isReply && <Field label="副本" value={cc} onChangeText={setCc} placeholder="選填" autoCapitalize="none" keyboardType="email-address" />}
        <Field label="主旨" value={subject} onChangeText={setSubject} placeholder="主旨" />
        <Field label="內容" value={body} onChangeText={setBody} placeholder="寫點什麼，或讓 Hedy 幫你起草…" multiline style={{ minHeight: 220 }} />
        <View style={styles.actions}>
          <Button title="讓 Hedy 幫我寫" icon="sparkles" variant="secondary" loading={drafting} onPress={draftWithHedy} style={{ flex: 1 }} />
          <Button title="寄出" icon="send" loading={sending} onPress={doSend} style={{ flex: 1 }} />
        </View>
        <Text style={styles.hint}>寄出前會再跟你確認一次。</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.sm },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
