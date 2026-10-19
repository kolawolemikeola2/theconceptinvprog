
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';

import { AppThemeProvider, getPalette } from '../constants/app-theme';
import { supabase } from '../lib/supabase';

function RootNavigator() {
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDark] = useState(false);

  const C = getPalette(isDark);

  useEffect(() => {
    let alive = true;

    const loadSession = async () => {
      try {
        const result = await supabase.auth.getSession();

        if (alive) {
          setSession(result.data.session);
        }
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        if (alive) {
          setAuthLoading(false);
        }
      }
    };

    void loadSession();

    const { data: authListener } =
      supabase.auth.onAuthStateChange((_event: any, nextSession: React.SetStateAction<Session | null>) => {
        if (alive) {
          setSession(nextSession);
          setAuthLoading(false);
        }
      });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const firstSegment: string | undefined = segments[0];
    const inAuthGroup = firstSegment === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, authLoading, segments]);

  if (authLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: C.bg,
        }}
      >
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin-review" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}
