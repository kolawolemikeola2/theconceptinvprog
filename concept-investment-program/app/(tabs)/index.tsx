import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { getMyInvestments, getMyRoiPayments } from '../../services/investments';
import { getPalette, useAppTheme } from '../../constants/app-theme';

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const { isDark } = useAppTheme(); const C = getPalette(isDark); const styles = makeStyles(isDark);
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!action && <TouchableOpacity onPress={onPress}><Text style={styles.link}>{action}</Text></TouchableOpacity>}
    </View>
  );
}

function Metric({ label, value, helper, color }: { label: string; value: string; helper?: string; color?: string }) {
  const { isDark } = useAppTheme(); const C = getPalette(isDark); const styles = makeStyles(isDark);
  color = color ?? C.white;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {!!helper && <Text style={styles.metricHelper}>{helper}</Text>}
    </View>
  );
}

export default function DashboardScreen() {
  const { isDark } = useAppTheme();
  const C = getPalette(isDark);
  const styles = makeStyles(isDark);
  const [investorName, setInvestorName] = useState('Investor');
  const [investorId, setInvestorId] = useState('');
  const [investments, setInvestments] = useState<any[]>([]);
  const [roiRows, setRoiRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error('Please sign in again.');
      const [profileResult, investmentRows, roiRecords] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', authData.user.id).maybeSingle(),
        getMyInvestments(),
        getMyRoiPayments(),
      ]);
      if (profileResult.error) throw profileResult.error;
      setInvestorName(profileResult.data?.full_name?.split(' ')[0] || authData.user.email?.split('@')[0] || 'Investor');
      setInvestorId(authData.user.id.slice(0, 8).toUpperCase());
      setInvestments(investmentRows as any[]);
      setRoiRows(roiRecords as any[]);
    } catch (error: any) {
      Alert.alert('Could not load dashboard', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);
  const activeInvestments = investments.filter(item => item.status === 'active');
  const principal = activeInvestments.reduce((sum,item)=>sum+Number(item.principal),0);
  const monthlyROI = activeInvestments.reduce((sum,item)=>sum+Number(item.principal)*Number(item.monthly_roi_rate),0);
  const totalPaid = roiRows.filter(item=>item.status==='paid').reduce((sum,item)=>sum+Number(item.amount),0);
  const nextROI = roiRows.filter(item=>item.status==='pending' && item.due_date >= new Date().toISOString().slice(0,10)).sort((a,b)=>a.due_date.localeCompare(b.due_date))[0];
  const termMonths = 24;
  const currentMonth = activeInvestments.reduce((max,item) => { const start = new Date(item.start_date + 'T00:00:00'); const elapsed = Math.max(0, (new Date().getFullYear()-start.getFullYear())*12 + new Date().getMonth()-start.getMonth()); return Math.max(max, Math.min(24, elapsed)); }, 0);
  const progress = currentMonth / termMonths;
  const moneyDate = (value?: string) => value ? new Date(value + 'T00:00:00').toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'}) : 'No scheduled payment';

  return (
    <View style={styles.screen}>
      <View style={styles.fixedHeader}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>THE CONCEPT</Text>
          <Text style={styles.greeting}>Good morning, {investorName}</Text>
          <View style={styles.idRow}>
            <Text style={styles.investorId}>Investor ID: {investorId || '—'}</Text>
            <View style={styles.dot} />
            <Text style={styles.activeText}>{activeInvestments.length ? 'Portfolio active' : 'No active investment'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/notifications' as never)} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={23} color={C.text} />
          <View style={styles.unreadDot} />
        </TouchableOpacity>
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
            onRefresh={() => void loadDashboard(true)}
            tintColor={C.blue}
            colors={[C.blue]}
            progressBackgroundColor={C.white}
          />
        }
      >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.tierRow}>
            <Ionicons name="shield-checkmark-outline" size={17} color="#93CCFF" />
            <Text style={styles.tierText}>INVESTMENT OVERVIEW</Text>
          </View>
          <View style={styles.activePill}><View style={styles.activePillDot} /><Text style={styles.activePillText}>{activeInvestments.length ? 'ACTIVE' : 'NO ACTIVE CONTRACT'}</Text></View>
        </View>
        <Text style={styles.heroLabel}>TOTAL ACTIVE INVESTMENT</Text>
        <Text style={styles.heroAmount}>{loading ? 'Loading…' : money(principal)}</Text>
        <View style={styles.heroMetrics}>
          <Metric label="TOTAL ROI PAID" value={money(totalPaid)} helper="Confirmed in Supabase" color="#6FFBBE" />
          <Metric label="NEXT ROI DUE" value={money(nextROI ? Number(nextROI.amount) : 0)} helper={moneyDate(nextROI?.due_date)} color="#93CCFF" />
        </View>
        <Text style={styles.demoNote}>Figures reflect approved investment and ROI records in Supabase.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <View style={styles.smallIcon}><Ionicons name="calendar-outline" size={20} color={C.blue} /></View>
            <View>
              <Text style={styles.cardTitle}>Upcoming ROI payment</Text>
              <Text style={styles.muted}>Monthly payment schedule</Text>
            </View>
          </View>
          <View style={styles.upcomingPill}><Text style={styles.upcomingText}>UPCOMING</Text></View>
        </View>
        <Text style={styles.label}>EXPECTED ROI AMOUNT</Text>
        <Text style={styles.amount}>{money(monthlyROI)}</Text>
        <View style={styles.row}>
          <Ionicons name="time-outline" size={16} color={C.muted} />
          <Text style={styles.muted}>Due date: {moneyDate(nextROI?.due_date)}</Text>
        </View>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={C.muted} />
          <Text style={styles.infoText}>Payment is marked paid only after an authorized administrator confirms and records it.</Text>
        </View>
      </View>

      <SectionTitle title="24-month investment progress" action="View details" onPress={() => router.push('/(tabs)/investments')} />
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Investment term</Text>
          <Text style={styles.blueText}>Month {currentMonth} of {termMonths}</Text>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
        <View style={styles.rowBetween}>
          <Text style={styles.muted}>Mar 2026</Text>
          <Text style={styles.muted}>{Math.round(progress * 100)}% completed</Text>
          <Text style={styles.muted}>Mar 2028</Text>
        </View>
        <View style={styles.detailGrid}>
          <View style={styles.detailCell}><Text style={styles.label}>MONTHLY ROI RATE</Text><Text style={styles.detailValue}>2.5%</Text></View>
          <View style={styles.detailCell}><Text style={styles.label}>REMAINING MONTHS</Text><Text style={styles.detailValue}>{termMonths - currentMonth}</Text></View>
        </View>
      </View>

      <SectionTitle title="Quick actions" />
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/investments')}>
          <View style={styles.actionIcon}><Ionicons name="briefcase-outline" size={22} color={C.blue} /></View>
          <Text style={styles.actionTitle}>My investments</Text><Text style={styles.actionSub}>View contract details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/roi')}>
          <View style={styles.actionIcon}><Ionicons name="receipt-outline" size={22} color={C.blue} /></View>
          <Text style={styles.actionTitle}>ROI history</Text><Text style={styles.actionSub}>Review payment records</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/reinvest' as never)}>
          <View style={styles.actionIcon}><Ionicons name="repeat-outline" size={22} color={C.blue} /></View>
          <Text style={styles.actionTitle}>Reinvest ROI</Text><Text style={styles.actionSub}>When eligible balance exists</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/notifications' as never)}>
          <View style={styles.actionIcon}><Ionicons name="notifications-outline" size={22} color={C.blue} /></View>
          <Text style={styles.actionTitle}>Notifications</Text><Text style={styles.actionSub}>Payment updates</Text>
        </TouchableOpacity>
      </View>

      <SectionTitle title="Recent activity" action="See all" onPress={() => router.push('/(tabs)/roi')} />
      <View style={styles.card}>
        {roiRows.slice(0, 3).length === 0 ? <Text style={styles.muted}>No investment activity yet. Approved ROI records will appear here.</Text> : roiRows.slice(0, 3).map((item, index) => {
          const paid = item.status === 'paid';
          const color = paid ? C.green : C.amber;
          const title = paid ? 'ROI payment recorded' : 'ROI payment scheduled';
          const detail = `Month ${item.period_month} · ${moneyDate(item.due_date)}`;
          return <View key={item.id} style={[styles.activityRow, index > 0 && styles.activityBorder]}>
            <View style={[styles.activityIcon, { backgroundColor: `${color}15` }]}><Ionicons name={paid ? 'checkmark-circle' : 'calendar'} size={19} color={color} /></View>
            <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>
            <Text style={[styles.activityAmount, { color }]}>{money(Number(item.amount))}</Text>
          </View>;
        })}
      </View>
      {/* <Text style={styles.disclaimer}>Investment information is shown for record-keeping. This app does not initiate withdrawals. Figures are drawn from approved investment and ROI records.</Text> */}
      </ScrollView>
    </View>
  );
}

const makeStyles = (dark: boolean) => { const C = getPalette(dark); return StyleSheet.create({
  screen: { flex: 1, backgroundColor: (dark ? '#0B1220' : '#F7F9FB') },
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 14,
    backgroundColor: (dark ? '#0B1220' : '#F7F9FB'),
    borderBottomWidth: 1,
    borderBottomColor: (dark ? '#263449' : '#E7EBF2'),
    zIndex: 10,
  },
  scrollArea: { flex: 1 },
  content: { padding: 20, paddingTop: 16, paddingBottom: 36, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 },
  brand: { fontSize: 10, letterSpacing: 1.8, fontWeight: '800', color: C.blue, marginBottom: 6 },
  greeting: { fontSize: 23, fontWeight: '800', letterSpacing: -0.5, color: (dark ? '#F2F5FA' : '#191C1E') },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 7 },
  investorId: { fontSize: 10, color: (dark ? '#A4B0C0' : '#75777D'), letterSpacing: 0.4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#B5BBC5' },
  activeText: { color: '#087B57', fontSize: 10, fontWeight: '700' },
  iconButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: (dark ? '#121C2D' : '#FFF'), borderWidth: 1, borderColor: (dark ? '#263449' : '#E7EBF2'), alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: '#C53B42' },
  hero: { backgroundColor: '#0E1C2F', borderRadius: 22, padding: 20, gap: 15, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierText: { color: '#93CCFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#173B38', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  activePillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4EDEA3' },
  activePillText: { color: '#6FFBBE', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  heroLabel: { color: '#AAB8CC', fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: -9 },
  heroAmount: { color: (dark ? '#121C2D' : '#FFF'), fontSize: 31, fontWeight: '800', letterSpacing: -0.8 },
  heroMetrics: { flexDirection: 'row', backgroundColor: '#1B2C40', borderRadius: 14, padding: 13, gap: 12 },
  metric: { flex: 1, gap: 5 },
  metricLabel: { color: '#AAB8CC', fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  metricValue: { fontSize: 17, fontWeight: '800' },
  metricHelper: { color: '#AAB8CC', fontSize: 10 },
  demoNote: { color: '#AAB8CC', fontSize: 10, lineHeight: 15 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  sectionTitle: { color: (dark ? '#F2F5FA' : '#191C1E'), fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  link: { color: '#006398', fontSize: 11, fontWeight: '800' },
  card: { backgroundColor: (dark ? '#121C2D' : '#FFF'), borderRadius: 18, borderWidth: 1, borderColor: (dark ? '#263449' : '#E7EBF2'), padding: 16, gap: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  smallIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: (dark ? '#172B43' : '#EAF1FF'), alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 13, fontWeight: '800', color: (dark ? '#F2F5FA' : '#191C1E') },
  muted: { color: (dark ? '#A4B0C0' : '#75777D'), fontSize: 10, lineHeight: 15 },
  upcomingPill: { backgroundColor: (dark ? '#3B2E16' : '#FFF5DE'), borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  upcomingText: { color: (dark ? '#F3C66B' : '#996515'), fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  label: { color: (dark ? '#A4B0C0' : '#75777D'), fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  amount: { color: (dark ? '#F2F5FA' : '#191C1E'), fontSize: 26, fontWeight: '800', marginTop: -8 },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: (dark ? '#1A2638' : '#F2F4F6'), padding: 10, borderRadius: 10, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 10, color: (dark ? '#C6D0DE' : '#44474C'), lineHeight: 15 },
  blueText: { color: '#006398', fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: (dark ? '#334155' : '#E0E3E5'), overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#006398', borderRadius: 8 },
  detailGrid: { flexDirection: 'row', gap: 10, marginTop: 2 },
  detailCell: { flex: 1, backgroundColor: (dark ? '#0B1220' : '#F7F9FB'), padding: 12, borderRadius: 11, gap: 5 },
  detailValue: { color: (dark ? '#F2F5FA' : '#191C1E'), fontSize: 17, fontWeight: '800' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: '48%', flexGrow: 1, backgroundColor: (dark ? '#121C2D' : '#FFF'), borderRadius: 15, borderWidth: 1, borderColor: (dark ? '#263449' : '#E7EBF2'), padding: 14, gap: 6 },
  actionIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: (dark ? '#172B43' : '#EAF1FF'), alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  actionTitle: { color: (dark ? '#F2F5FA' : '#191C1E'), fontSize: 12, fontWeight: '800' },
  actionSub: { color: (dark ? '#A4B0C0' : '#75777D'), fontSize: 10, lineHeight: 14 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  activityBorder: { borderTopWidth: 1, borderTopColor: (dark ? '#263449' : '#EEF0F3'), paddingTop: 13 },
  activityIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { color: (dark ? '#F2F5FA' : '#191C1E'), fontSize: 11, fontWeight: '800', marginBottom: 3 },
  activityAmount: { fontSize: 10, fontWeight: '800' },
  disclaimer: { color: (dark ? '#A4B0C0' : '#75777D'), fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 8, marginTop: 2 },
}); };



// import { Ionicons } from '@expo/vector-icons';
// import { router } from 'expo-router';
// import React, { useEffect, useState } from 'react';
// import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// import { supabase } from '../../lib/supabase';
// import { getMyInvestments, getMyRoiPayments } from '../../services/investments';
// import { getPalette, useAppTheme } from '../../constants/app-theme';

// const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

// function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
//   const { isDark } = useAppTheme(); const C = getPalette(isDark); const styles = makeStyles(isDark);
//   return (
//     <View style={styles.sectionHeader}>
//       <Text style={styles.sectionTitle}>{title}</Text>
//       {!!action && <TouchableOpacity onPress={onPress}><Text style={styles.link}>{action}</Text></TouchableOpacity>}
//     </View>
//   );
// }

// function Metric({ label, value, helper, color }: { label: string; value: string; helper?: string; color?: string }) {
//   const { isDark } = useAppTheme(); const C = getPalette(isDark); const styles = makeStyles(isDark);
//   color = color ?? C.white;
//   return (
//     <View style={styles.metric}>
//       <Text style={styles.metricLabel}>{label}</Text>
//       <Text style={[styles.metricValue, { color }]}>{value}</Text>
//       {!!helper && <Text style={styles.metricHelper}>{helper}</Text>}
//     </View>
//   );
// }

// export default function DashboardScreen() {
//   const { isDark } = useAppTheme();
//   const C = getPalette(isDark);
//   const styles = makeStyles(isDark);
//   const [investorName, setInvestorName] = useState('Investor');
//   const [investorId, setInvestorId] = useState('');
//   const [investments, setInvestments] = useState<any[]>([]);
//   const [roiRows, setRoiRows] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   useEffect(() => {
//     let alive = true;
//     (async () => {
//       const { data: authData, error: authError } = await supabase.auth.getUser();
//       if (authError || !authData.user) throw authError || new Error('Please sign in again.');
//       const [profileResult, investmentRows, roiRecords] = await Promise.all([
//         supabase.from('profiles').select('full_name').eq('id', authData.user.id).maybeSingle(),
//         getMyInvestments(), getMyRoiPayments(),
//       ]);
//       if (profileResult.error) throw profileResult.error;
//       if (!alive) return;
//       setInvestorName(profileResult.data?.full_name?.split(' ')[0] || authData.user.email?.split('@')[0] || 'Investor');
//       setInvestorId(authData.user.id.slice(0, 8).toUpperCase());
//       setInvestments(investmentRows as any[]);
//       setRoiRows(roiRecords as any[]);
//     })().catch((error:any)=>Alert.alert('Could not load dashboard',error?.message||'Please try again.')).finally(()=>{if(alive)setLoading(false)});
//     return ()=>{alive=false};
//   }, []);
//   const activeInvestments = investments.filter(item => item.status === 'active');
//   const principal = activeInvestments.reduce((sum,item)=>sum+Number(item.principal),0);
//   const monthlyROI = activeInvestments.reduce((sum,item)=>sum+Number(item.principal)*Number(item.monthly_roi_rate),0);
//   const totalPaid = roiRows.filter(item=>item.status==='paid').reduce((sum,item)=>sum+Number(item.amount),0);
//   const nextROI = roiRows.filter(item=>item.status==='pending' && item.due_date >= new Date().toISOString().slice(0,10)).sort((a,b)=>a.due_date.localeCompare(b.due_date))[0];
//   const termMonths = 24;
//   const currentMonth = activeInvestments.reduce((max,item) => { const start = new Date(item.start_date + 'T00:00:00'); const elapsed = Math.max(0, (new Date().getFullYear()-start.getFullYear())*12 + new Date().getMonth()-start.getMonth()); return Math.max(max, Math.min(24, elapsed)); }, 0);
//   const progress = currentMonth / termMonths;
//   const moneyDate = (value?: string) => value ? new Date(value + 'T00:00:00').toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'}) : 'No scheduled payment';

//   return (
//     <View style={styles.screen}>
//       <View style={styles.fixedHeader}>
//       <View style={styles.topRow}>
//         <View style={{ flex: 1 }}>
//           <Text style={styles.brand}>THE CONCEPT</Text>
//           <Text style={styles.greeting}>Good morning, {investorName}</Text>
//           <View style={styles.idRow}>
//             <Text style={styles.investorId}>Investor ID: {investorId || '—'}</Text>
//             <View style={styles.dot} />
//             <Text style={styles.activeText}>{activeInvestments.length ? 'Portfolio active' : 'No active investment'}</Text>
//           </View>
//         </View>
//         <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/notifications' as never)} accessibilityLabel="Notifications">
//           <Ionicons name="notifications-outline" size={23} color={C.text} />
//           <View style={styles.unreadDot} />
//         </TouchableOpacity>
//       </View>
//       </View>

//       <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
//       <View style={styles.hero}>
//         <View style={styles.heroTop}>
//           <View style={styles.tierRow}>
//             <Ionicons name="shield-checkmark-outline" size={17} color="#93CCFF" />
//             <Text style={styles.tierText}>INVESTMENT OVERVIEW</Text>
//           </View>
//           <View style={styles.activePill}><View style={styles.activePillDot} /><Text style={styles.activePillText}>{activeInvestments.length ? 'ACTIVE' : 'NO ACTIVE CONTRACT'}</Text></View>
//         </View>
//         <Text style={styles.heroLabel}>TOTAL ACTIVE INVESTMENT</Text>
//         <Text style={styles.heroAmount}>{loading ? 'Loading…' : money(principal)}</Text>
//         <View style={styles.heroMetrics}>
//           <Metric label="TOTAL ROI PAID" value={money(totalPaid)} helper="Confirmed in Supabase" color="#6FFBBE" />
//           <Metric label="NEXT ROI DUE" value={money(nextROI ? Number(nextROI.amount) : 0)} helper={moneyDate(nextROI?.due_date)} color="#93CCFF" />
//         </View>
//         <Text style={styles.demoNote}>Figures reflect approved investment and ROI records in Supabase.</Text>
//       </View>

//       <View style={styles.card}>
//         <View style={styles.rowBetween}>
//           <View style={styles.row}>
//             <View style={styles.smallIcon}><Ionicons name="calendar-outline" size={20} color={C.blue} /></View>
//             <View>
//               <Text style={styles.cardTitle}>Upcoming ROI payment</Text>
//               <Text style={styles.muted}>Monthly payment schedule</Text>
//             </View>
//           </View>
//           <View style={styles.upcomingPill}><Text style={styles.upcomingText}>UPCOMING</Text></View>
//         </View>
//         <Text style={styles.label}>EXPECTED ROI AMOUNT</Text>
//         <Text style={styles.amount}>{money(monthlyROI)}</Text>
//         <View style={styles.row}>
//           <Ionicons name="time-outline" size={16} color={C.muted} />
//           <Text style={styles.muted}>Due date: {moneyDate(nextROI?.due_date)}</Text>
//         </View>
//         <View style={styles.infoBox}>
//           <Ionicons name="information-circle-outline" size={18} color={C.muted} />
//           <Text style={styles.infoText}>Payment is marked paid only after an authorized administrator confirms and records it.</Text>
//         </View>
//       </View>

//       <SectionTitle title="24-month investment progress" action="View details" onPress={() => router.push('/(tabs)/investments')} />
//       <View style={styles.card}>
//         <View style={styles.rowBetween}>
//           <Text style={styles.cardTitle}>Investment term</Text>
//           <Text style={styles.blueText}>Month {currentMonth} of {termMonths}</Text>
//         </View>
//         <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
//         <View style={styles.rowBetween}>
//           <Text style={styles.muted}>Mar 2026</Text>
//           <Text style={styles.muted}>{Math.round(progress * 100)}% completed</Text>
//           <Text style={styles.muted}>Mar 2028</Text>
//         </View>
//         <View style={styles.detailGrid}>
//           <View style={styles.detailCell}><Text style={styles.label}>MONTHLY ROI RATE</Text><Text style={styles.detailValue}>2.5%</Text></View>
//           <View style={styles.detailCell}><Text style={styles.label}>REMAINING MONTHS</Text><Text style={styles.detailValue}>{termMonths - currentMonth}</Text></View>
//         </View>
//       </View>

//       <SectionTitle title="Quick actions" />
//       <View style={styles.actionGrid}>
//         <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/investments')}>
//           <View style={styles.actionIcon}><Ionicons name="briefcase-outline" size={22} color={C.blue} /></View>
//           <Text style={styles.actionTitle}>My investments</Text><Text style={styles.actionSub}>View contract details</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/roi')}>
//           <View style={styles.actionIcon}><Ionicons name="receipt-outline" size={22} color={C.blue} /></View>
//           <Text style={styles.actionTitle}>ROI history</Text><Text style={styles.actionSub}>Review payment records</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/reinvest' as never)}>
//           <View style={styles.actionIcon}><Ionicons name="repeat-outline" size={22} color={C.blue} /></View>
//           <Text style={styles.actionTitle}>Reinvest ROI</Text><Text style={styles.actionSub}>When eligible balance exists</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/notifications' as never)}>
//           <View style={styles.actionIcon}><Ionicons name="notifications-outline" size={22} color={C.blue} /></View>
//           <Text style={styles.actionTitle}>Notifications</Text><Text style={styles.actionSub}>Payment updates</Text>
//         </TouchableOpacity>
//       </View>

//       <SectionTitle title="Recent activity" action="See all" onPress={() => router.push('/(tabs)/roi')} />
//       <View style={styles.card}>
//         {roiRows.slice(0, 3).length === 0 ? <Text style={styles.muted}>No investment activity yet. Approved ROI records will appear here.</Text> : roiRows.slice(0, 3).map((item, index) => {
//           const paid = item.status === 'paid';
//           const color = paid ? C.green : C.amber;
//           const title = paid ? 'ROI payment recorded' : 'ROI payment scheduled';
//           const detail = `Month ${item.period_month} · ${moneyDate(item.due_date)}`;
//           return <View key={item.id} style={[styles.activityRow, index > 0 && styles.activityBorder]}>
//             <View style={[styles.activityIcon, { backgroundColor: `${color}15` }]}><Ionicons name={paid ? 'checkmark-circle' : 'calendar'} size={19} color={color} /></View>
//             <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>
//             <Text style={[styles.activityAmount, { color }]}>{money(Number(item.amount))}</Text>
//           </View>;
//         })}
//       </View>
//       <Text style={styles.disclaimer}>Investment information is shown for record-keeping. This app does not initiate withdrawals. Figures are drawn from approved investment and ROI records.</Text>
//       </ScrollView>
//     </View>
//   );
// }

// const makeStyles = (dark: boolean) => { const C = getPalette(dark); return StyleSheet.create({
//   screen: { flex: 1, backgroundColor: (dark ? '#0B1220' : '#F7F9FB') },
//   fixedHeader: {
//     paddingHorizontal: 20,
//     paddingTop: 58,
//     paddingBottom: 14,
//     backgroundColor: (dark ? '#0B1220' : '#F7F9FB'),
//     borderBottomWidth: 1,
//     borderBottomColor: (dark ? '#263449' : '#E7EBF2'),
//     zIndex: 10,
//   },
//   scrollArea: { flex: 1 },
//   content: { padding: 20, paddingTop: 16, paddingBottom: 36, gap: 16 },
//   topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 },
//   brand: { fontSize: 10, letterSpacing: 1.8, fontWeight: '800', color: C.blue, marginBottom: 6 },
//   greeting: { fontSize: 23, fontWeight: '800', letterSpacing: -0.5, color: (dark ? '#F2F5FA' : '#191C1E') },
//   idRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 7 },
//   investorId: { fontSize: 10, color: (dark ? '#A4B0C0' : '#75777D'), letterSpacing: 0.4 },
//   dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#B5BBC5' },
//   activeText: { color: '#087B57', fontSize: 10, fontWeight: '700' },
//   iconButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: (dark ? '#121C2D' : '#FFF'), borderWidth: 1, borderColor: (dark ? '#263449' : '#E7EBF2'), alignItems: 'center', justifyContent: 'center' },
//   unreadDot: { position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: '#C53B42' },
//   hero: { backgroundColor: '#0E1C2F', borderRadius: 22, padding: 20, gap: 15, overflow: 'hidden' },
//   heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
//   tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
//   tierText: { color: '#93CCFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
//   activePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#173B38', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
//   activePillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4EDEA3' },
//   activePillText: { color: '#6FFBBE', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
//   heroLabel: { color: '#AAB8CC', fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: -9 },
//   heroAmount: { color: (dark ? '#121C2D' : '#FFF'), fontSize: 31, fontWeight: '800', letterSpacing: -0.8 },
//   heroMetrics: { flexDirection: 'row', backgroundColor: '#1B2C40', borderRadius: 14, padding: 13, gap: 12 },
//   metric: { flex: 1, gap: 5 },
//   metricLabel: { color: '#AAB8CC', fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
//   metricValue: { fontSize: 17, fontWeight: '800' },
//   metricHelper: { color: '#AAB8CC', fontSize: 10 },
//   demoNote: { color: '#AAB8CC', fontSize: 10, lineHeight: 15 },
//   sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
//   sectionTitle: { color: (dark ? '#F2F5FA' : '#191C1E'), fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
//   link: { color: '#006398', fontSize: 11, fontWeight: '800' },
//   card: { backgroundColor: (dark ? '#121C2D' : '#FFF'), borderRadius: 18, borderWidth: 1, borderColor: (dark ? '#263449' : '#E7EBF2'), padding: 16, gap: 13 },
//   row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
//   rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
//   smallIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: (dark ? '#172B43' : '#EAF1FF'), alignItems: 'center', justifyContent: 'center' },
//   cardTitle: { fontSize: 13, fontWeight: '800', color: (dark ? '#F2F5FA' : '#191C1E') },
//   muted: { color: (dark ? '#A4B0C0' : '#75777D'), fontSize: 10, lineHeight: 15 },
//   upcomingPill: { backgroundColor: (dark ? '#3B2E16' : '#FFF5DE'), borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
//   upcomingText: { color: (dark ? '#F3C66B' : '#996515'), fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
//   label: { color: (dark ? '#A4B0C0' : '#75777D'), fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
//   amount: { color: (dark ? '#F2F5FA' : '#191C1E'), fontSize: 26, fontWeight: '800', marginTop: -8 },
//   infoBox: { flexDirection: 'row', gap: 8, backgroundColor: (dark ? '#1A2638' : '#F2F4F6'), padding: 10, borderRadius: 10, alignItems: 'flex-start' },
//   infoText: { flex: 1, fontSize: 10, color: (dark ? '#C6D0DE' : '#44474C'), lineHeight: 15 },
//   blueText: { color: '#006398', fontSize: 11, fontWeight: '800' },
//   progressTrack: { height: 8, borderRadius: 8, backgroundColor: (dark ? '#334155' : '#E0E3E5'), overflow: 'hidden' },
//   progressFill: { height: '100%', backgroundColor: '#006398', borderRadius: 8 },
//   detailGrid: { flexDirection: 'row', gap: 10, marginTop: 2 },
//   detailCell: { flex: 1, backgroundColor: (dark ? '#0B1220' : '#F7F9FB'), padding: 12, borderRadius: 11, gap: 5 },
//   detailValue: { color: (dark ? '#F2F5FA' : '#191C1E'), fontSize: 17, fontWeight: '800' },
//   actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
//   actionCard: { width: '48%', flexGrow: 1, backgroundColor: (dark ? '#121C2D' : '#FFF'), borderRadius: 15, borderWidth: 1, borderColor: (dark ? '#263449' : '#E7EBF2'), padding: 14, gap: 6 },
//   actionIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: (dark ? '#172B43' : '#EAF1FF'), alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
//   actionTitle: { color: (dark ? '#F2F5FA' : '#191C1E'), fontSize: 12, fontWeight: '800' },
//   actionSub: { color: (dark ? '#A4B0C0' : '#75777D'), fontSize: 10, lineHeight: 14 },
//   activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
//   activityBorder: { borderTopWidth: 1, borderTopColor: (dark ? '#263449' : '#EEF0F3'), paddingTop: 13 },
//   activityIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
//   activityTitle: { color: (dark ? '#F2F5FA' : '#191C1E'), fontSize: 11, fontWeight: '800', marginBottom: 3 },
//   activityAmount: { fontSize: 10, fontWeight: '800' },
//   disclaimer: { color: (dark ? '#A4B0C0' : '#75777D'), fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 8, marginTop: 2 },
// }); };
