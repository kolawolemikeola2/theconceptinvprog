import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getPalette, useAppTheme } from '../../constants/app-theme';
import { supabase } from '../../lib/supabase';

function BrandMark({ dark }: { dark: boolean }) {
  const C = getPalette(dark);
  return (
    <View style={[styles.brandMark, { backgroundColor: C.white, borderColor: C.border }]}>
      <View style={[styles.brandC, { borderColor: C.blue }]} />
      <View style={[styles.brandArrow, { backgroundColor: C.green }]} />
    </View>
  );
}

export default function LoginScreen() {
  const { isDark } = useAppTheme();
  const C = getPalette(isDark);
  const s = makeStyles(isDark);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email address and password to continue.');
      return;
    }
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!validEmail) {
      Alert.alert('Check your email', 'Enter a valid email address.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign in failed', error.message);
      return;
    }
    router.replace('/(tabs)' as never);
  };

  const forgotPassword = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Reset password', 'Enter a valid email address first.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setLoading(false);
    if (error) Alert.alert('Could not send reset email', error.message);
    else Alert.alert('Check your email', 'If an account exists for this email, Supabase will send a password-reset link.');
  };

  return (
    <View style={[s.screen, { backgroundColor: C.bg }]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.topBar}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
              style={[s.backButton, { backgroundColor: C.white, borderColor: C.border }]}
            >
              <Ionicons name="arrow-back" size={21} color={C.text} />
            </TouchableOpacity>
            <Text style={[s.topBarTitle, { color: C.text }]}>Sign in</Text>
            <View style={s.topBarSpacer} />
          </View>

          <View style={s.brandArea}>
            <BrandMark dark={isDark} />
            <Text style={[s.brandName, { color: C.navy }]}>THE CONCEPT</Text>
            <Text style={[s.brandSub, { color: C.muted }]}>INVESTMENT PROGRAM</Text>
          </View>

          <View style={s.intro}>
            <Text style={[s.title, { color: C.text }]}>Welcome back</Text>
            <Text style={[s.subtitle, { color: C.muted }]}>
              Sign in to securely access your investment portfolio.
            </Text>
          </View>

          <View style={[s.formCard, { backgroundColor: C.white, borderColor: C.border }]}>
            <Text style={[s.label, { color: C.text }]}>Email address</Text>
            <View style={[s.inputWrap, { backgroundColor: C.bg, borderColor: C.border }]}>
              <Ionicons name="mail-outline" size={19} color={C.muted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={C.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                style={[s.input, { color: C.text }]}
                accessibilityLabel="Email address"
              />
            </View>

            <View style={s.labelRow}>
              <Text style={[s.label, { color: C.text }]}>Password</Text>
              <TouchableOpacity onPress={forgotPassword} accessibilityRole="button">
                <Text style={[s.link, { color: C.blue }]}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <View style={[s.inputWrap, { backgroundColor: C.bg, borderColor: C.border }]}>
              <Ionicons name="lock-closed-outline" size={19} color={C.muted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={C.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={signIn}
                style={[s.input, { color: C.text }]}
                accessibilityLabel="Password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(value => !value)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={8}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={s.rememberRow}
              onPress={() => setRememberMe(value => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
            >
              <View style={[s.checkbox, { borderColor: rememberMe ? C.blue : C.border, backgroundColor: rememberMe ? C.blue : C.white }]}>
                {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={[s.rememberText, { color: C.muted }]}>Remember me on this device</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={signIn}
              disabled={loading}
              style={[s.primaryButton, { backgroundColor: C.navy, opacity: loading ? 0.7 : 1 }]}
            >
              {loading ? <Ionicons name="sync-outline" size={18} color="#FFFFFF" /> : null}
              <Text style={s.primaryButtonText}>{loading ? 'Checking details…' : 'Sign in securely'}</Text>
              {!loading && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
            <View style={s.secureNote}>
              <Ionicons name="shield-checkmark-outline" size={16} color={C.green} />
              <Text style={[s.secureText, { color: C.muted }]}>Your account credentials should be verified securely by the authentication service.</Text>
            </View>
          </View>

          <View style={s.footerRow}>
            <Text style={[s.footerText, { color: C.muted }]}>New to The Concept?</Text>
            <TouchableOpacity onPress={() => router.push('/register' as never)} accessibilityRole="button">
              <Text style={[s.link, { color: C.blue }]}>Create an account</Text>
            </TouchableOpacity>
          </View>
          <Text style={[s.legal, { color: C.muted }]}>By continuing, you agree to the applicable account terms and privacy policy.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brandMark: { width: 70, height: 70, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandC: { width: 39, height: 39, borderWidth: 5, borderRightColor: 'transparent', borderRadius: 22, transform: [{ rotate: '-20deg' }] },
  brandArrow: { position: 'absolute', width: 22, height: 4, right: 10, top: 23, borderRadius: 3, transform: [{ rotate: '-42deg' }] },
});

const makeStyles = (dark: boolean) => {
  const C = getPalette(dark);
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    screen: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 30 },
    topBar: { minHeight: 60, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { width: 42, height: 42, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    topBarTitle: { fontSize: 15, fontWeight: '800' },
    topBarSpacer: { width: 42 },
    brandArea: { alignItems: 'center', marginTop: 20, marginBottom: 28 },
    brandName: { fontSize: 12, fontWeight: '900', letterSpacing: 2.1, marginTop: 12 },
    brandSub: { fontSize: 8, fontWeight: '800', letterSpacing: 2.2, marginTop: 4 },
    intro: { marginBottom: 20, gap: 7 },
    title: { fontSize: 29, fontWeight: '900', letterSpacing: -0.8 },
    subtitle: { fontSize: 13, lineHeight: 20 },
    formCard: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 11, shadowColor: '#000', shadowOpacity: dark ? 0.12 : 0.04, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
    label: { fontSize: 12, fontWeight: '800' },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    link: { fontSize: 11, fontWeight: '800' },
    inputWrap: { minHeight: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
    input: { flex: 1, minHeight: 48, paddingVertical: 10, fontSize: 13 },
    rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5, marginTop: 2 },
    checkbox: { width: 19, height: 19, borderWidth: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
    rememberText: { fontSize: 11 },
    primaryButton: { minHeight: 51, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 7 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    secureNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
    secureText: { flex: 1, fontSize: 9, lineHeight: 14 },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 24 },
    footerText: { fontSize: 11 },
    legal: { fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 17, paddingHorizontal: 12 },
  });
};
