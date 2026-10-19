import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getPalette, useAppTheme } from '../../constants/app-theme';

type NotificationType = 'payment' | 'investment' | 'security' | 'system';
type Notice = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  amount?: string;
};
type Filter = 'All' | 'Unread' | 'Payments' | 'Account';

const initialNotices: Notice[] = [
  { id: 'n1', type: 'payment', title: 'ROI payment recorded', message: 'Your illustrative October ROI record of $250 has been marked as paid in the sample ledger.', time: '1 Oct 2026 · 9:15 AM', unread: true, amount: '$250' },
  { id: 'n2', type: 'payment', title: 'Upcoming ROI payment', message: 'Your next scheduled ROI payment is shown as due on 1 November 2026.', time: 'Today · 8:30 AM', unread: true, amount: '$250' },
  { id: 'n3', type: 'investment', title: 'Investment is active', message: 'Your sample investment contract CIP-2026-001 is currently displayed as active.', time: '28 Sep 2026 · 2:40 PM', unread: true },
  { id: 'n4', type: 'security', title: 'Keep your account secure', message: 'Never share your password, verification code, or account details with anyone.', time: '25 Sep 2026 · 10:00 AM', unread: false },
  { id: 'n5', type: 'system', title: 'Welcome to The Concept', message: 'Your investor portal brings your investment summary, ROI history, and profile together in one place.', time: '20 Sep 2026 · 11:20 AM', unread: false },
];

const iconFor = (type: NotificationType): React.ComponentProps<typeof Ionicons>['name'] => {
  if (type === 'payment') return 'cash-outline';
  if (type === 'investment') return 'briefcase-outline';
  if (type === 'security') return 'shield-checkmark-outline';
  return 'notifications-outline';
};

export default function NotificationsScreen() {
  const { isDark } = useAppTheme();
  const C = getPalette(isDark);
  const styles = makeStyles(isDark);
  const [notices, setNotices] = useState(initialNotices);
  const [filter, setFilter] = useState<Filter>('All');
  const unreadCount = notices.filter(item => item.unread).length;
  const filtered = useMemo(() => notices.filter(item => {
    if (filter === 'Unread') return item.unread;
    if (filter === 'Payments') return item.type === 'payment';
    if (filter === 'Account') return item.type === 'security' || item.type === 'system';
    return true;
  }), [notices, filter]);

  const markRead = (id: string) => setNotices(current => current.map(item => item.id === id ? { ...item, unread: false } : item));
  const markAllRead = () => setNotices(current => current.map(item => ({ ...item, unread: false })));

  return (
    <View style={styles.screen}>
      <View style={styles.fixedHeader}>
        <View style={styles.headerTop}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={21} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>THE CONCEPT · INVESTOR PORTAL</Text>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>{unreadCount ? `${unreadCount} unread updates` : 'You’re all caught up'}</Text>
          </View>
          <View style={styles.bellBadge}>
            <Ionicons name="notifications-outline" size={21} color={C.blue} />
            {unreadCount > 0 && <View style={styles.badgeDot} />}
          </View>
        </View>
        <View style={styles.actionRow}>
          <Text style={styles.sectionLabel}>RECENT UPDATES</Text>
          <TouchableOpacity onPress={markAllRead} disabled={unreadCount === 0}>
            <Text style={[styles.markAll, unreadCount === 0 && styles.disabledText]}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['All', 'Unread', 'Payments', 'Account'] as Filter[]).map(item => (
            <TouchableOpacity key={item} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterActive]}>
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="checkmark-done-outline" size={26} color={C.blue} /></View>
            <Text style={styles.emptyTitle}>{filter === 'Unread' ? 'No unread notifications' : 'Nothing to show'}</Text>
            <Text style={styles.emptyText}>New updates will appear here when they are available.</Text>
          </View>
        ) : filtered.map(item => (
          <TouchableOpacity key={item.id} activeOpacity={0.78} onPress={() => markRead(item.id)} style={[styles.noticeCard, item.unread && styles.noticeUnread]}>
            <View style={[styles.noticeIcon, { backgroundColor: item.type === 'payment' ? C.greenLight : item.type === 'security' ? C.amberLight : C.blueLight }]}>
              <Ionicons name={iconFor(item.type)} size={21} color={item.type === 'payment' ? C.green : item.type === 'security' ? C.amber : C.blue} />
            </View>
            <View style={styles.noticeBody}>
              <View style={styles.titleLine}>
                <Text style={styles.noticeTitle}>{item.title}</Text>
                {item.unread && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.noticeMessage}>{item.message}</Text>
              <View style={styles.noticeFooter}>
                <Text style={styles.noticeTime}>{item.time}</Text>
                {item.amount && <Text style={styles.amount}>{item.amount}</Text>}
              </View>
              {item.unread && <Text style={styles.tapHint}>Tap to mark as read</Text>}
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={18} color={C.blue} />
          <Text style={styles.disclaimerText}>These are sample notifications for the interface preview. Live alerts should be connected to your app’s backend and verified transaction records.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (dark: boolean) => {
  const C = getPalette(dark);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    fixedHeader: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 14, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, zIndex: 10, gap: 17 },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    backButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
    headerCopy: { flex: 1 },
    eyebrow: { color: C.blue, fontSize: 8, fontWeight: '800', letterSpacing: 1, marginBottom: 5 },
    title: { color: C.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
    subtitle: { color: C.muted, fontSize: 10, marginTop: 4 },
    bellBadge: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
    badgeDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, borderWidth: 1, borderColor: C.white },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    sectionLabel: { color: C.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
    markAll: { color: C.blue, fontSize: 10, fontWeight: '800' },
    disabledText: { color: C.muted },
    scrollArea: { flex: 1 },
    content: { padding: 20, paddingTop: 16, paddingBottom: 36, gap: 12 },
    filters: { gap: 8, paddingRight: 4, paddingBottom: 4 },
    filterChip: { backgroundColor: dark ? C.soft : '#ECEEF0', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9 },
    filterActive: { backgroundColor: C.navy },
    filterText: { color: C.softText, fontSize: 10, fontWeight: '700' },
    filterTextActive: { color: '#FFFFFF' },
    noticeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 13, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border },
    noticeUnread: { borderColor: C.blue, backgroundColor: dark ? '#101F32' : '#FBFDFF' },
    noticeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    noticeBody: { flex: 1, gap: 6 },
    titleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    noticeTitle: { color: C.text, fontSize: 12, fontWeight: '800', flexShrink: 1 },
    unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.blue },
    noticeMessage: { color: C.muted, fontSize: 10, lineHeight: 15 },
    noticeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    noticeTime: { color: C.muted, fontSize: 8 },
    amount: { color: C.green, fontSize: 11, fontWeight: '900' },
    tapHint: { color: C.blue, fontSize: 8, fontWeight: '700', marginTop: 1 },
    empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 38, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 17, gap: 9 },
    emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { color: C.text, fontSize: 14, fontWeight: '800' },
    emptyText: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
    disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.blueLight, borderRadius: 12, padding: 12, marginTop: 3 },
    disclaimerText: { flex: 1, color: C.softText, fontSize: 9, lineHeight: 14 },
  });
};
