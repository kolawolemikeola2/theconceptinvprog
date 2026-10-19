import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getPalette, useAppTheme } from '../../constants/app-theme';

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default function ReinvestScreen() {
  const { isDark } = useAppTheme();
  const C = getPalette(isDark);
  const s = makeStyles(isDark);
  const availableROI = 250;
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [amountText, setAmountText] = useState('250');
  const [acknowledged, setAcknowledged] = useState(false);
  const amount = useMemo(() => Number(amountText.replace(/[$,\s]/g, '')) || 0, [amountText]);
  const valid = amount > 0 && amount <= availableROI && (mode === 'full' || amountText.trim().length > 0);

  const chooseMode = (next: 'full' | 'partial') => {
    setMode(next);
    setAmountText(next === 'full' ? String(availableROI) : '');
  };

  const submit = () => {
    if (!valid) {
      Alert.alert('Check amount', `Enter an amount greater than $0 and no more than ${money(availableROI)}.`);
      return;
    }
    if (!acknowledged) {
      Alert.alert('Confirmation required', 'Please confirm that you understand this is a reinvestment request and not a completed transaction.');
      return;
    }
    Alert.alert(
      'Request ready',
      `Your demo reinvestment request for ${money(amount)} is ready. Connect this screen to your backend to submit and record the request.`,
      [{ text: 'Done', onPress: () => router.back() }]
    );
  };

  return (
    <View style={[s.screen, { backgroundColor: C.bg }]}>
      <View style={[s.fixedHeader, { backgroundColor: C.bg, borderBottomColor: C.border }]}>
        <View style={s.headerRow}>
          <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()} style={[s.backButton, { backgroundColor: C.white, borderColor: C.border }]}>
            <Ionicons name="arrow-back" size={21} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: C.blue }]}>THE CONCEPT · INVESTOR PORTAL</Text>
            <Text style={[s.title, { color: C.text }]}>Reinvest ROI</Text>
            <Text style={[s.subtitle, { color: C.muted }]}>Put an eligible ROI payment back to work</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.scrollArea} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[s.availableCard, { backgroundColor: C.navy }]}>
            <View style={s.availableTop}>
              <View style={s.availableIcon}><Ionicons name="wallet-outline" size={23} color="#6FFBBE" /></View>
              <View style={[s.availableBadge, { backgroundColor: '#253A50' }]}><View style={s.availableDot} /><Text style={s.availableBadgeText}>ILLUSTRATIVE BALANCE</Text></View>
            </View>
            <Text style={s.availableLabel}>AVAILABLE ROI TO REINVEST</Text>
            <Text style={s.availableAmount}>{money(availableROI)}</Text>
            <Text style={s.availableSub}>ROI cycle · October 2026 · CIP-ROI-2026-007</Text>
          </View>

          <View style={[s.card, { backgroundColor: C.white, borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Choose reinvestment amount</Text>
            <Text style={[s.helper, { color: C.muted }]}>Select the full illustrative ROI payment or enter a smaller amount.</Text>
            <View style={s.modeRow}>
              <TouchableOpacity onPress={() => chooseMode('full')} style={[s.modeCard, { backgroundColor: mode === 'full' ? C.blueLight : C.bg, borderColor: mode === 'full' ? C.blue : C.border }]}>
                <Ionicons name="checkmark-circle" size={19} color={mode === 'full' ? C.blue : C.muted} />
                <Text style={[s.modeTitle, { color: C.text }]}>Reinvest full ROI</Text>
                <Text style={[s.modeAmount, { color: C.blue }]}>{money(availableROI)}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => chooseMode('partial')} style={[s.modeCard, { backgroundColor: mode === 'partial' ? C.blueLight : C.bg, borderColor: mode === 'partial' ? C.blue : C.border }]}>
                <Ionicons name="options-outline" size={19} color={mode === 'partial' ? C.blue : C.muted} />
                <Text style={[s.modeTitle, { color: C.text }]}>Choose amount</Text>
                <Text style={[s.modeAmount, { color: C.blue }]}>Partial</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.inputLabel, { color: C.muted }]}>AMOUNT TO REINVEST (USD)</Text>
            <View style={[s.inputWrap, { backgroundColor: C.bg, borderColor: C.border }]}>
              <Text style={[s.currency, { color: C.text }]}>$</Text>
              <TextInput
                value={amountText}
                onChangeText={(value) => { setAmountText(value.replace(/[^0-9.]/g, '')); setMode('partial'); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.muted}
                editable={mode === 'partial'}
                style={[s.input, { color: C.text }]}
                accessibilityLabel="Amount to reinvest in US dollars"
              />
              <Text style={[s.currencyCode, { color: C.muted }]}>USD</Text>
            </View>
            <View style={s.amountMeta}>
              <Text style={[s.helper, { color: C.muted }]}>Minimum: $0.01</Text>
              <Text style={[s.helper, { color: amount <= availableROI && amount > 0 ? C.green : C.red }]}>{money(Math.max(0, availableROI - amount))} remains</Text>
            </View>
            {(!valid) && <Text style={[s.validation, { color: C.red }]}>Enter an amount above $0 and no greater than {money(availableROI)}.</Text>}
          </View>

          <View style={[s.card, { backgroundColor: C.white, borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Request summary</Text>
            <View style={s.summaryRow}><Text style={[s.summaryLabel, { color: C.muted }]}>Available ROI</Text><Text style={[s.summaryValue, { color: C.text }]}>{money(availableROI)}</Text></View>
            <View style={s.summaryRow}><Text style={[s.summaryLabel, { color: C.muted }]}>Reinvestment amount</Text><Text style={[s.summaryValue, { color: C.blue }]}>{money(amount)}</Text></View>
            <View style={[s.summaryRow, s.summaryTotal, { borderTopColor: C.border }]}><Text style={[s.summaryLabel, { color: C.text, fontWeight: '800' }]}>Remaining for payout</Text><Text style={[s.summaryValue, { color: C.text }]}>{money(Math.max(0, availableROI - amount))}</Text></View>
            <TouchableOpacity onPress={() => setAcknowledged(v => !v)} style={s.checkRow} activeOpacity={0.75}>
              <View style={[s.checkbox, { borderColor: acknowledged ? C.blue : C.border, backgroundColor: acknowledged ? C.blue : C.white }]}>{acknowledged && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}</View>
              <Text style={[s.ackText, { color: C.muted }]}>I confirm this is a request to reinvest my selected ROI amount. I understand it is subject to eligibility and company confirmation.</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.notice, { backgroundColor: C.blueLight }]}>
            <Ionicons name="information-circle-outline" size={18} color={C.blue} />
            <Text style={[s.noticeText, { color: C.softText }]}>Demo only: this screen does not transfer funds or change your contract. The available balance and ROI values must be replaced with verified backend data before production use.</Text>
          </View>

          <TouchableOpacity onPress={submit} style={[s.primaryButton, { backgroundColor: valid && acknowledged ? C.blue : C.muted, opacity: valid && acknowledged ? 1 : 0.7 }]}>
            <Ionicons name="repeat-outline" size={18} color="#FFFFFF" />
            <Text style={s.primaryButtonText}>Review reinvestment request</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (dark: boolean) => {
  const C = getPalette(dark);
  return StyleSheet.create({
    screen: { flex: 1 },
    fixedHeader: { paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1, zIndex: 5 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    backButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    eyebrow: { fontSize: 8, fontWeight: '800', letterSpacing: 1, marginBottom: 5 },
    title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
    subtitle: { fontSize: 10, marginTop: 4 },
    scrollArea: { flex: 1 },
    content: { padding: 18, paddingTop: 16, paddingBottom: 38, gap: 15 },
    availableCard: { borderRadius: 20, padding: 19, gap: 12 },
    availableTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    availableIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#253A50', alignItems: 'center', justifyContent: 'center' },
    availableBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 7 },
    availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6FFBBE' },
    availableBadgeText: { color: '#C6D0DE', fontSize: 8, fontWeight: '900', letterSpacing: 0.3 },
    availableLabel: { color: '#AAB8CC', fontSize: 9, fontWeight: '800', letterSpacing: 0.7, marginTop: 4 },
    availableAmount: { color: '#FFFFFF', fontSize: 33, fontWeight: '900', letterSpacing: -0.8 },
    availableSub: { color: '#AAB8CC', fontSize: 9 },
    card: { borderWidth: 1, borderRadius: 17, padding: 16, gap: 11 },
    sectionTitle: { fontSize: 15, fontWeight: '800' },
    helper: { fontSize: 10, lineHeight: 15 },
    modeRow: { flexDirection: 'row', gap: 9, marginTop: 3 },
    modeCard: { flex: 1, borderWidth: 1, borderRadius: 13, padding: 11, gap: 8 },
    modeTitle: { fontSize: 10, fontWeight: '800' },
    modeAmount: { fontSize: 12, fontWeight: '900' },
    inputLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginTop: 5 },
    inputWrap: { minHeight: 49, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
    currency: { fontSize: 16, fontWeight: '900' },
    input: { flex: 1, fontSize: 15, fontWeight: '800', paddingVertical: 10 },
    currencyCode: { fontSize: 9, fontWeight: '800' },
    amountMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    validation: { fontSize: 10, lineHeight: 14 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8 },
    summaryLabel: { fontSize: 10 },
    summaryValue: { fontSize: 11, fontWeight: '800' },
    summaryTotal: { borderTopWidth: 1, marginTop: 2, paddingTop: 13 },
    checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 7 },
    checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    ackText: { flex: 1, fontSize: 10, lineHeight: 15 },
    notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12 },
    noticeText: { flex: 1, fontSize: 9, lineHeight: 15 },
    primaryButton: { minHeight: 49, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  });
};
