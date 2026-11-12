import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View } from 'react-native';
import { useSettings } from '../store/settings';
import { useGoogle } from '../store/google';
import { useChat } from '../store/chat';
import { colors } from '../lib/theme';
import { Loading } from '../components/ui';

export default function RootLayout() {
  const settingsLoaded = useSettings((s) => s.loaded);
  const googleLoaded = useGoogle((s) => s.loaded);
  const chatLoaded = useChat((s) => s.loaded);

  useEffect(() => {
    void useSettings.getState().load();
    void useGoogle.getState().load();
    void useChat.getState().load();
  }, []);

  const ready = settingsLoaded && googleLoaded && chatLoaded;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      {!ready ? (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <Loading />
        </View>
      ) : (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text, fontWeight: '700' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
            headerBackTitle: '返回',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="mail/[id]" options={{ title: '信件' }} />
          <Stack.Screen name="compose" options={{ title: '撰寫郵件', presentation: 'modal' }} />
          <Stack.Screen name="provider" options={{ title: 'AI 模型', presentation: 'modal' }} />
          <Stack.Screen name="conversations" options={{ title: '對話紀錄', presentation: 'modal' }} />
          <Stack.Screen name="event-new" options={{ title: '新增行程', presentation: 'modal' }} />
          <Stack.Screen name="memory" options={{ title: 'Hedy 的記憶' }} />
        </Stack>
      )}
    </GestureHandlerRootView>
  );
}
