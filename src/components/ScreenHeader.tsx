import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../lib/theme';

export type HeaderAction = { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label?: string };

export function ScreenHeader({
  title,
  subtitle,
  left,
  actions = [],
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  actions?: HeaderAction[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      {left && <View style={{ marginRight: 10 }}>{left}</View>}
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions.map((a, i) => (
        <Pressable key={i} onPress={a.onPress} hitSlop={8} style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
          <Ionicons name={a.icon} size={22} color={colors.primary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    backgroundColor: colors.background,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  action: { marginLeft: 14 },
});
