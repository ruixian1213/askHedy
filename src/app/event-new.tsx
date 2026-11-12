import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Field } from '../components/ui';
import { createEvent } from '../lib/google/calendar';
import { dayKey, localISO } from '../lib/format';
import { colors, spacing } from '../lib/theme';

export default function EventNewScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dayKey(new Date()));
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return Alert.alert('請填標題');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('日期格式', '請用 YYYY-MM-DD');
    if (!allDay && (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end))) return Alert.alert('時間格式', '請用 HH:mm');
    setSaving(true);
    try {
      let endDate = date;
      if (allDay) {
        const d = new Date(date + 'T00:00:00');
        endDate = dayKey(new Date(d.getTime() + 86400000));
      }
      await createEvent({
        summary: title.trim(),
        start: allDay ? date : localISO(date, start),
        end: allDay ? endDate : localISO(date, end),
        allDay,
        location: location || undefined,
        description: description || undefined,
      });
      router.back();
    } catch (e) {
      Alert.alert('建立失敗', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Field label="標題" value={title} onChangeText={setTitle} placeholder="跟小明開會" />
      <Field label="日期" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>整天</Text>
        <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: colors.primary }} />
      </View>
      {!allDay && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="開始" value={start} onChangeText={setStart} placeholder="HH:mm" keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="結束" value={end} onChangeText={setEnd} placeholder="HH:mm" keyboardType="numbers-and-punctuation" />
          </View>
        </View>
      )}
      <Field label="地點" value={location} onChangeText={setLocation} placeholder="選填" />
      <Field label="說明" value={description} onChangeText={setDescription} placeholder="選填" multiline />
      <Button title="建立行程" icon="checkmark" loading={saving} onPress={() => void save()} />
      <Text style={styles.hint}>想用自然語言？回行事曆按 ✨ 讓 Hedy 幫你安排。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  switchLabel: { fontSize: 15, color: colors.text, fontWeight: '500' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
