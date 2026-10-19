import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { getPalette, useAppTheme } from '../../constants/app-theme';

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function DetailRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  const { isDark } = useAppTheme();
  const C = getPalette(isDark);
  const s = makeStyles(isDark);
  return (
    <View style={[s.detailRow, { borderBottomColor: C.border }]}>
      <Text style={[s.detailLabel, { color: C.muted }]}>{label}</Text>
      <Text style={[s.detailValue, { color: highlight ? C.blue : C.text }]}>{value}</Text>
    </View>
  );
}

export default function InvestmentDetailsScreen() {
  const { isDark } = useAppTheme();
  const C = getPalette(isDark);
  const s = makeStyles(isDark);

  return (
    <View style={[s.screen, { backgroundColor: C.bg }]}>
      <View style={[s.fixedHeader, { backgroundColor: C.bg, borderBottomColor: C.border }]}>
        <View style={s.headerRow}>
          <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()} style={[s.backButton, { backgroundColor: C.white, borderColor: C.border }]}>
            <Ionicons name="arrow-back" size={21} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: C.blue }]}>THE CONCEPT · INVESTOR PORTAL</Text>
            <Text style={[s.title, { color: C.text }]}>Contract details</Text>
            <Text style={[s.subtitle, { color: C.muted }]}>Review your investment terms</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: C.greenLight }]}>
            <View style={[s.dot, { backgroundColor: C.green }]} />
            <Text style={[s.statusText, { color: C.green }]}>ACTIVE</Text>
          </View>
        </View>
      </View>

      <ScrollView style={s.scrollArea} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.hero, { backgroundColor: C.navy }]}>
          <View style={s.heroTop}>
            <View style={s.heroIcon}><Ionicons name="document-text-outline" size={23} color="#6FFBBE" /></View>
            <Text style={s.contractRef}>CIP-2026-001</Text>
          </View>
          <Text style={s.heroLabel}>TOTAL PRINCIPAL INVESTED</Text>
          <Text style={s.heroAmount}>{money(10000)}</Text>
          <View style={s.heroBottom}>
            <View><Text style={s.heroMetaLabel}>RETURN RATE</Text><Text style={s.heroMetaValue}>2.5% monthly*</Text></View>
            <View><Text style={s.heroMetaLabel}>CONTRACT TERM</Text><Text style={s.heroMetaValue}>24 months*</Text></View>
          </View>
        </View>

        <View style={[s.card, { backgroundColor: C.white, borderColor: C.border }]}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Investment overview</Text>
          <DetailRow label="Contract reference" value="CIP-2026-001" />
          <DetailRow label="Investment status" value="Active" highlight />
          <DetailRow label="Principal amount" value={money(10000)} />
          <DetailRow label="Illustrative monthly ROI" value={money(250)} />
          <DetailRow label="Start date" value="01 March 2026" />
          <DetailRow label="Next ROI due" value="01 November 2026" />
          <DetailRow label="Maturity date" value="01 March 2028*" />
          <DetailRow label="Duration" value="24 months*" />
        </View>

        <View style={[s.card, { backgroundColor: C.white, borderColor: C.border }]}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Contract documents</Text>
          <View style={s.documentRow}>
            <View style={[s.docIcon, { backgroundColor: C.blueLight }]}><Ionicons name="document-attach-outline" size={22} color={C.blue} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[s.documentTitle, { color: C.text }]}>Signed investment agreement</Text>
              <Text style={[s.documentSub, { color: C.muted }]}>Your official signed copy will appear here.</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={18} color={C.muted} />
          </View>
          <TouchableOpacity style={[s.outlineButton, { borderColor: C.border }]} onPress={() => Alert.alert('Agreement unavailable', 'The signed agreement has not been connected to the document service yet.')}>
            <Ionicons name="document-outline" size={17} color={C.blue} />
            <Text style={[s.outlineButtonText, { color: C.blue }]}>View signed agreement</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.notice, { backgroundColor: C.blueLight }]}>
          <Ionicons name="information-circle-outline" size={19} color={C.blue} />
          <Text style={[s.noticeText, { color: C.softText }]}>This screen uses illustrative sample terms. Confirm the rate, dates, payment obligations, and maturity terms against your signed agreement before relying on them.</Text>
        </View>

        <TouchableOpacity style={[s.primaryButton, { backgroundColor: C.blue }]} onPress={() => router.push('/(tabs)/reinvest' as never)}>
          <Ionicons name="repeat-outline" size={18} color="#FFFFFF" />
          <Text style={s.primaryButtonText}>Reinvest an ROI payment</Text>
        </TouchableOpacity>
      </ScrollView>
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
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 7 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 8, fontWeight: '900' },
    scrollArea: { flex: 1 },
    content: { padding: 18, paddingTop: 16, paddingBottom: 38, gap: 15 },
    hero: { borderRadius: 20, padding: 19, gap: 13 },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#253A50', alignItems: 'center', justifyContent: 'center' },
    contractRef: { color: '#C6D0DE', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    heroLabel: { color: '#AAB8CC', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 3 },
    heroAmount: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: -1 },
    heroBottom: { borderTopWidth: 1, borderTopColor: '#34465C', paddingTop: 14, flexDirection: 'row', gap: 35 },
    heroMetaLabel: { color: '#AAB8CC', fontSize: 8, fontWeight: '800', marginBottom: 5 },
    heroMetaValue: { color: '#6FFBBE', fontSize: 12, fontWeight: '800' },
    card: { borderWidth: 1, borderRadius: 17, padding: 16 },
    sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
    detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    detailLabel: { fontSize: 10, flex: 1 },
    detailValue: { fontSize: 10, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
    documentRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
    docIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    documentTitle: { fontSize: 11, fontWeight: '800' },
    documentSub: { fontSize: 9, marginTop: 4, lineHeight: 14 },
    outlineButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 5 },
    outlineButtonText: { fontSize: 11, fontWeight: '800' },
    notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12 },
    noticeText: { flex: 1, fontSize: 9, lineHeight: 15 },
    primaryButton: { minHeight: 48, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  });
};
