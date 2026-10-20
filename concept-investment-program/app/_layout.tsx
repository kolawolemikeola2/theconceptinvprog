
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Stack, router, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';

import { AppThemeProvider, getPalette } from '../constants/app-theme';
import { supabase } from '../lib/supabase';

async function registerPushToken(userId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn(
      'Push registration skipped: no verified authenticated user.',
      authError?.message
    );
    return;
  }

  if (user.id !== userId) {
    console.warn('Push registration skipped: user ID mismatch.');
    return;
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === 'granted'
      ? existing
      : await Notifications.requestPermissionsAsync();

  if (permission.status !== 'granted') {
    console.warn('Push registration skipped: notification permission denied.');
    return;
  }

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    console.warn('Push registration skipped: Expo project ID is missing.');
    return;
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({ projectId })
  ).data;

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: user.id,
      expo_push_token: token,
      device_type: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'expo_push_token' }
  );

  if (error) {
    console.warn('Could not register push token:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      userId: user.id,
    });
  } else {
    console.log('Push token registered successfully.');
  }
}


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
    if (!session?.user?.id) return;
    let alive = true;
    (async () => {
      const { data: profile, error } = await supabase.from('profiles').select('account_status').eq('id', session.user.id).maybeSingle();
      if (!alive) return;
      if (!error && profile?.account_status === 'suspended') {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
        return;
      }
      registerPushToken(session.user.id).catch((pushError) => console.warn('Push registration failed:', pushError));
    })().catch((error) => console.warn('Account status check failed:', error));
    return () => { alive = false; };
  }, [session?.user?.id]);

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
