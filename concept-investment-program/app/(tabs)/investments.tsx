import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getPalette, useAppTheme } from '../../constants/app-theme';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getMyApplications, getMyInvestments } from '../../services/investments';

const getC = getPalette;
const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function LabelValue({ label, value }: { label: string; value: string }) {
  const { isDark } = useAppTheme(); const styles = makeStyles(isDark);
  return <View style={styles.labelValue}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

export default function InvestmentsScreen() {
  const { isDark } = useAppTheme();
  const C = getC(isDark);
  const styles = makeStyles(isDark);
  const [investments, setInvestments] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInvestments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [liveInvestments, liveApplications] = await Promise.all([
        getMyInvestments(),
        getMyApplications(),
      ]);
      setInvestments(liveInvestments as any[]);
      setApplications(liveApplications as any[]);
    } catch (error: any) {
      Alert.alert('Could not load investments', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadInvestments();
  }, [loadInvestments]);
  const activeInvestments = investments.filter(item => item.status === 'active');
  const principal = activeInvestments.reduce((sum, item) => sum + Number(item.principal), 0);
  const monthlyROI = activeInvestments.reduce((sum, item) => sum + Number(item.principal) * Number(item.monthly_roi_rate), 0);
  const pendingApplications = applications.filter(item => item.status === 'pending_review');
  const moneyDate = (value?: string) => value ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <View style={styles.screen}>
      <View style={styles.fixedHeader}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>THE CONCEPT · INVESTOR PORTAL</Text><Text style={styles.title}>My Investments</Text><Text style={styles.subtitle}>Apply for a new investment or review your contracts</Text></View>
        <TouchableOpacity style={styles.bell} onPress={() => router.push('/notifications' as never)}><Ionicons name="notifications-outline" size={22} color={C.text} /></TouchableOpacity>
      </View>
      </View>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadInvestments(true)}
            tintColor={C.blue}
            colors={[C.blue]}
            progressBackgroundColor={C.white}
          />
        }
      >


      <TouchableOpacity style={styles.applyCard} onPress={() => router.push('/(tabs)/apply-investment' as never)} activeOpacity={0.85}>
        <View style={styles.applyIcon}><Ionicons name="add-circle-outline" size={25} color="#FFFFFF" /></View>
        <View style={{ flex: 1, gap: 4 }}><Text style={styles.applyTitle}>Apply to invest</Text><Text style={styles.applySub}>Choose your amount, pay, and upload your receipt for approval.</Text></View>
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {loading ? <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator size="large" color={C.blue} /></View> : <>
      <View style={styles.banner}>
        <View style={styles.bannerIcon}><Ionicons name="shield-checkmark-outline" size={22} color="#6FFBBE" /></View>
        <View style={{ flex: 1 }}><Text style={styles.bannerLabel}>PORTFOLIO STATUS</Text><Text style={styles.bannerTitle}>{activeInvestments.length ? 'Active investment' : 'No active investment yet'}</Text><Text style={styles.bannerSub}>{pendingApplications.length ? `${pendingApplications.length} application(s) awaiting admin review` : 'Your approved investment records appear here.'}</Text></View>
        <View style={styles.bannerRight}><Text style={styles.bannerLabel}>TERM</Text><Text style={styles.bannerTerm}>24 months</Text></View>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statLabel}>ACTIVE CONTRACTS</Text><Text style={styles.statValue}>{activeInvestments.length}</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>TOTAL PRINCIPAL</Text><Text style={styles.statValueSmall}>{money(principal)}</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>MONTHLY ROI</Text><Text style={styles.statValueSmall}>{money(monthlyROI)}</Text></View>
      </View>
      {pendingApplications.map((app) => <View key={app.id} style={styles.card}>
        <View style={styles.cardTop}><View style={[styles.status, { backgroundColor: C.amberLight }]}><View style={[styles.greenDot, { backgroundColor: C.amber }]} /><Text style={[styles.statusText, { color: C.amber }]}>PENDING ADMIN REVIEW</Text></View><Text style={styles.ref}>Application</Text></View>
        <Text style={styles.label}>REQUESTED PRINCIPAL</Text><View style={styles.amountRow}><Text style={styles.amount}>{money(Number(app.amount))}</Text><View style={styles.roiBlock}><Text style={styles.roiRate}>2.5% monthly</Text><Text style={styles.roiSub}>{money(Number(app.amount) * 0.025)} / month</Text></View></View>
        <View style={styles.dateGrid}><LabelValue label="TERM" value="24 months" /><LabelValue label="SUBMITTED" value={moneyDate(app.submitted_at)} /><LabelValue label="STATUS" value="Pending review" /><LabelValue label="ROI STARTS" value="After approval" /></View>
      </View>)}
      {activeInvestments.map((item) => {
        const elapsed = Math.max(0, Math.min(24, (new Date().getFullYear() - new Date(item.start_date).getFullYear()) * 12 + new Date().getMonth() - new Date(item.start_date).getMonth()));
        const progress = Math.round((elapsed / 24) * 100);
        return <View key={item.id} style={styles.card}>
          <View style={styles.cardTop}><View style={styles.status}><View style={styles.greenDot} /><Text style={styles.statusText}>ACTIVE INVESTMENT</Text></View><Text style={styles.ref}>{item.id.slice(0, 8).toUpperCase()}</Text></View>
          <Text style={styles.label}>PRINCIPAL INVESTED</Text><View style={styles.amountRow}><Text style={styles.amount}>{money(Number(item.principal))}</Text><View style={styles.roiBlock}><Text style={styles.roiRate}>2.5% monthly</Text><Text style={styles.roiSub}>{money(Number(item.principal) * Number(item.monthly_roi_rate))} / month</Text></View></View>
          <View style={styles.progressBox}><View style={styles.between}><Text style={styles.progressTitle}>Investment progress</Text><Text style={styles.progressPct}>{progress}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View><View style={styles.between}><Text style={styles.date}>{moneyDate(item.start_date)}</Text><Text style={styles.date}>{elapsed} of 24 months</Text><Text style={styles.date}>{moneyDate(item.maturity_date)}</Text></View></View>
          <View style={styles.dateGrid}><LabelValue label="START DATE" value={moneyDate(item.start_date)} /><LabelValue label="MATURITY" value={moneyDate(item.maturity_date)} /><LabelValue label="DURATION" value="24 months" /><LabelValue label="MONTHLY ROI" value={money(Number(item.principal) * Number(item.monthly_roi_rate))} /></View>
          <View style={styles.actions}><TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(tabs)/investment-details' as never)}><Ionicons name="document-text-outline" size={17} color="#FFF" /><Text style={styles.primaryButtonText}>View contract details</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(tabs)/roi' as never)}><Ionicons name="time-outline" size={17} color={C.blue} /><Text style={styles.secondaryButtonText}>ROI schedule</Text></TouchableOpacity></View>
        </View>;
      })}
      {!activeInvestments.length && !pendingApplications.length ? <View style={styles.emptyCard}><View style={styles.emptyIcon}><Ionicons name="wallet-outline" size={24} color={C.muted} /></View><Text style={styles.emptyTitle}>No investment applications yet</Text><Text style={styles.emptyText}>Start an application to invest. Your investment will appear here only after admin approval.</Text></View> : null}
      {/* <View style={styles.notice}><Ionicons name="information-circle-outline" size={18} color={C.blue} /><Text style={styles.noticeText}>Investment records and ROI schedules are loaded from Supabase. Applications remain pending until an administrator verifies the receipt.</Text></View> */}
      </>}
      </ScrollView>
    </View>
  );
}

const makeStyles = (dark: boolean) => { const C = getC(dark); return StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg }, fixedHeader: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 14, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, zIndex: 10 }, scrollArea: { flex: 1 }, content: { padding: 20, paddingTop: 16, paddingBottom: 35, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, eyebrow: { fontSize: 9, color: C.blue, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 }, title: { color: C.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 }, subtitle: { color: C.muted, fontSize: 11, marginTop: 5 },
  bell: { width: 43, height: 43, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  applyCard: { backgroundColor: C.blue, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 }, applyIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }, applyTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, applySub: { color: '#EAF4FF', fontSize: 10, lineHeight: 15 },
  banner: { backgroundColor: C.navy, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }, bannerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#253A50', alignItems: 'center', justifyContent: 'center' }, bannerLabel: { color: '#AAB8CC', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 }, bannerTitle: { color: C.white, fontSize: 15, fontWeight: '800', marginTop: 4 }, bannerSub: { color: '#AAB8CC', fontSize: 9, marginTop: 4 }, bannerRight: { alignItems: 'flex-end', gap: 5 }, bannerTerm: { color: '#6FFBBE', fontSize: 12, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, minHeight: 75, backgroundColor: C.white, borderRadius: 13, padding: 11, borderWidth: 1, borderColor: C.border, justifyContent: 'center', gap: 8 }, statLabel: { color: C.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.4 }, statValue: { color: C.text, fontSize: 20, fontWeight: '800' }, statValueSmall: { color: C.text, fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: C.white, borderRadius: 19, padding: 16, borderWidth: 1, borderColor: C.border, gap: 15 }, cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }, status: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.greenLight, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 }, greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }, statusText: { color: C.green, fontSize: 9, fontWeight: '800' }, ref: { color: C.muted, fontSize: 9, fontWeight: '700' }, label: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }, amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: -9 }, amount: { color: C.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.6 }, roiBlock: { alignItems: 'flex-end' }, roiRate: { color: C.blue, fontSize: 11, fontWeight: '800' }, roiSub: { color: C.muted, fontSize: 9, marginTop: 4 },
  progressBox: { backgroundColor: C.bg, borderRadius: 13, padding: 12, gap: 10 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, progressTitle: { color: C.text, fontSize: 11, fontWeight: '800' }, progressPct: { color: C.blue, fontSize: 10, fontWeight: '800' }, track: { height: 8, borderRadius: 8, backgroundColor: (dark ? '#334155' : '#E0E3E5'), overflow: 'hidden' }, fill: { height: '100%', backgroundColor: C.blue, borderRadius: 8 }, date: { color: C.muted, fontSize: 8 },
  dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, labelValue: { width: '48%', flexGrow: 1, backgroundColor: (dark ? '#0B1220' : '#F7F9FB'), borderRadius: 10, padding: 11, gap: 6 }, value: { color: C.text, fontSize: 11, fontWeight: '800' },
  actions: { gap: 9 }, primaryButton: { backgroundColor: C.blue, borderRadius: 12, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryButtonText: { color: C.white, fontSize: 12, fontWeight: '800' }, secondaryButton: { borderWidth: 1, borderColor: (dark ? '#304963' : '#C6D9E7'), borderRadius: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, secondaryButtonText: { color: C.blue, fontSize: 12, fontWeight: '800' },
  sectionHeader: { marginTop: 2 }, sectionTitle: { color: C.text, fontSize: 16, fontWeight: '800' }, emptyCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 22, alignItems: 'center', gap: 8 }, emptyIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: (dark ? '#1A2638' : '#F2F4F6'), alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: C.text, fontSize: 13, fontWeight: '800' }, emptyText: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.blueLight, borderRadius: 12, padding: 12 }, noticeText: { flex: 1, color: (dark ? '#C6D0DE' : '#34475C'), fontSize: 10, lineHeight: 15 },
}); };


// import { Ionicons } from '@expo/vector-icons';
// import { router } from 'expo-router';
// import { getPalette, useAppTheme } from '../../constants/app-theme';
// import React, { useEffect, useState } from 'react';
// import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// import { getMyApplications, getMyInvestments } from '../../services/investments';

// const getC = getPalette;
// const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

// function LabelValue({ label, value }: { label: string; value: string }) {
//   const { isDark } = useAppTheme(); const styles = makeStyles(isDark);
//   return <View style={styles.labelValue}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
// }

// export default function InvestmentsScreen() {
//   const { isDark } = useAppTheme();
//   const C = getC(isDark);
//   const styles = makeStyles(isDark);
//   const [investments, setInvestments] = useState<any[]>([]);
//   const [applications, setApplications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   useEffect(() => {
//     let alive = true;
//     Promise.all([getMyInvestments(), getMyApplications()])
//       .then(([liveInvestments, liveApplications]) => {
//         if (alive) { setInvestments(liveInvestments as any[]); setApplications(liveApplications as any[]); }
//       })
//       .catch((error: any) => Alert.alert('Could not load investments', error?.message || 'Please try again.'))
//       .finally(() => { if (alive) setLoading(false); });
//     return () => { alive = false; };
//   }, []);
//   const activeInvestments = investments.filter(item => item.status === 'active');
//   const principal = activeInvestments.reduce((sum, item) => sum + Number(item.principal), 0);
//   const monthlyROI = activeInvestments.reduce((sum, item) => sum + Number(item.principal) * Number(item.monthly_roi_rate), 0);
//   const pendingApplications = applications.filter(item => item.status === 'pending_review');
//   const moneyDate = (value?: string) => value ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

//   return (
//     <View style={styles.screen}>
//       <View style={styles.fixedHeader}>
//       <View style={styles.header}>
//         <View><Text style={styles.eyebrow}>THE CONCEPT · INVESTOR PORTAL</Text><Text style={styles.title}>My Investments</Text><Text style={styles.subtitle}>Apply for a new investment or review your contracts</Text></View>
//         <TouchableOpacity style={styles.bell} onPress={() => router.push('/notifications' as never)}><Ionicons name="notifications-outline" size={22} color={C.text} /></TouchableOpacity>
//       </View>
//       </View>
//       <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>


//       <TouchableOpacity style={styles.applyCard} onPress={() => router.push('/(tabs)/apply-investment' as never)} activeOpacity={0.85}>
//         <View style={styles.applyIcon}><Ionicons name="add-circle-outline" size={25} color="#FFFFFF" /></View>
//         <View style={{ flex: 1, gap: 4 }}><Text style={styles.applyTitle}>Apply to invest</Text><Text style={styles.applySub}>Choose your amount, pay, and upload your receipt for approval.</Text></View>
//         <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
//       </TouchableOpacity>

//       {loading ? <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator size="large" color={C.blue} /></View> : <>
//       <View style={styles.banner}>
//         <View style={styles.bannerIcon}><Ionicons name="shield-checkmark-outline" size={22} color="#6FFBBE" /></View>
//         <View style={{ flex: 1 }}><Text style={styles.bannerLabel}>PORTFOLIO STATUS</Text><Text style={styles.bannerTitle}>{activeInvestments.length ? 'Active investment' : 'No active investment yet'}</Text><Text style={styles.bannerSub}>{pendingApplications.length ? `${pendingApplications.length} application(s) awaiting admin review` : 'Your approved investment records appear here.'}</Text></View>
//         <View style={styles.bannerRight}><Text style={styles.bannerLabel}>TERM</Text><Text style={styles.bannerTerm}>24 months</Text></View>
//       </View>
//       <View style={styles.stats}>
//         <View style={styles.stat}><Text style={styles.statLabel}>ACTIVE CONTRACTS</Text><Text style={styles.statValue}>{activeInvestments.length}</Text></View>
//         <View style={styles.stat}><Text style={styles.statLabel}>TOTAL PRINCIPAL</Text><Text style={styles.statValueSmall}>{money(principal)}</Text></View>
//         <View style={styles.stat}><Text style={styles.statLabel}>MONTHLY ROI</Text><Text style={styles.statValueSmall}>{money(monthlyROI)}</Text></View>
//       </View>
//       {pendingApplications.map((app) => <View key={app.id} style={styles.card}>
//         <View style={styles.cardTop}><View style={[styles.status, { backgroundColor: C.amberLight }]}><View style={[styles.greenDot, { backgroundColor: C.amber }]} /><Text style={[styles.statusText, { color: C.amber }]}>PENDING ADMIN REVIEW</Text></View><Text style={styles.ref}>Application</Text></View>
//         <Text style={styles.label}>REQUESTED PRINCIPAL</Text><View style={styles.amountRow}><Text style={styles.amount}>{money(Number(app.amount))}</Text><View style={styles.roiBlock}><Text style={styles.roiRate}>2.5% monthly</Text><Text style={styles.roiSub}>{money(Number(app.amount) * 0.025)} / month</Text></View></View>
//         <View style={styles.dateGrid}><LabelValue label="TERM" value="24 months" /><LabelValue label="SUBMITTED" value={moneyDate(app.submitted_at)} /><LabelValue label="STATUS" value="Pending review" /><LabelValue label="ROI STARTS" value="After approval" /></View>
//       </View>)}
//       {activeInvestments.map((item) => {
//         const elapsed = Math.max(0, Math.min(24, (new Date().getFullYear() - new Date(item.start_date).getFullYear()) * 12 + new Date().getMonth() - new Date(item.start_date).getMonth()));
//         const progress = Math.round((elapsed / 24) * 100);
//         return <View key={item.id} style={styles.card}>
//           <View style={styles.cardTop}><View style={styles.status}><View style={styles.greenDot} /><Text style={styles.statusText}>ACTIVE INVESTMENT</Text></View><Text style={styles.ref}>{item.id.slice(0, 8).toUpperCase()}</Text></View>
//           <Text style={styles.label}>PRINCIPAL INVESTED</Text><View style={styles.amountRow}><Text style={styles.amount}>{money(Number(item.principal))}</Text><View style={styles.roiBlock}><Text style={styles.roiRate}>2.5% monthly</Text><Text style={styles.roiSub}>{money(Number(item.principal) * Number(item.monthly_roi_rate))} / month</Text></View></View>
//           <View style={styles.progressBox}><View style={styles.between}><Text style={styles.progressTitle}>Investment progress</Text><Text style={styles.progressPct}>{progress}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View><View style={styles.between}><Text style={styles.date}>{moneyDate(item.start_date)}</Text><Text style={styles.date}>{elapsed} of 24 months</Text><Text style={styles.date}>{moneyDate(item.maturity_date)}</Text></View></View>
//           <View style={styles.dateGrid}><LabelValue label="START DATE" value={moneyDate(item.start_date)} /><LabelValue label="MATURITY" value={moneyDate(item.maturity_date)} /><LabelValue label="DURATION" value="24 months" /><LabelValue label="MONTHLY ROI" value={money(Number(item.principal) * Number(item.monthly_roi_rate))} /></View>
//           <View style={styles.actions}><TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(tabs)/investment-details' as never)}><Ionicons name="document-text-outline" size={17} color="#FFF" /><Text style={styles.primaryButtonText}>View contract details</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(tabs)/roi' as never)}><Ionicons name="time-outline" size={17} color={C.blue} /><Text style={styles.secondaryButtonText}>ROI schedule</Text></TouchableOpacity></View>
//         </View>;
//       })}
//       {!activeInvestments.length && !pendingApplications.length ? <View style={styles.emptyCard}><View style={styles.emptyIcon}><Ionicons name="wallet-outline" size={24} color={C.muted} /></View><Text style={styles.emptyTitle}>No investment applications yet</Text><Text style={styles.emptyText}>Start an application to invest. Your investment will appear here only after admin approval.</Text></View> : null}
//       <View style={styles.notice}><Ionicons name="information-circle-outline" size={18} color={C.blue} /><Text style={styles.noticeText}>Investment records and ROI schedules are loaded from Supabase. Applications remain pending until an administrator verifies the receipt.</Text></View>
//       </>}
//       </ScrollView>
//     </View>
//   );
// }

// const makeStyles = (dark: boolean) => { const C = getC(dark); return StyleSheet.create({
//   screen: { flex: 1, backgroundColor: C.bg }, fixedHeader: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 14, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, zIndex: 10 }, scrollArea: { flex: 1 }, content: { padding: 20, paddingTop: 16, paddingBottom: 35, gap: 16 },
//   header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, eyebrow: { fontSize: 9, color: C.blue, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 }, title: { color: C.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 }, subtitle: { color: C.muted, fontSize: 11, marginTop: 5 },
//   bell: { width: 43, height: 43, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
//   applyCard: { backgroundColor: C.blue, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 }, applyIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }, applyTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, applySub: { color: '#EAF4FF', fontSize: 10, lineHeight: 15 },
//   banner: { backgroundColor: C.navy, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }, bannerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#253A50', alignItems: 'center', justifyContent: 'center' }, bannerLabel: { color: '#AAB8CC', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 }, bannerTitle: { color: C.white, fontSize: 15, fontWeight: '800', marginTop: 4 }, bannerSub: { color: '#AAB8CC', fontSize: 9, marginTop: 4 }, bannerRight: { alignItems: 'flex-end', gap: 5 }, bannerTerm: { color: '#6FFBBE', fontSize: 12, fontWeight: '800' },
//   stats: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, minHeight: 75, backgroundColor: C.white, borderRadius: 13, padding: 11, borderWidth: 1, borderColor: C.border, justifyContent: 'center', gap: 8 }, statLabel: { color: C.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.4 }, statValue: { color: C.text, fontSize: 20, fontWeight: '800' }, statValueSmall: { color: C.text, fontSize: 12, fontWeight: '800' },
//   card: { backgroundColor: C.white, borderRadius: 19, padding: 16, borderWidth: 1, borderColor: C.border, gap: 15 }, cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }, status: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.greenLight, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 }, greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }, statusText: { color: C.green, fontSize: 9, fontWeight: '800' }, ref: { color: C.muted, fontSize: 9, fontWeight: '700' }, label: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }, amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: -9 }, amount: { color: C.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.6 }, roiBlock: { alignItems: 'flex-end' }, roiRate: { color: C.blue, fontSize: 11, fontWeight: '800' }, roiSub: { color: C.muted, fontSize: 9, marginTop: 4 },
//   progressBox: { backgroundColor: C.bg, borderRadius: 13, padding: 12, gap: 10 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, progressTitle: { color: C.text, fontSize: 11, fontWeight: '800' }, progressPct: { color: C.blue, fontSize: 10, fontWeight: '800' }, track: { height: 8, borderRadius: 8, backgroundColor: (dark ? '#334155' : '#E0E3E5'), overflow: 'hidden' }, fill: { height: '100%', backgroundColor: C.blue, borderRadius: 8 }, date: { color: C.muted, fontSize: 8 },
//   dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, labelValue: { width: '48%', flexGrow: 1, backgroundColor: (dark ? '#0B1220' : '#F7F9FB'), borderRadius: 10, padding: 11, gap: 6 }, value: { color: C.text, fontSize: 11, fontWeight: '800' },
//   actions: { gap: 9 }, primaryButton: { backgroundColor: C.blue, borderRadius: 12, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryButtonText: { color: C.white, fontSize: 12, fontWeight: '800' }, secondaryButton: { borderWidth: 1, borderColor: (dark ? '#304963' : '#C6D9E7'), borderRadius: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, secondaryButtonText: { color: C.blue, fontSize: 12, fontWeight: '800' },
//   sectionHeader: { marginTop: 2 }, sectionTitle: { color: C.text, fontSize: 16, fontWeight: '800' }, emptyCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 22, alignItems: 'center', gap: 8 }, emptyIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: (dark ? '#1A2638' : '#F2F4F6'), alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: C.text, fontSize: 13, fontWeight: '800' }, emptyText: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
//   notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.blueLight, borderRadius: 12, padding: 12 }, noticeText: { flex: 1, color: (dark ? '#C6D0DE' : '#34475C'), fontSize: 10, lineHeight: 15 },
// }); };
