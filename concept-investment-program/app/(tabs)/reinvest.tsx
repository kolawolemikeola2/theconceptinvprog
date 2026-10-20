import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getPalette, useAppTheme } from '../../constants/app-theme';

type EligibleROI = { id:string; period_month:number; due_date:string; amount:number; currency:string };
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);

export default function ReinvestScreen(){
  const {isDark}=useAppTheme(); const C=getPalette(isDark); const s=makeStyles(isDark);
  const [rows,setRows]=useState<EligibleROI[]>([]); const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false); const [busyId,setBusyId]=useState<string|null>(null);
  const load=useCallback(async()=>{
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||!user)throw new Error('Please sign in again.');
    const today=new Date().toISOString().slice(0,10);
    const {data:roi,error}=await supabase.from('roi_payments').select('id,period_month,due_date,amount,currency').eq('user_id',user.id).eq('status','pending').lte('due_date',today).order('due_date',{ascending:true});
    if(error)throw error;
    const ids=(roi||[]).map((r:any)=>r.id);
    if(!ids.length){setRows([]);return;}
    const {data:requests,error:requestError}=await supabase.from('reinvestment_requests').select('roi_payment_id,status').in('roi_payment_id',ids).in('status',['pending_review','approved','completed']);
    if(requestError)throw requestError;
    const alreadyRequested=new Set((requests||[]).map((r:any)=>r.roi_payment_id));
    setRows((roi||[]).filter((r:any)=>!alreadyRequested.has(r.id)) as EligibleROI[]);
  },[]);
  useEffect(()=>{load().catch((e:any)=>Alert.alert('Could not load eligible ROI',e.message)).finally(()=>setLoading(false));},[load]);
  const refresh=async()=>{setRefreshing(true);try{await load()}catch(e:any){Alert.alert('Refresh failed',e.message)}finally{setRefreshing(false)}};
  const requestReinvestment=(row:EligibleROI)=>Alert.alert('Request full ROI reinvestment?',`Request to reinvest ${money(Number(row.amount))} for month ${row.period_month}. The request is not complete until an administrator reviews it.`,[
    {text:'Cancel',style:'cancel'},{text:'Submit request',onPress:async()=>{setBusyId(row.id);try{
      const {data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)throw new Error('Please sign in again.');
      const {error}=await supabase.from('reinvestment_requests').insert({user_id:user.id,roi_payment_id:row.id,amount:Number(row.amount),currency:'USD',status:'pending_review'});
      if(error)throw error;
      Alert.alert('Request submitted','Your full-ROI reinvestment request has been sent to the administrator. Your ROI remains pending until review.');
      await load();
    }catch(e:any){Alert.alert('Could not submit request',e.message)}finally{setBusyId(null)}}}
  ]);
  return <View style={s.screen}>
    <View style={s.header}><TouchableOpacity style={s.back} onPress={()=>router.back()}><Ionicons name="arrow-back" size={20} color={C.text}/></TouchableOpacity><View style={{flex:1}}><Text style={s.eyebrow}>THE CONCEPT · INVESTOR PORTAL</Text><Text style={s.title}>Reinvest ROI</Text><Text style={s.sub}>Request reinvestment for ROI that is already due</Text></View></View>
    {loading?<View style={s.center}><ActivityIndicator size="large" color={C.blue}/></View>:<ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
      <View style={s.info}><Ionicons name="information-circle-outline" size={21} color={C.blue}/><Text style={s.infoText}>You choose whether to request reinvestment. Nothing is reinvested automatically. The administrator must approve your request before it is recorded.</Text></View>
      {rows.length===0?<View style={s.card}><Ionicons name="wallet-outline" size={30} color={C.muted}/><Text style={s.cardTitle}>No eligible ROI to reinvest</Text><Text style={s.sub}>Only pending ROI installments whose due date has arrived appear here. You can request reinvestment when one is eligible.</Text></View>:rows.map(row=><View key={row.id} style={s.card}><View style={s.rowBetween}><Text style={s.cardTitle}>Month {row.period_month} ROI</Text><View style={s.badge}><Text style={s.badgeText}>DUE</Text></View></View><Text style={s.amount}>{money(Number(row.amount))}</Text><Text style={s.sub}>Due date: {new Date(row.due_date+'T00:00:00').toLocaleDateString()}</Text><TouchableOpacity disabled={busyId===row.id} style={s.button} onPress={()=>requestReinvestment(row)}><Text style={s.buttonText}>{busyId===row.id?'Submitting…':'Request full ROI reinvestment'}</Text></TouchableOpacity></View>)}
    </ScrollView>}
  </View>;
}
const makeStyles=(dark:boolean)=>{const C=getPalette(dark);return StyleSheet.create({
 screen:{flex:1,backgroundColor:C.bg},header:{paddingTop:58,paddingHorizontal:18,paddingBottom:15,flexDirection:'row',alignItems:'center',gap:11,borderBottomWidth:1,borderBottomColor:C.border},back:{width:40,height:40,borderRadius:12,backgroundColor:C.white,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:8,color:C.blue,fontWeight:'900',letterSpacing:1},title:{fontSize:22,color:C.text,fontWeight:'900'},sub:{fontSize:10,color:C.muted,lineHeight:15,marginTop:4},content:{padding:16,gap:12,paddingBottom:40},center:{flex:1,alignItems:'center',justifyContent:'center'},info:{flexDirection:'row',gap:9,backgroundColor:C.blueLight,padding:12,borderRadius:12,alignItems:'flex-start'},infoText:{flex:1,color:C.softText,fontSize:10,lineHeight:15},card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:16,padding:16,gap:10},cardTitle:{fontSize:14,fontWeight:'900',color:C.text},amount:{fontSize:26,fontWeight:'900',color:C.text},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},badge:{backgroundColor:C.amberLight,borderRadius:20,paddingHorizontal:9,paddingVertical:5},badgeText:{color:C.amber,fontSize:9,fontWeight:'900'},button:{minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:11,backgroundColor:C.blue,paddingHorizontal:12},buttonText:{fontSize:11,fontWeight:'900',color:'#fff'},
});};
