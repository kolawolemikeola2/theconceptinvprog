import { Ionicons } from '@expo/vector-icons';

import { router } from 'expo-router';

import { getPalette, useAppTheme } from '../../constants/app-theme';
import { supabase } from '../../lib/supabase';

import React, { useEffect, useState } from 'react';

import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';



const getC = getPalette;



type MenuItemProps = { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle?: string; onPress?: () => void; danger?: boolean; trailing?: React.ReactNode };

function MenuItem({ icon, title, subtitle, onPress, danger, trailing }: MenuItemProps) {

  const { isDark } = useAppTheme(); const C = getPalette(isDark); const styles = makeStyles(isDark);

  return (

    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>

      <View style={[styles.menuIcon, danger && { backgroundColor: '#FDECEC' }]}><Ionicons name={icon} size={19} color={danger ? C.red : C.text} /></View>

      <View style={{ flex: 1 }}><Text style={[styles.menuTitle, danger && { color: C.red }]}>{title}</Text>{!!subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}</View>

      {trailing ?? <Ionicons name="chevron-forward" size={18} color="#9AA1AB" />}

    </TouchableOpacity>

  );

}

function Group({ title, children }: { title: string; children: React.ReactNode }) {

  const { isDark } = useAppTheme(); const styles = makeStyles(isDark);

  return <View style={styles.group}><Text style={styles.groupTitle}>{title}</Text><View style={styles.groupCard}>{children}</View></View>;

}



export default function ProfileScreen() {

  const { isDark, toggleTheme } = useAppTheme();

  const C = getC(isDark);

  const styles = makeStyles(isDark);

  const [roiAlerts, setRoiAlerts] = useState(true);

  const [reinvestReminders, setReinvestReminders] = useState(true);

  const [monthlyStatement, setMonthlyStatement] = useState(false);
  const [profileName, setProfileName] = useState('Investor');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileId, setProfileId] = useState('');
  const [profileRole, setProfileRole] = useState<'investor' | 'admin'>('investor');
  const [memberSince, setMemberSince] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { data: profile } = await supabase.from('profiles').select('full_name,phone,created_at,role').eq('id', authData.user.id).maybeSingle();
      if (!alive) return;
      setProfileName(profile?.full_name || authData.user.email?.split('@')[0] || 'Investor');
      setProfileEmail(authData.user.email || '');
      setProfilePhone(profile?.phone || '');
      setProfileRole(profile?.role === 'admin' ? 'admin' : 'investor');
      setProfileId(authData.user.id.slice(0, 8).toUpperCase());
      setMemberSince(authData.user.created_at ? new Date(authData.user.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'}) : '');
    })();
    return () => { alive = false; };
  }, []);



  return (

    <View style={styles.screen}>

      <View style={styles.fixedHeader}>

      <View style={styles.header}>

        <View><Text style={styles.eyebrow}>THE CONCEPT · INVESTOR PORTAL</Text><Text style={styles.title}>My Profile</Text><Text style={styles.subtitle}>Your account and preferences</Text></View>

        <TouchableOpacity style={styles.bell} onPress={() => router.push('/notifications' as never)}><Ionicons name="notifications-outline" size={22} color={C.text} /></TouchableOpacity>

      </View>

      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>





      <View style={styles.profileCard}>

        <View style={styles.profileTop}>

          <View style={styles.avatar}><Text style={styles.avatarText}>{profileName.split(' ').map(part => part[0] || '').join('').slice(0, 2).toUpperCase()}</Text><View style={styles.verifiedDot}><Ionicons name="checkmark" size={10} color="#FFF" /></View></View>

          <View style={{ flex: 1 }}><Text style={styles.name}>{profileName}</Text><Text style={styles.memberId}>ID: {profileId || '—'}</Text><Text style={styles.memberSince}>Member since {memberSince || '—'}</Text></View>

          <TouchableOpacity style={styles.editButton} onPress={() => Alert.alert('Edit profile', 'Profile editing will be connected to your account service.')}><Ionicons name="create-outline" size={18} color={C.text} /></TouchableOpacity>

        </View>

        <View style={styles.verification}><Ionicons name="shield-checkmark" size={17} color={C.blue} /><Text style={styles.verificationText}>{profileRole === 'admin' ? 'Administrator account' : 'Investor account'}</Text><View style={styles.demoBadge}><Text style={styles.demoBadgeText}>LIVE</Text></View></View>

        <View style={styles.contactRow}><Ionicons name="mail-outline" size={17} color={C.muted} /><Text style={styles.contactText}>{profileEmail || '—'}</Text></View>

        <View style={styles.contactRow}><Ionicons name="call-outline" size={17} color={C.muted} /><Text style={styles.contactText}>{profilePhone || 'Add your phone number'}</Text></View>

        <Text style={styles.demoNote}>Your profile details are loaded from your authenticated Supabase account.</Text>

      </View>



      {profileRole === 'admin' && (
        <Group title="ADMINISTRATION">
          <MenuItem
            icon="shield-checkmark-outline"
            title="Admin review"
            subtitle="Review payment receipts and approve or reject investment applications"
            onPress={() => router.push('/admin-review' as never)}
            trailing={
              <View style={styles.adminAction}>
                <Text style={styles.adminActionText}>Open</Text>
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </View>
            }
          />
        </Group>
      )}

      <Group title="PREFERENCES">

        <MenuItem icon={isDark ? "moon" : "sunny-outline"} title="Dark mode" subtitle={isDark ? "Dark appearance is enabled across the app" : "Use a darker appearance across the app"} trailing={<Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#B8C0CC', true: C.blue }} thumbColor={isDark ? '#FFFFFF' : '#F4F4F4'} />} onPress={() => {}} />

      </Group>



      <Group title="ACCOUNT & SECURITY">

        <MenuItem icon="person-outline" title="Personal details" subtitle="Manage your contact information" onPress={() => Alert.alert('Personal details', 'This screen will be connected next.')} />

        <View style={styles.separator} />

        <MenuItem icon="lock-closed-outline" title="Change password" subtitle="Update your account password" onPress={() => router.push('/(auth)/forgot-password' as never)} />

        <View style={styles.separator} />

        <MenuItem icon="finger-print-outline" title="Biometric authentication" subtitle="Face ID or fingerprint, if supported" trailing={<Switch value={false} onValueChange={() => Alert.alert('Security setting', 'Biometric authentication will be implemented with secure device storage.')} trackColor={{ true: C.blue }} />} onPress={() => Alert.alert('Biometric authentication', 'This setting is a UI placeholder until secure authentication is implemented.')} />

      </Group>



      <Group title="INVESTMENT & NOTIFICATIONS">

        <MenuItem icon="notifications-outline" title="ROI payment alerts" subtitle="When payment status is updated" trailing={<Switch value={roiAlerts} onValueChange={setRoiAlerts} trackColor={{ true: C.blue }} />} onPress={() => setRoiAlerts(v => !v)} />

        <View style={styles.separator} />

        <MenuItem icon="repeat-outline" title="Reinvestment reminders" subtitle="When an ROI becomes eligible" trailing={<Switch value={reinvestReminders} onValueChange={setReinvestReminders} trackColor={{ true: C.blue }} />} onPress={() => setReinvestReminders(v => !v)} />

        <View style={styles.separator} />

        <MenuItem icon="document-text-outline" title="Monthly investment statement" subtitle="Statement availability notifications" trailing={<Switch value={monthlyStatement} onValueChange={setMonthlyStatement} trackColor={{ true: C.blue }} />} onPress={() => setMonthlyStatement(v => !v)} />

      </Group>



      <Group title="LEGAL, COMPLIANCE & SUPPORT">

        <MenuItem icon="document-text-outline" title="Terms & agreement" subtitle="Review investment terms" onPress={() => Alert.alert('Terms & agreement', 'The official company agreement will be linked here.')} />

        <View style={styles.separator} />

        <MenuItem icon="help-circle-outline" title="Help & FAQs" subtitle="Answers about your investment and ROI" onPress={() => router.push('/support' as never)} />

        <View style={styles.separator} />

        <MenuItem icon="headset-outline" title="Investor support" subtitle="Contact the support team" onPress={() => router.push('/support' as never)} />

      </Group>



      <View style={styles.group}>

        <TouchableOpacity style={styles.logoutButton} onPress={() => Alert.alert('Log out', 'Are you sure you want to return to the login screen?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: async () => { const { error } = await supabase.auth.signOut(); if (error) Alert.alert('Log out failed', error.message); else router.replace('/login' as never); } }])}>

          <Ionicons name="log-out-outline" size={19} color={C.red} /><Text style={styles.logoutText}>Log out</Text>

        </TouchableOpacity>

      </View>

      <Text style={styles.footer}>THE CONCEPT INVESTMENT PROGRAM{"\n"}Account settings and preferences are sample UI until connected to your secure account.</Text>

      </ScrollView>

    </View>

  );

}



const makeStyles = (dark: boolean) => { const C = getC(dark); return StyleSheet.create({

  screen: { flex: 1, backgroundColor: C.bg }, fixedHeader: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 14, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, zIndex: 10 }, scrollArea: { flex: 1 }, content: { padding: 20, paddingTop: 16, paddingBottom: 36, gap: 17 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { fontSize: 9, color: C.blue, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 }, title: { color: C.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 }, subtitle: { color: C.muted, fontSize: 11, marginTop: 5 }, bell: { width: 43, height: 43, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

  profileCard: { backgroundColor: C.white, borderRadius: 19, padding: 17, borderWidth: 1, borderColor: C.border, gap: 13 }, profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 59, height: 59, borderRadius: 30, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.white, fontSize: 18, fontWeight: '800' }, verifiedDot: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: C.green, borderWidth: 2, borderColor: C.white, alignItems: 'center', justifyContent: 'center' }, name: { color: C.text, fontSize: 16, fontWeight: '800' }, memberId: { color: C.blue, fontSize: 9, fontWeight: '800', marginTop: 5 }, memberSince: { color: C.muted, fontSize: 10, marginTop: 4 }, editButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: (dark ? '#1A2638' : '#F2F4F6'), alignItems: 'center', justifyContent: 'center' },

  verification: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.blueLight, padding: 10, borderRadius: 10 }, verificationText: { color: C.blue, fontSize: 10, fontWeight: '800', flex: 1 }, demoBadge: { backgroundColor: (dark ? '#203B55' : '#D4E8F5'), paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 }, demoBadgeText: { color: C.blue, fontSize: 8, fontWeight: '900' }, contactRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, contactText: { color: (dark ? '#C6D0DE' : '#44474C'), fontSize: 11 }, demoNote: { color: C.muted, fontSize: 9, lineHeight: 14, borderTopWidth: 1, borderTopColor: (dark ? '#263449' : '#EEF0F3'), paddingTop: 10 },

  group: { gap: 8 }, groupTitle: { color: C.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 2 }, groupCard: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingHorizontal: 13, overflow: 'hidden' }, menuItem: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 }, menuIcon: { width: 37, height: 37, borderRadius: 11, backgroundColor: (dark ? '#1A2638' : '#F2F4F6'), alignItems: 'center', justifyContent: 'center' }, menuTitle: { color: C.text, fontSize: 11, fontWeight: '800' }, menuSubtitle: { color: C.muted, fontSize: 9, marginTop: 4 }, separator: { height: 1, backgroundColor: (dark ? '#263449' : '#EEF0F3'), marginLeft: 48 },

  adminAction: { backgroundColor: C.blue, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }, adminActionText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' }, logoutButton: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: (dark ? '#54313A' : '#F2D5D5'), minHeight: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, logoutText: { color: C.red, fontSize: 12, fontWeight: '800' }, footer: { textAlign: 'center', color: C.muted, fontSize: 9, lineHeight: 15, letterSpacing: 0.5 },

}); };
