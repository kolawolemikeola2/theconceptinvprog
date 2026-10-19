import { Ionicons } from '@expo/vector-icons';
import { getPalette, useAppTheme } from '../../constants/app-theme';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getMyRoiPayments } from '../../services/investments';

const getC = getPalette;
type Status = 'Paid' | 'Upcoming' | 'Pending' | 'Overdue';
type Filter = 'All' | 'Paid' | 'Upcoming' | 'Pending';

type RecordItem = { id: string; month: number; dueDate: string; amount: number; status: Status; paidDate?: string; reference?: string; reinvested?: boolean };

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const statusColor = (status: Status, dark = false) => status === 'Paid' ? (dark ? '#4DD6A0' : '#087B57') : status === 'Upcoming' ? (dark ? '#F3C66B' : '#996515') : status === 'Overdue' ? (dark ? '#FF7A7A' : '#BA1A1A') : (dark ? '#55B8F2' : '#006398');
const statusBg = (status: Status, dark = false) => status === 'Paid' ? (dark ? '#12372F' : '#E7F7EF') : status === 'Upcoming' ? (dark ? '#3B2E16' : '#FFF5DE') : status === 'Overdue' ? (dark ? '#3A2028' : '#FDECEC') : (dark ? '#172B43' : '#EAF1FF');

export default function ROIScreen() {
  const { isDark } = useAppTheme();
  const C = getC(isDark);
  const styles = makeStyles(isDark);
  const [filter, setFilter] = useState<Filter>('All');
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    getMyRoiPayments().then((rows: any[]) => {
      if (!alive) return;
      const today = new Date().toISOString().slice(0,10);
      const firstFuturePending = rows.find(row => row.status === 'pending' && row.due_date >= today)?.id;
      const mapped = rows.map(row => {
        let status: Status = row.status === 'paid' ? 'Paid' : row.status === 'cancelled' ? 'Pending' : row.due_date < today ? 'Overdue' : row.id === firstFuturePending ? 'Upcoming' : 'Pending';
        return { id: row.id, month: Number(row.period_month), dueDate: new Date(row.due_date + 'T00:00:00').toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'}), amount: Number(row.amount), status, paidDate: row.paid_at ? new Date(row.paid_at).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'}) : undefined } as RecordItem;
      });
      setRecords(mapped);
    }).catch((error:any)=>Alert.alert('Could not load ROI records',error?.message||'Please try again.')).finally(()=>{if(alive)setLoading(false)});
    return ()=>{alive=false};
  }, []);
  const filtered = useMemo(() => records.filter(r => filter === 'All' || (filter === 'Pending' ? r.status === 'Pending' || r.status === 'Overdue' : r.status === filter)), [filter, records]);
  const totalPaid = records.filter(r => r.status === 'Paid').reduce((sum, r) => sum + r.amount, 0);
  const upcoming = records.find(r => r.status === 'Upcoming');

  return (
    <View style={styles.screen}>
      <View style={styles.fixedHeader}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>THE CONCEPT · INVESTOR PORTAL</Text><Text style={styles.title}>ROI Payment History</Text><Text style={styles.subtitle}>Your monthly ROI record and schedule</Text></View>
        <TouchableOpacity style={styles.bell} onPress={() => Alert.alert('Statement', 'Statement export will be connected to the backend.') }><Ionicons name="download-outline" size={21} color={C.blue} /></TouchableOpacity>
      </View>
      </View>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>


      {loading ? <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator size="large" color={C.blue} /></View> : <><View style={styles.metrics}>
        <View style={styles.metric}><View style={styles.metricTitle}><Ionicons name="checkmark-circle-outline" size={14} color={C.green} /><Text style={styles.metricLabel}>TOTAL PAID</Text></View><Text style={styles.metricValue}>{money(totalPaid)}</Text><Text style={styles.metricSub}>{records.filter(r => r.status === 'Paid').length} installments</Text></View>
        <View style={styles.metric}><View style={styles.metricTitle}><Ionicons name="pie-chart-outline" size={14} color={C.blue} /><Text style={styles.metricLabel}>COMPLETED</Text></View><Text style={styles.metricValue}>{records.filter(r => r.status === 'Paid').length}<Text style={styles.metricSmall}> / {records.length}</Text></Text><View style={styles.miniTrack}><View style={[styles.miniFill, { width: `${records.length ? (records.filter(r => r.status === 'Paid').length / records.length) * 100 : 0}%` }]} /></View></View>
        <View style={[styles.metric, { backgroundColor: C.amberLight }]}><View style={styles.metricTitle}><Ionicons name="time-outline" size={14} color={C.amber} /><Text style={[styles.metricLabel, { color: C.amber }]}>NEXT DUE</Text></View><Text style={[styles.metricValue, { color: C.amber }]}>{money(upcoming?.amount ?? 0)}</Text><Text style={[styles.metricSub, { color: C.amber }]}>{upcoming?.dueDate ?? 'No upcoming ROI'}</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Payment records</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['All', 'Paid', 'Upcoming', 'Pending'] as Filter[]).map(item => (
          <TouchableOpacity key={item} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item === 'Paid' ? 'Paid / Confirmed' : item === 'Pending' ? 'Pending / Overdue' : item}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.empty}><Ionicons name="receipt-outline" size={27} color={C.muted} /><Text style={styles.emptyTitle}>No records found</Text><Text style={styles.emptyText}>There are no ROI records for this filter.</Text></View>
      ) : filtered.map(item => (
        <TouchableOpacity key={item.id} style={styles.record} onPress={() => setSelected(item)} activeOpacity={0.75}>
          <View style={styles.recordTop}>
            <View style={[styles.recordIcon, { backgroundColor: statusBg(item.status, isDark) }]}><Ionicons name={item.status === 'Paid' ? 'checkmark-circle-outline' : item.status === 'Upcoming' ? 'hourglass-outline' : 'time-outline'} size={21} color={statusColor(item.status, isDark)} /></View>
            <View style={{ flex: 1 }}>
              <View style={styles.recordTitleRow}><Text style={styles.recordTitle}>Cycle Month {item.month}</Text><View style={[styles.statusPill, { backgroundColor: statusBg(item.status, isDark) }]}><Text style={[styles.statusText, { color: statusColor(item.status, isDark) }]}>{item.status.toUpperCase()}</Text></View></View>
              <Text style={styles.recordSub}>Due: {item.dueDate}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#9AA1AB" />
          </View>
          <View style={styles.recordBottom}><View><Text style={styles.recordLabel}>{item.status === 'Paid' ? 'AMOUNT RECORDED' : 'EXPECTED ROI'}</Text><Text style={styles.recordAmount}>{money(item.amount)}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={styles.recordLabel}>{item.status === 'Paid' ? 'PAYMENT DATE' : 'PAYMENT STATUS'}</Text><Text style={[styles.recordDate, { color: statusColor(item.status, isDark) }]}>{item.paidDate ?? item.status}</Text></View></View>
          {item.reinvested && <View style={styles.reinvestBadge}><Ionicons name="repeat-outline" size={14} color={C.blue} /><Text style={styles.reinvestText}>Reinvestment recorded for this ROI</Text></View>}
        </TouchableOpacity>
      ))}

      <View style={styles.governance}><Ionicons name="information-circle-outline" size={18} color={C.blue} /><Text style={styles.governanceText}>ROI records are loaded from Supabase. A payment is marked paid only after an authorized administrator records a confirmed payment.</Text></View>

      </>}
      {!!selected && (
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalScrim} onPress={() => setSelected(null)} />
          <View style={styles.receipt}>
            <View style={styles.receiptHandle} />
            <View style={styles.receiptHeader}><View style={[styles.receiptIcon, { backgroundColor: statusBg(selected.status, isDark) }]}><Ionicons name="receipt-outline" size={23} color={statusColor(selected.status, isDark)} /></View><TouchableOpacity onPress={() => setSelected(null)} style={styles.close}><Ionicons name="close" size={22} color={C.muted} /></TouchableOpacity></View>
            <Text style={styles.receiptTitle}>ROI payment details</Text><Text style={styles.receiptSub}>Investment ROI schedule</Text>
            <Text style={styles.receiptLabel}>ROI AMOUNT</Text><Text style={styles.receiptAmount}>{money(selected.amount)}</Text>
            <View style={styles.receiptRow}><Text style={styles.receiptKey}>Period</Text><Text style={styles.receiptVal}>Month {selected.month} of 24</Text></View>
            <View style={styles.receiptRow}><Text style={styles.receiptKey}>Due date</Text><Text style={styles.receiptVal}>{selected.dueDate}</Text></View>
            <View style={styles.receiptRow}><Text style={styles.receiptKey}>Status</Text><Text style={[styles.receiptVal, { color: statusColor(selected.status, isDark) }]}>{selected.status}</Text></View>
            {!!selected.paidDate && <View style={styles.receiptRow}><Text style={styles.receiptKey}>Payment date</Text><Text style={styles.receiptVal}>{selected.paidDate}</Text></View>}
            {!!selected.reference && <View style={styles.receiptRow}><Text style={styles.receiptKey}>Transaction reference</Text><Text style={styles.receiptVal}>{selected.reference}</Text></View>}
            <Text style={styles.receiptNote}>{selected.status === 'Paid' ? 'This sample record represents a payment recorded by an authorized administrator.' : 'This ROI is not marked as paid. Check the status again after the company updates its records.'}</Text>
            <TouchableOpacity style={styles.doneButton} onPress={() => setSelected(null)}><Text style={styles.doneText}>Close details</Text></TouchableOpacity>
          </View>
        </View>
      )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (dark: boolean) => { const C = getC(dark); return StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg }, fixedHeader: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 14, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, zIndex: 10 }, scrollArea: { flex: 1 }, content: { padding: 20, paddingTop: 16, paddingBottom: 36, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, eyebrow: { color: C.blue, fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 }, title: { color: C.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.6 }, subtitle: { color: C.muted, fontSize: 11, marginTop: 5 }, bell: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', gap: 7 }, metric: { flex: 1, backgroundColor: C.white, borderRadius: 13, padding: 10, borderWidth: 1, borderColor: C.border, gap: 7 }, metricTitle: { flexDirection: 'row', alignItems: 'center', gap: 4 }, metricLabel: { color: C.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.3 }, metricValue: { color: C.green, fontSize: 13, fontWeight: '800' }, metricSmall: { color: C.muted, fontSize: 10, fontWeight: '600' }, metricSub: { color: C.muted, fontSize: 8 }, miniTrack: { height: 4, borderRadius: 4, backgroundColor: (dark ? '#334155' : '#E0E3E5'), overflow: 'hidden' }, miniFill: { height: '100%', backgroundColor: C.blue, borderRadius: 4 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: '800', marginTop: 2 }, filters: { gap: 8, paddingRight: 4 }, filterChip: { backgroundColor: (dark ? '#1A2638' : '#ECEEF0'), borderRadius: 22, paddingHorizontal: 13, paddingVertical: 9 }, filterActive: { backgroundColor: C.navy }, filterText: { color: (dark ? '#C6D0DE' : '#44474C'), fontSize: 10, fontWeight: '700' }, filterTextActive: { color: C.white },
  record: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, gap: 13 }, recordTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, recordIcon: { width: 41, height: 41, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, recordTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }, recordTitle: { color: C.text, fontSize: 12, fontWeight: '800' }, statusPill: { borderRadius: 15, paddingHorizontal: 7, paddingVertical: 4 }, statusText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 }, recordSub: { color: C.muted, fontSize: 9, marginTop: 5 }, recordBottom: { borderTopWidth: 1, borderTopColor: (dark ? '#263449' : '#EEF0F3'), paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, recordLabel: { color: C.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5, marginBottom: 5 }, recordAmount: { color: C.text, fontSize: 17, fontWeight: '800' }, recordDate: { fontSize: 10, fontWeight: '800' }, reinvestBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.blueLight, padding: 8, borderRadius: 9 }, reinvestText: { color: C.blue, fontSize: 9, fontWeight: '700' },
  empty: { alignItems: 'center', backgroundColor: C.white, borderRadius: 16, padding: 25, gap: 9 }, emptyTitle: { color: C.text, fontSize: 13, fontWeight: '800' }, emptyText: { color: C.muted, fontSize: 10 }, governance: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.blueLight, padding: 12, borderRadius: 12 }, governanceText: { flex: 1, color: (dark ? '#C6D0DE' : '#34475C'), fontSize: 10, lineHeight: 15 },
  modalBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }, modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,28,47,0.45)' }, receipt: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 30, gap: 13 }, receiptHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: (dark ? '#344256' : '#D4D8DE'), alignSelf: 'center', marginBottom: 2 }, receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, receiptIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, close: { padding: 5 }, receiptTitle: { color: C.text, fontSize: 20, fontWeight: '800' }, receiptSub: { color: C.muted, fontSize: 10 }, receiptLabel: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 4 }, receiptAmount: { color: C.text, fontSize: 28, fontWeight: '800', marginTop: -8 }, receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: (dark ? '#263449' : '#EEF0F3'), paddingVertical: 9 }, receiptKey: { color: C.muted, fontSize: 10 }, receiptVal: { color: C.text, fontSize: 10, fontWeight: '800', flexShrink: 1, textAlign: 'right' }, receiptNote: { color: C.muted, fontSize: 10, lineHeight: 15, backgroundColor: C.bg, padding: 10, borderRadius: 9 }, doneButton: { backgroundColor: C.blue, borderRadius: 12, minHeight: 45, alignItems: 'center', justifyContent: 'center' }, doneText: { color: C.white, fontSize: 12, fontWeight: '800' },
}); };
