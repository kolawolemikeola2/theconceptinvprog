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

export default function RegisterScreen() {
  const { isDark } = useAppTheme();
  const C = getPalette(isDark);
  const s = makeStyles(isDark);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordStrong = password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password);

  const createAccount = async () => {
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      Alert.alert('Complete your details', 'Please fill in every required field.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Check your email', 'Enter a valid email address.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      Alert.alert('Check your phone number', 'Enter a valid phone number.');
      return;
    }
    if (!passwordStrong) {
      Alert.alert('Choose a stronger password', 'Use at least 8 characters, including letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Make sure both password fields are identical.');
      return;
    }
    if (!acceptedTerms) {
      Alert.alert('Agreement required', 'Please confirm that you agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim(), phone: phone.trim() } },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Registration failed', error.message);
      return;
    }
    if (data.session) {
      router.replace('/(tabs)' as never);
    } else {
      Alert.alert(
        'Check your email',
        'Your account has been created. Confirm your email using the link Supabase sent, then sign in.',
        [{ text: 'Go to sign in', onPress: () => router.replace('/login' as never) }],
      );
    }
  };

  const Field = ({
    label,
    icon,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    autoCapitalize = 'sentences',
    secureTextEntry = false,
    right,
    onSubmitEditing,
  }: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    keyboardType?: 'default' | 'email-address' | 'phone-pad';
    autoCapitalize?: 'none' | 'sentences' | 'words';
    secureTextEntry?: boolean;
    right?: React.ReactNode;
    onSubmitEditing?: () => void;
  }) => (
    <View style={s.field}>
      <Text style={[s.label, { color: C.text }]}>{label}</Text>
      <View style={[s.inputWrap, { backgroundColor: C.white, borderColor: C.border }]}>
        <Ionicons name={icon} size={19} color={C.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
          style={[s.input, { color: C.text }]}
          onSubmitEditing={onSubmitEditing}
        />
        {right}
      </View>
    </View>
  );

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
            {/* <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.canGoBack() ? router.back() : router.replace('/login')}
              style={[s.backButton, { backgroundColor: C.white, borderColor: C.border }]}
            >
              <Ionicons name="arrow-back" size={21} color={C.text} />
            </TouchableOpacity>
            <Text style={[s.topBarTitle, { color: C.text }]}>Create account</Text>
            <View style={s.topBarSpacer} /> */}
          </View>

          <View style={s.intro}>
            <View style={[s.introIcon, { backgroundColor: C.blueLight }]}>
              <Ionicons name="person-add-outline" size={25} color={C.blue} />
            </View>
            <Text style={[s.title, { color: C.text }]}>Get started</Text>
            <Text style={[s.subtitle, { color: C.muted }]}>
              Create your investor account to access The Concept Investment Program.
            </Text>
          </View>

          <View style={[s.formCard, { backgroundColor: C.bg, borderColor: C.border }]}>
            <Field
              label="Full legal name"
              icon="person-outline"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              autoCapitalize="words"
            />
            <Field
              label="Email address"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Mobile phone number"
              icon="call-outline"
              value={phone}
              onChangeText={setPhone}
              placeholder="+234 803 000 0000"
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <Field
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              autoCapitalize="none"
              secureTextEntry={!showPassword}
              right={
                <TouchableOpacity
                  onPress={() => setShowPassword(value => !value)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} />
                </TouchableOpacity>
              }
            />
            <View style={s.strengthArea}>
              <View style={s.strengthTrack}>
                <View style={[s.strengthFill, { width: password.length === 0 ? '0%' : passwordStrong ? '100%' : password.length >= 5 ? '55%' : '25%', backgroundColor: passwordStrong ? C.green : C.amber }]} />
              </View>
              <Text style={[s.strengthText, { color: passwordStrong ? C.green : C.muted }]}>
                {password.length === 0 ? 'Use 8+ characters with letters and numbers' : passwordStrong ? 'Password meets the basic requirements' : 'Password needs at least 8 characters, letters and numbers'}
              </Text>
            </View>
            <Field
              label="Confirm password"
              icon="shield-checkmark-outline"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Enter your password again"
              autoCapitalize="none"
              secureTextEntry={!showConfirmPassword}
              right={
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(value => !value)}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  hitSlop={8}
                >
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} />
                </TouchableOpacity>
              }
            />
            {confirmPassword.length > 0 && (
              <View style={s.matchRow}>
                <Ionicons
                  name={password === confirmPassword ? 'checkmark-circle' : 'alert-circle'}
                  size={15}
                  color={password === confirmPassword ? C.green : C.red}
                />
                <Text style={[s.matchText, { color: password === confirmPassword ? C.green : C.red }]}>
                  {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={s.termsRow}
              onPress={() => setAcceptedTerms(value => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
            >
              <View style={[s.checkbox, { borderColor: acceptedTerms ? C.blue : C.border, backgroundColor: acceptedTerms ? C.blue : C.white }]}>
                {acceptedTerms && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={[s.termsText, { color: C.muted }]}>
                I agree to the Terms of Service and Privacy Policy.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={createAccount}
              disabled={loading}
              style={[s.primaryButton, { backgroundColor: C.navy, opacity: loading ? 0.7 : 1 }]}
            >
              <Text style={s.primaryButtonText}>{loading ? 'Creating account…' : 'Create investor account'}</Text>
              {!loading && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>

          <View style={s.footerRow}>
            <Text style={[s.footerText, { color: C.muted }]}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.replace('/login' as never)} accessibilityRole="button">
              <Text style={[s.link, { color: C.blue }]}>Sign in</Text>
            </TouchableOpacity>
          </View>
          <View style={s.securityNote}>
            {/* <Ionicons name="shield-checkmark-outline" size={16} color={C.green} /> */}
            <Text style={[s.securityText, { color: C.muted }]}>
              {/* Your password should be securely handled by your authentication provider and never stored as plain text. */}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (dark: boolean) => {
  const C = getPalette(dark);
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 32 },
    topBar: { minHeight: 60, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { width: 42, height: 42, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    topBarTitle: { fontSize: 15, fontWeight: '800' },
    topBarSpacer: { width: 42 },
    intro: { marginTop: 20, marginBottom: 22, alignItems: 'flex-start', gap: 8 },
    introIcon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
    title: { fontSize: 29, fontWeight: '900', letterSpacing: -0.8 },
    subtitle: { fontSize: 13, lineHeight: 20 },
    formCard: { borderWidth: 1, borderRadius: 22, padding: 17, gap: 15 },
    field: { gap: 7 },
    label: { fontSize: 12, fontWeight: '800' },
    inputWrap: { minHeight: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
    input: { flex: 1, minHeight: 48, paddingVertical: 10, fontSize: 13 },
    strengthArea: { gap: 6, marginTop: -7 },
    strengthTrack: { height: 4, borderRadius: 4, backgroundColor: C.border, overflow: 'hidden' },
    strengthFill: { height: '100%', borderRadius: 4 },
    strengthText: { fontSize: 9, lineHeight: 13 },
    matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -8 },
    matchText: { fontSize: 10, fontWeight: '700' },
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 2 },
    checkbox: { width: 19, height: 19, borderWidth: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
    termsText: { flex: 1, fontSize: 10, lineHeight: 16 },
    primaryButton: { minHeight: 51, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 2 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 22 },
    footerText: { fontSize: 11 },
    link: { fontSize: 11, fontWeight: '800' },
    securityNote: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 7, marginTop: 18, paddingHorizontal: 10 },
    securityText: { flex: 1, fontSize: 9, lineHeight: 14 },
  });
};
