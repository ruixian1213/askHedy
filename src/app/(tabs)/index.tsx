import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { HedyAvatar } from '../../components/HedyAvatar';
import { MessageBubble } from '../../components/MessageBubble';
import { ApprovalCard } from '../../components/ApprovalCard';
import { Chip } from '../../components/ui';
import { useChat } from '../../store/chat';
import { useSettings } from '../../store/settings';
import { useGoogle } from '../../store/google';
import { colors, radius, spacing } from '../../lib/theme';
import { toolByName } from '../../lib/agent/tools';

const SUGGESTIONS = [
  { icon: 'mail-unread-outline' as const, text: '幫我看今天有哪些未讀信，挑出需要回的' },
  { icon: 'calendar-outline' as const, text: '整理我這週的行程，提醒我有沒有衝突' },
  { icon: 'document-text-outline' as const, text: '找 Drive 裡最近修改的文件並摘要' },
  { icon: 'create-outline' as const, text: '幫我草擬一封信跟老師請假' },
];

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  const conversations = useChat((s) => s.conversations);
  const currentId = useChat((s) => s.currentId);
  const running = useChat((s) => s.running);
  const runningTool = useChat((s) => s.runningTool);
  const pending = useChat((s) => s.pending);
  const send = useChat((s) => s.send);
  const stop = useChat((s) => s.stop);
  const resolveApproval = useChat((s) => s.resolveApproval);
  const newConversation = useChat((s) => s.newConversation);

  const providers = useSettings((s) => s.providers);
  const activeId = useSettings((s) => s.prefs.activeProviderId);
  const userName = useSettings((s) => s.prefs.userName);
  const googleConnected = useGoogle((s) => s.connected);

  const provider = providers.find((p) => p.id === activeId) ?? providers[0];
  const conversation = conversations.find((c) => c.id === currentId) ?? null;
  const messages = useMemo(() => [...(conversation?.messages ?? [])].reverse(), [conversation]);

  const onSend = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    void send(t);
  };

  const statusText = runningTool ? `正在${toolByName(runningTool)?.label ?? runningTool}…` : 'Hedy 正在思考…';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="HEDY"
        subtitle={provider ? `${provider.name} · ${provider.model}` : '尚未設定 AI 模型'}
        left={<HedyAvatar size={40} ring />}
        actions={[
          { icon: 'time-outline', onPress: () => router.push('/conversations') },
          { icon: 'create-outline', onPress: () => newConversation() },
        ]}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <HedyAvatar size={120} ring />
            <Text style={styles.hello}>嗨{userName ? `，${userName}` : ''}！我是 Hedy 🌸</Text>
            <Text style={styles.helloSub}>
              我可以幫你讀信、回信、安排行程、找檔案。
              {!googleConnected && '\n先到「設定」連結 Google 帳號吧！'}
              {!provider && '\n也別忘了在「設定」加一個 AI 模型。'}
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s.text} style={styles.suggestion} onPress={() => void send(s.text)}>
                  <Ionicons name={s.icon} size={18} color={colors.primary} />
                  <Text style={styles.suggestionText}>{s.text}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={{ paddingVertical: spacing.md }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          />
        )}

        {pending && <ApprovalCard pending={pending} onDecide={resolveApproval} />}

        {running && (
          <View style={styles.status}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>{statusText}</Text>
            <Pressable onPress={stop} hitSlop={8}>
              <Text style={styles.stopText}>停止</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {messages.length > 0 && !running && (
            <View style={styles.quickRow}>
              <Chip label="再多說一點" onPress={() => void send('請再詳細說明一下')} />
              <Chip label="好，就這樣做" onPress={() => void send('好，就這樣做')} />
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="跟 Hedy 說點什麼…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              editable={!running}
              onSubmitEditing={onSend}
              blurOnSubmit
              returnKeyType="send"
            />
            <Pressable
              onPress={onSend}
              disabled={running || !text.trim()}
              style={[styles.sendBtn, (running || !text.trim()) && { opacity: 0.4 }]}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', paddingTop: 30, paddingHorizontal: spacing.xl },
  hello: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: spacing.lg },
  helloSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  suggestions: { width: '100%', marginTop: spacing.xl, gap: 10 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  suggestionText: { color: colors.text, fontSize: 14, flex: 1 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  statusText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  stopText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  inputBar: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  quickRow: { flexDirection: 'row', paddingHorizontal: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 130,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    color: colors.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
