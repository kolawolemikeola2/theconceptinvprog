import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { createReceiptSignedUrl, getPendingApplicationsForAdmin, reviewApplication } from '../services/investments';
import { getPalette, useAppTheme } from '../constants/app-theme';

type PendingApp = { id: string; user_id: string; amount: number; currency: string; duration_months: number; monthly_roi_rate: number; transaction_reference: string | null; receipt_path: string; submitted_at: string; status: string; name?: string; email?: string; receiptUrl?: string };
const usd = (value: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));

export default function AdminReviewScreen() {
  const { isDark } = useAppTheme(); const C = getPalette(isDark);
  const [rows,setRows] = useState<PendingApp[]>([]); const [loading,setLoading] = useState(true); const [refreshing,setRefreshing] = useState(false); const [busyId,setBusyId] = useState<string|null>(null);
  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace('/login' as never); return; }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id',auth.user.id).single();
    if (profileError || profile?.role !== 'admin') { Alert.alert('Admin access required','This screen is available only to an administrator.'); router.replace('/(tabs)' as never); return; }
    const apps = await getPendingApplicationsForAdmin();
    const ids = [...new Set(apps.map((a:any)=>a.user_id))];
    const { data: profiles } = ids.length ? await supabase.from('profiles').select('id,full_name').in('id',ids) : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((p:any)=>[p.id,p.full_name]));
    const enriched = await Promise.all(apps.map(async (a:any) => {
      let receiptUrl: string | undefined;
      try { receiptUrl = await createReceiptSignedUrl(a.receipt_path); } catch {}
      return { ...a, name: profileMap.get(a.user_id) || 'Investor', receiptUrl } as PendingApp;
    }));
    setRows(enriched);
  },[]);
  useEffect(()=>{ load().catch(e=>Alert.alert('Could not load applications',e.message)).finally(()=>setLoading(false)); },[load]);
  const refresh = async()=>{setRefreshing(true); try{await load();}catch(e:any){Alert.alert('Refresh failed',e.message)}finally{setRefreshing(false)}};
  const decide = (row:PendingApp, decision:'approved'|'rejected') => Alert.alert(decision==='approved'?'Approve investment?':'Reject application?', decision==='approved'?`Approve ${usd(Number(row.amount))} for a 24-month term? This creates the investment and 24 monthly ROI records.`:'Reject this application and record the decision?', [{text:'Cancel',style:'cancel'},{text:decision==='approved'?'Approve':'Reject',style:decision==='rejected'?'destructive':'default',onPress:async()=>{setBusyId(row.id);try{await reviewApplication(row.id,decision);Alert.alert('Completed',decision==='approved'?'Investment activated and ROI schedule created.':'Application rejected.');await load();}catch(e:any){Alert.alert('Review failed',e.message||'Could not review application.')}finally{setBusyId(null)}}}]);
  return <View style={[styles.screen,{backgroundColor:C.bg}]}>
    <View style={[styles.header,{borderBottomColor:C.border}]}><TouchableOpacity onPress={()=>router.back()} style={[styles.back,{borderColor:C.border,backgroundColor:C.white}]}><Ionicons name="arrow-back" size={20} color={C.text}/></TouchableOpacity><View style={{flex:1}}><Text style={[styles.title,{color:C.text}]}>Investment approvals</Text><Text style={[styles.sub,{color:C.muted}]}>Review payment proof before activation</Text></View><TouchableOpacity onPress={refresh}><Ionicons name="refresh" size={21} color={C.blue}/></TouchableOpacity></View>
    {loading?<View style={styles.center}><ActivityIndicator size="large" color={C.blue}/></View>:<ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>{rows.length===0?<View style={[styles.empty,{backgroundColor:C.white,borderColor:C.border}]}><Ionicons name="checkmark-done-circle-outline" size={35} color={C.green}/><Text style={[styles.emptyTitle,{color:C.text}]}>No pending applications</Text><Text style={[styles.sub,{color:C.muted}]}>New applications awaiting review will appear here.</Text></View>:rows.map(row=><View key={row.id} style={[styles.card,{backgroundColor:C.white,borderColor:C.border}]}><View style={styles.row}><View style={{flex:1}}><Text style={[styles.amount,{color:C.text}]}>{usd(Number(row.amount))}</Text><Text style={[styles.sub,{color:C.muted}]}>{row.name} · submitted {new Date(row.submitted_at).toLocaleDateString()}</Text></View><View style={[styles.pill,{backgroundColor:C.amber+'22'}]}><Text style={{color:C.amber,fontSize:9,fontWeight:'900'}}>PENDING</Text></View></View><Text style={[styles.detail,{color:C.muted}]}>Term: 24 months · Monthly ROI: {usd(Number(row.amount)*0.025)}</Text>{row.transaction_reference?<Text style={[styles.detail,{color:C.text}]}>Reference: {row.transaction_reference}</Text>:null}{row.receiptUrl?<Image source={{uri:row.receiptUrl}} style={styles.receipt} resizeMode="contain"/>:<Text style={[styles.detail,{color:C.muted}]}>Receipt preview unavailable.</Text>}<View style={styles.actions}><TouchableOpacity disabled={busyId===row.id} onPress={()=>decide(row,'rejected')} style={[styles.action,{borderColor:C.red}]}><Text style={{color:C.red,fontWeight:'800'}}>Reject</Text></TouchableOpacity><TouchableOpacity disabled={busyId===row.id} onPress={()=>decide(row,'approved')} style={[styles.action,{backgroundColor:C.green,borderColor:C.green}]}><Text style={{color:'#fff',fontWeight:'800'}}>{busyId===row.id?'Processing…':'Approve & activate'}</Text></TouchableOpacity></View></View>)}</ScrollView>}
  </View>;
}
const styles=StyleSheet.create({screen:{flex:1},header:{paddingTop:58,paddingHorizontal:18,paddingBottom:14,borderBottomWidth:1,flexDirection:'row',alignItems:'center',gap:12},back:{width:42,height:42,borderRadius:13,borderWidth:1,alignItems:'center',justifyContent:'center'},title:{fontSize:20,fontWeight:'900'},sub:{fontSize:11,marginTop:4},content:{padding:16,gap:14,paddingBottom:40},center:{flex:1,alignItems:'center',justifyContent:'center'},empty:{borderWidth:1,borderRadius:16,padding:24,alignItems:'center',gap:9},emptyTitle:{fontSize:16,fontWeight:'800'},card:{borderWidth:1,borderRadius:17,padding:15,gap:10},row:{flexDirection:'row',alignItems:'center',gap:10},amount:{fontSize:22,fontWeight:'900'},pill:{paddingHorizontal:9,paddingVertical:6,borderRadius:20},detail:{fontSize:11,lineHeight:17},receipt:{width:'100%',height:230,borderRadius:10,backgroundColor:'#F4F5F7'},actions:{flexDirection:'row',gap:10,marginTop:4},action:{flex:1,minHeight:44,borderWidth:1,borderRadius:11,alignItems:'center',justifyContent:'center'}});
