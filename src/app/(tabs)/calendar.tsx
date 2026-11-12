import React, { useCallback, useMemo, useState } from 'react';
import { Alert, AlertButton, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button, EmptyState, Loading } from '../../components/ui';
import { useGoogle } from '../../store/google';
import { useChat } from '../../store/chat';
import { CalendarEvent, deleteEvent, formatEventTime, listEvents } from '../../lib/google/calendar';
import { dayKey, formatDayHeader } from '../../lib/format';
import { promptText } from '../../lib/prompt';
import { colors, radius, spacing } from '../../lib/theme';

const DAYS_AHEAD = 14;

export default function CalendarScreen() {
  const router = useRouter();
  const connected = useGoogle((s) => s.connected);
  const startTask = useChat((s) => s.startTask);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connected) return;
    setRefreshing(true);
    setError(null);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + DAYS_AHEAD * 86400000);
      setEvents(await listEvents({ timeMin: start.toISOString(), timeMax: end.toISOString(), maxResults: 100 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [connected]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sections = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events ?? []) {
      const d = e.start.dateTime ? new Date(e.start.dateTime) : new Date(e.start.date + 'T00:00:00');
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, data]) => ({ title: formatDayHeader(key), data }));
  }, [events]);

  const askHedy = () => {
    promptText('讓 Hedy 安排', '例如：明天下午三點跟小明開會一小時', (text) => {
      if (!text?.trim()) return;
      void startTask(`請幫我建立行程：${text}`);
      router.navigate('/(tabs)');
    });
  };

  const onEvent = (e: CalendarEvent) => {
    const buttons: (AlertButton | undefined)[] = [
      { text: '關閉', style: 'cancel' },
      e.htmlLink ? { text: '在 Google 日曆開啟', onPress: () => void WebBrowser.openBrowserAsync(e.htmlLink!) } : undefined,
      {
        text: '讓 Hedy 調整',
        onPress: () => {
          void startTask(`我想調整這個行程（event_id=${e.id}，標題「${e.summary}」），請先問我想怎麼改。`);
          router.navigate('/(tabs)');
        },
      },
      {
        text: '刪除',
        style: 'destructive',
        onPress: () =>
          Alert.alert('刪除行程？', e.summary ?? '', [
            { text: '取消', style: 'cancel' },
            {
              text: '刪除',
              style: 'destructive',
              onPress: () =>
                deleteEvent(e.id)
                  .then(load)
                  .catch((err) => Alert.alert('刪除失敗', err instanceof Error ? err.message : String(err))),
            },
          ]),
      },
    ];
    Alert.alert(
      e.summary ?? '(無標題)',
      [formatEventTime(e), e.location, e.description].filter(Boolean).join('\n'),
      buttons.filter((b): b is AlertButton => !!b),
    );
  };

  if (!connected) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="行事曆" />
        <EmptyState
          icon="calendar-outline"
          title="還沒連結 Google 日曆"
          message="到「設定」連結 Google 帳號後，Hedy 就能幫你看行程、安排會議。"
          action={<Button title="前往設定" onPress={() => router.navigate('/(tabs)/settings')} />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="行事曆"
        subtitle={`接下來 ${DAYS_AHEAD} 天`}
        actions={[
          { icon: 'sparkles-outline', onPress: askHedy },
          { icon: 'add-circle-outline', onPress: () => router.push('/event-new') },
        ]}
      />
      {events === null && !error ? (
        <Loading text="正在載入行程…" />
      ) : error ? (
        <EmptyState icon="warning-outline" title="載入失敗" message={error} action={<Button title="重試" onPress={() => void load()} />} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e) => e.id}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={colors.primary} />}
          renderSectionHeader={({ section }) => <Text style={styles.dayHeader}>{section.title}</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => onEvent(item)} style={({ pressed }) => [styles.event, pressed && { opacity: 0.7 }]}>
              <View style={[styles.bar, { backgroundColor: item.start.date ? colors.accent : colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {item.summary ?? '(無標題)'}
                </Text>
                <Text style={styles.eventTime}>{formatEventTime(item)}</Text>
                {item.location ? (
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.eventLoc} numberOfLines={1}>
                      {item.location}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState icon="cafe-outline" title="接下來兩週沒有行程" message="點右上角的 ✨ 用一句話讓 Hedy 幫你安排。" />
          }
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dayHeader: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  event: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  bar: { width: 4, borderRadius: 2 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  eventTime: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  eventLoc: { fontSize: 12, color: colors.textMuted, flex: 1 },
});
