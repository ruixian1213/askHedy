import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HedyAvatar } from './HedyAvatar';
import { SimpleMarkdown } from './SimpleMarkdown';
import { colors, radius, spacing } from '../lib/theme';
import { UIMessage } from '../store/chat';
import { toolByName } from '../lib/agent/tools';

export function MessageBubble({ message }: { message: UIMessage }) {
  if (message.role === 'user') {
    return (
      <View style={[styles.rowRight]}>
        <View style={[styles.bubble, styles.bubbleUser]}>
          <Text style={styles.userText} selectable>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  if (message.role === 'assistant') {
    if (!message.content) return null;
    return (
      <View style={styles.rowLeft}>
        <HedyAvatar size={30} />
        <View style={[styles.bubble, styles.bubbleAssistant]}>
          <SimpleMarkdown>{message.content}</SimpleMarkdown>
        </View>
      </View>
    );
  }

  if (message.role === 'tool') {
    const spec = toolByName(message.name);
    const label = spec?.label ?? message.name;
    return (
      <View style={styles.toolRow}>
        <Ionicons
          name={message.isError ? 'alert-circle' : 'checkmark-circle'}
          size={14}
          color={message.isError ? colors.danger : colors.accent}
        />
        <Text style={[styles.toolText, message.isError && { color: colors.danger }]} numberOfLines={2}>
          {label}
          {message.isError ? `：${message.content.slice(0, 120)}` : ''}
        </Text>
      </View>
    );
  }

  if (message.role === 'note') {
    const tone =
      message.kind === 'error'
        ? { bg: colors.dangerSoft, fg: colors.danger, icon: 'warning' as const }
        : message.kind === 'denied'
          ? { bg: colors.surfaceAlt, fg: colors.textSecondary, icon: 'close-circle' as const }
          : message.kind === 'approved'
            ? { bg: colors.accentSoft, fg: colors.accent, icon: 'shield-checkmark' as const }
            : { bg: colors.blueSoft, fg: colors.blue, icon: 'information-circle' as const };
    return (
      <View style={[styles.note, { backgroundColor: tone.bg }]}>
        <Ionicons name={tone.icon} size={14} color={tone.fg} />
        <Text style={[styles.noteText, { color: tone.fg }]}>{message.content}</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  rowRight: { flexDirection: 'row', justifyContent: 'flex-end', marginVertical: 4, paddingHorizontal: spacing.md },
  rowLeft: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4, paddingHorizontal: spacing.md, gap: 8 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  bubbleUser: { backgroundColor: colors.bubbleUser, borderBottomRightRadius: 6 },
  bubbleAssistant: {
    backgroundColor: colors.bubbleAssistant,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: 2,
  },
  userText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 54,
    marginVertical: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    maxWidth: '80%',
  },
  toolText: { fontSize: 12, color: colors.textSecondary },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    maxWidth: '90%',
  },
  noteText: { fontSize: 12, flexShrink: 1 },
});
