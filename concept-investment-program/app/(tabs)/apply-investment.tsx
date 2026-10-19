import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
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
import { getActivePaymentAccount, PaymentAccount, submitInvestmentApplication } from '../../services/investments';

const RATE = 0.025;
const TERM_MONTHS = 24;
const money = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Stage = 'amount' | 'payment' | 'submitted';

export default function ApplyInvestmentScreen() {
  const { isDark } = useAppTheme();
  const C = getPalette(isDark);
  const s = makeStyles(isDark);
  const [stage, setStage] = useState<Stage>('amount');
  const [amountText, setAmountText] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptMimeType, setReceiptMimeType] = useState<string | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<PaymentAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [reference, setReference] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const amount = Number(amountText.replace(/,/g, ''));
  const validAmount = Number.isFinite(amount) && amount > 0;
  const monthlyROI = useMemo(() => validAmount ? amount * RATE : 0, [amount, validAmount]);
  const totalROI = monthlyROI * TERM_MONTHS;

  useEffect(() => {
    if (stage !== 'payment') return;
    let alive = true;
    setAccountLoading(true);
    getActivePaymentAccount().then(account => { if (alive) setPaymentAccount(account); })
      .catch(error => Alert.alert('Payment details unavailable', error.message || 'Could not load the company payment account.'))
      .finally(() => { if (alive) setAccountLoading(false); });
    return () => { alive = false; };
  }, [stage]);

  const chooseReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access required', 'Allow photo-library access to select your payment receipt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) { setReceiptUri(result.assets[0].uri); setReceiptMimeType(result.assets[0].mimeType ?? 'image/jpeg'); }
  };

  const submitApplication = async () => {
    if (!receiptUri) {
      Alert.alert('Receipt required', 'Please select an image of your payment receipt before submitting.');
      return;
    }
    if (!acknowledged) {
      Alert.alert('Please confirm', 'Confirm that you have made the payment and the information provided is accurate.');
      return;
    }
    if (!paymentAccount) {
      Alert.alert('Payment account unavailable', 'The company has not configured an active payment account yet. Please contact the administrator before transferring money.');
      return;
    }
    setSubmissionLoading(true);
    try {
      await submitInvestmentApplication({ amount, receiptUri, receiptMimeType, transactionReference: reference });
      setStage('submitted');
    } catch (error: any) {
      Alert.alert('Submission failed', error?.message || 'Your application could not be submitted. Please try again.');
    } finally {
      setSubmissionLoading(false);
    }
  };

  return (
    <View style={[s.screen, { backgroundColor: C.bg }]}>
      <View style={[s.fixedHeader, { backgroundColor: C.bg, borderBottomColor: C.border }]}>
        <View style={s.headerRow}>
          <TouchableOpacity accessibilityLabel="Go back" onPress={() => stage === 'payment' ? setStage('amount') : router.back()} style={[s.backButton, { backgroundColor: C.white, borderColor: C.border }]}>
            <Ionicons name="arrow-back" size={21} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: C.blue }]}>THE CONCEPT · INVESTOR PORTAL</Text>
            <Text style={[s.title, { color: C.text }]}>Apply to invest</Text>
            <Text style={[s.subtitle, { color: C.muted }]}>{stage === 'amount' ? 'Choose your investment amount' : stage === 'payment' ? 'Pay and submit proof of payment' : 'Your application status'}</Text>
          </View>
        </View>
        <View style={s.stepRow}>
          {(['amount', 'payment', 'submitted'] as Stage[]).map((item, index) => {
            const active = item === stage;
            const complete = (stage === 'payment' && index === 0) || (stage === 'submitted' && index < 2);
            return <View key={item} style={s.stepItem}><View style={[s.stepCircle, { backgroundColor: active || complete ? C.blue : C.white, borderColor: active || complete ? C.blue : C.border }]}>{complete ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : <Text style={{ color: active ? '#FFFFFF' : C.muted, fontSize: 10, fontWeight: '800' }}>{index + 1}</Text>}</View><Text style={[s.stepText, { color: active ? C.blue : C.muted }]}>{['Amount', 'Payment', 'Review'][index]}</Text></View>;
          })}
        </View>
      </View>

      {stage === 'submitted' ? (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={[s.successCard, { backgroundColor: C.white, borderColor: C.border }]}>
            <View style={s.successIcon}><Ionicons name="time-outline" size={32} color="#FFFFFF" /></View>
            <Text style={[s.successTitle, { color: C.text }]}>Awaiting admin approval</Text>
            <Text style={[s.body, { color: C.muted, textAlign: 'center' }]}>Your investment application and payment receipt have been submitted securely. An administrator must verify the payment before your investment becomes active.</Text>
            <View style={[s.statusPill, { backgroundColor: C.amber + '22' }]}><View style={[s.dot, { backgroundColor: C.amber }]} /><Text style={{ color: C.amber, fontSize: 10, fontWeight: '900' }}>PENDING ADMIN REVIEW</Text></View>
          </View>
          <View style={[s.card, { backgroundColor: C.white, borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Application summary</Text>
            <SummaryRow label="Requested investment" value={money(amount)} C={C} />
            <SummaryRow label="Term" value="24 months" C={C} />
            <SummaryRow label="Monthly ROI (2.5%)" value={money(monthlyROI)} C={C} highlight />
            <SummaryRow label="Illustrative ROI over 24 months" value={money(totalROI)} C={C} />
          </View>
          <TouchableOpacity style={[s.primaryButton, { backgroundColor: C.blue }]} onPress={() => router.replace('/(tabs)/investments' as never)}><Text style={s.primaryButtonText}>Back to investments</Text></TouchableOpacity>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={s.scrollArea} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {stage === 'amount' ? <>
              <View style={[s.hero, { backgroundColor: C.navy }]}>
                <View style={s.heroTop}><View style={s.heroIcon}><Ionicons name="trending-up-outline" size={23} color="#6FFBBE" /></View><View style={s.termPill}><Text style={s.termText}>FIXED TERM · 24 MONTHS</Text></View></View>
                <Text style={s.heroLabel}>INVESTMENT PROGRAM</Text>
                <Text style={s.heroTitle}>Start with an amount that works for you.</Text>
                <Text style={s.heroSub}>Your application and payment proof will be reviewed by an administrator before the investment is activated.</Text>
              </View>
              <View style={[s.card, { backgroundColor: C.white, borderColor: C.border }]}>
                <Text style={[s.sectionTitle, { color: C.text }]}>How much would you like to invest?</Text>
                <Text style={[s.helper, { color: C.muted }]}>Enter your intended principal in US dollars (USD).</Text>
                <Text style={[s.inputLabel, { color: C.muted }]}>INVESTMENT AMOUNT (USD)</Text>
                <View style={[s.inputWrap, { backgroundColor: C.bg, borderColor: C.border }]}><Text style={[s.currency, { color: C.text }]}>$</Text><TextInput value={amountText} onChangeText={v => setAmountText(v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))} keyboardType="decimal-pad" placeholder="Enter amount" placeholderTextColor={C.muted} style={[s.input, { color: C.text }]} accessibilityLabel="Investment amount in US dollars" /><Text style={[s.currencyCode, { color: C.muted }]}>USD</Text></View>
                {validAmount && <View style={[s.calculation, { backgroundColor: C.blueLight }]}><Text style={[s.calcHeading, { color: C.softText }]}>YOUR ILLUSTRATIVE RETURNS</Text><SummaryRow label="Monthly ROI · 2.5%" value={money(monthlyROI)} C={C} highlight /><SummaryRow label="Term" value="24 months" C={C} /><SummaryRow label="Total ROI over 24 months" value={money(totalROI)} C={C} highlight /><SummaryRow label="Principal" value={money(amount)} C={C} /></View>}
                <View style={s.inlineNotice}><Ionicons name="information-circle-outline" size={18} color={C.blue} /><Text style={[s.helper, { color: C.muted, flex: 1 }]}>ROI figures are illustrative and subject to the final agreement and admin approval. Principal repayment terms should be confirmed in the signed agreement.</Text></View>
              </View>
              <TouchableOpacity disabled={!validAmount} style={[s.primaryButton, { backgroundColor: validAmount ? C.blue : C.muted }]} onPress={() => setStage('payment')}><Text style={s.primaryButtonText}>Continue to payment details</Text><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></TouchableOpacity>
            </> : <>
              <View style={[s.summaryBanner, { backgroundColor: C.navy }]}><Text style={s.heroLabel}>AMOUNT TO PAY</Text><Text style={s.payAmount}>{money(amount)}</Text><Text style={s.heroSub}>Reference your investment application when making payment.</Text></View>
              <View style={[s.card, { backgroundColor: C.white, borderColor: C.border }]}>
                <Text style={[s.sectionTitle, { color: C.text }]}>Company payment account</Text>
                <Text style={[s.helper, { color: C.muted }]}>Transfer the exact amount below. Confirm these account details with the company before paying.</Text>
                {accountLoading ? <Text style={[s.helper, { color: C.muted }]}>Loading verified payment details…</Text> : paymentAccount ? <><AccountRow label="Bank" value={paymentAccount.bank_name} C={C} /><AccountRow label="Account name" value={paymentAccount.account_name} C={C} /><AccountRow label="Account number" value={paymentAccount.account_number} C={C} />{paymentAccount.payment_instructions ? <Text style={[s.helper, { color: C.muted }]}>{paymentAccount.payment_instructions}</Text> : null}</> : <View style={[s.warning, { backgroundColor: C.amber + '18' }]}><Ionicons name="alert-circle-outline" size={19} color={C.amber} /><Text style={[s.helper, { color: C.text, flex: 1 }]}>No active company payment account is configured. Do not transfer money until the administrator adds verified details in Supabase.</Text></View>}
              </View>
              <View style={[s.card, { backgroundColor: C.white, borderColor: C.border }]}>
                <Text style={[s.sectionTitle, { color: C.text }]}>Upload payment receipt</Text>
                <Text style={[s.helper, { color: C.muted }]}>Choose a clear image showing the payment amount, date, and transaction reference.</Text>
                <TouchableOpacity style={[s.uploadBox, { backgroundColor: C.bg, borderColor: receiptUri ? C.green : C.border }]} onPress={chooseReceipt}>
                  {receiptUri ? <><Image source={{ uri: receiptUri }} style={s.receiptImage} /><View style={{ flex: 1, gap: 4 }}><Text style={[s.uploadTitle, { color: C.text }]}>Receipt selected</Text><Text style={[s.helper, { color: C.muted }]}>Tap to choose a different image</Text></View><Ionicons name="checkmark-circle" size={22} color={C.green} /></> : <><View style={[s.uploadIcon, { backgroundColor: C.blueLight }]}><Ionicons name="cloud-upload-outline" size={24} color={C.blue} /></View><View style={{ flex: 1, gap: 4 }}><Text style={[s.uploadTitle, { color: C.text }]}>Choose receipt image</Text><Text style={[s.helper, { color: C.muted }]}>JPG or PNG from your photo library</Text></View><Ionicons name="chevron-forward" size={18} color={C.muted} /></>}
                </TouchableOpacity>
                <Text style={[s.inputLabel, { color: C.muted }]}>TRANSACTION REFERENCE (OPTIONAL)</Text>
                <TextInput value={reference} onChangeText={setReference} placeholder="Enter bank transfer reference" placeholderTextColor={C.muted} style={[s.referenceInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]} autoCapitalize="characters" />
                <TouchableOpacity onPress={() => setAcknowledged(v => !v)} style={s.checkRow}><View style={[s.checkbox, { borderColor: acknowledged ? C.blue : C.border, backgroundColor: acknowledged ? C.blue : C.white }]}>{acknowledged && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}</View><Text style={[s.helper, { color: C.muted, flex: 1 }]}>I confirm I have made the payment and the receipt details are accurate.</Text></TouchableOpacity>
              </View>
              <View style={[s.notice, { backgroundColor: C.blueLight }]}><Ionicons name="shield-checkmark-outline" size={19} color={C.blue} /><Text style={[s.helper, { color: C.softText, flex: 1 }]}>After submission, the application should remain pending until the admin verifies the receipt. It must not become an active investment before approval.</Text></View>
              <TouchableOpacity disabled={submissionLoading || accountLoading || !paymentAccount || !receiptUri || !acknowledged} style={[s.primaryButton, { backgroundColor: receiptUri && acknowledged && paymentAccount && !submissionLoading ? C.blue : C.muted }]} onPress={submitApplication}>{submissionLoading ? <Ionicons name="sync-outline" size={17} color="#FFFFFF" /> : <Ionicons name="send-outline" size={17} color="#FFFFFF" />}<Text style={s.primaryButtonText}>{submissionLoading ? 'Uploading receipt…' : 'Submit for admin approval'}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.secondaryButton, { borderColor: C.border }]} onPress={() => setStage('amount')}><Text style={[s.secondaryButtonText, { color: C.blue }]}>Back to amount</Text></TouchableOpacity>
            </>}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function SummaryRow({ label, value, C, highlight = false }: { label: string; value: string; C: ReturnType<typeof getPalette>; highlight?: boolean }) {
  return <View style={stylesShared.summaryRow}><Text style={[stylesShared.summaryLabel, { color: C.muted }]}>{label}</Text><Text style={[stylesShared.summaryValue, { color: highlight ? C.blue : C.text }]}>{value}</Text></View>;
}
function AccountRow({ label, value, C }: { label: string; value: string; C: ReturnType<typeof getPalette> }) {
  return <View style={[stylesShared.accountRow, { borderBottomColor: C.border }]}><Text style={[stylesShared.accountLabel, { color: C.muted }]}>{label}</Text><Text style={[stylesShared.accountValue, { color: C.text }]}>{value}</Text></View>;
}
const stylesShared = StyleSheet.create({ summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 }, summaryLabel: { fontSize: 10, flex: 1 }, summaryValue: { fontSize: 11, fontWeight: '800', textAlign: 'right', flexShrink: 1 }, accountRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 5 }, accountLabel: { fontSize: 10 }, accountValue: { fontSize: 12, fontWeight: '800' } });

const makeStyles = (dark: boolean) => {
  const C = getPalette(dark);
  return StyleSheet.create({
    screen: { flex: 1 }, fixedHeader: { paddingHorizontal: 18, paddingTop: 55, paddingBottom: 13, borderBottomWidth: 1, zIndex: 5 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 }, backButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, eyebrow: { fontSize: 8, fontWeight: '800', letterSpacing: 1, marginBottom: 5 }, title: { fontSize: 22, fontWeight: '800' }, subtitle: { fontSize: 10, marginTop: 4 }, stepRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingHorizontal: 4 }, stepItem: { alignItems: 'center', gap: 5, flex: 1 }, stepCircle: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, stepText: { fontSize: 9, fontWeight: '700' }, scrollArea: { flex: 1 }, content: { padding: 18, paddingTop: 16, paddingBottom: 40, gap: 15 }, hero: { borderRadius: 20, padding: 19, gap: 12 }, heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#253A50', alignItems: 'center', justifyContent: 'center' }, termPill: { backgroundColor: '#253A50', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 }, termText: { color: '#6FFBBE', fontSize: 8, fontWeight: '900' }, heroLabel: { color: '#AAB8CC', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }, heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 28 }, heroSub: { color: '#C6D0DE', fontSize: 10, lineHeight: 16 }, card: { borderWidth: 1, borderRadius: 17, padding: 16, gap: 12 }, sectionTitle: { fontSize: 15, fontWeight: '800' }, helper: { fontSize: 10, lineHeight: 15 }, inputLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginTop: 4 }, inputWrap: { minHeight: 51, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 }, currency: { fontSize: 17, fontWeight: '900' }, input: { flex: 1, fontSize: 15, fontWeight: '800', paddingVertical: 12 }, currencyCode: { fontSize: 9, fontWeight: '800' }, calculation: { borderRadius: 12, padding: 12, marginTop: 4, gap: 1 }, calcHeading: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7, marginBottom: 3 }, inlineNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 3 }, primaryButton: { minHeight: 49, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 15 }, primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' }, summaryBanner: { borderRadius: 18, padding: 18, gap: 9 }, payAmount: { color: '#FFFFFF', fontSize: 31, fontWeight: '900' }, warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderRadius: 11, marginTop: 5 }, uploadBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 13, padding: 13, minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11 }, uploadIcon: { width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, uploadTitle: { fontSize: 11, fontWeight: '800' }, receiptImage: { width: 56, height: 56, borderRadius: 9, resizeMode: 'cover' }, referenceInput: { borderWidth: 1, borderRadius: 11, minHeight: 45, paddingHorizontal: 12, fontSize: 11 }, checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 5 }, checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12 }, secondaryButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { fontSize: 11, fontWeight: '800' }, successCard: { borderWidth: 1, borderRadius: 18, padding: 22, alignItems: 'center', gap: 12 }, successIcon: { width: 64, height: 64, borderRadius: 21, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }, successTitle: { fontSize: 19, fontWeight: '900', textAlign: 'center' }, body: { fontSize: 11, lineHeight: 17 }, statusPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginTop: 3 }, dot: { width: 6, height: 6, borderRadius: 3 },
  });
};
