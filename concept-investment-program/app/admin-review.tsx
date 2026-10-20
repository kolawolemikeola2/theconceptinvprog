import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { createReceiptSignedUrl, getPendingApplicationsForAdmin, reviewApplication } from '../services/investments';
import { getPalette, useAppTheme } from '../constants/app-theme';

type Tab = 'Overview' | 'Users' | 'Applications' | 'ROI' | 'Bank' | 'Notifications' | 'Support';
type UserRow = { id:string; email?:string; created_at:string; last_sign_in_at?:string; profile:any; investments:any[]; applications:any[] };
type AppRow = { id:string; user_id:string; amount:number; currency:string; monthly_roi_rate:number; transaction_reference:string|null; receipt_path:string; submitted_at:string; status:string; name?:string; email?:string; receiptUrl?:string };
type RoiRow = { id:string; user_id:string; investment_id:string; period_month:number; due_date:string; amount:number; status:string; paid_at?:string|null; payout_reference?:string|null; name?:string; email?:string };
type ReinvestmentRow = { id:string; user_id:string; roi_payment_id:string; amount:number; status:string; created_at:string; admin_notes?:string|null; name?:string; email?:string; period_month?:number; due_date?:string };
const usd = (value:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));
const tabs:Tab[]=['Overview','Users','Applications','ROI','Bank','Notifications','Support'];

async function exportWorkbook(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, Math.min(32, header.length + 4)) }));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  const uri = `${FileSystem.cacheDirectory || ''}${filename}-${new Date().toISOString().slice(0,10)}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Export Excel workbook',
  });
  else Alert.alert('Export created', `Excel file saved at ${uri}`);
}

export default function AdminReviewScreen() {
  const { isDark } = useAppTheme(); const C = getPalette(isDark); const s = makeStyles(isDark);
  const [tab,setTab]=useState<Tab>('Overview');
  const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false);
  const [users,setUsers]=useState<UserRow[]>([]); const [apps,setApps]=useState<AppRow[]>([]); const [roi,setRoi]=useState<RoiRow[]>([]); const [reinvestmentRequests,setReinvestmentRequests]=useState<ReinvestmentRow[]>([]);
  const [bankId,setBankId]=useState<string|null>(null); const [bankName,setBankName]=useState(''); const [accountName,setAccountName]=useState(''); const [accountNumber,setAccountNumber]=useState(''); const [instructions,setInstructions]=useState('');
  const [search,setSearch]=useState(''); const [busy,setBusy]=useState(false);
  const [pushTitle,setPushTitle]=useState(''); const [pushBody,setPushBody]=useState(''); const [pushUserId,setPushUserId]=useState('');
  const [recipientPickerVisible,setRecipientPickerVisible]=useState(false); const [recipientSearch,setRecipientSearch]=useState('');
  const [reference,setReference]=useState(''); const [roiNotes,setRoiNotes]=useState('');
  const [currentAdmin,setCurrentAdmin]=useState('');
  const [supportConversations,setSupportConversations]=useState<any[]>([]);
  const [selectedConversation,setSelectedConversation]=useState<any>(null);
  const [supportMessages,setSupportMessages]=useState<any[]>([]);
  const [replyText,setReplyText]=useState('');
  const [supportLoading,setSupportLoading]=useState(false);

  const load=useCallback(async()=>{
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||!user){router.replace('/(auth)/login' as never);return;}
    const {data:me,error:roleError}=await supabase.from('profiles').select('role').eq('id',user.id).single();
    if(roleError||me?.role!=='admin'){Alert.alert('Admin access required','This portal is restricted to authorized administrators.');router.replace('/(tabs)' as never);return;}
    setCurrentAdmin(user.id);
    const [userResult,appResult,roiResult,bankResult,reinvestResult]=await Promise.all([
      supabase.functions.invoke('admin-management',{body:{action:'list_users'}}),
      getPendingApplicationsForAdmin(),
      supabase.from('roi_payments').select('id,user_id,investment_id,period_month,due_date,amount,status,paid_at,payout_reference').in('status',['pending','paid','reinvested']).order('due_date',{ascending:true}),
      supabase.from('payment_accounts').select('id,bank_name,account_name,account_number,payment_instructions,is_active').order('created_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('reinvestment_requests').select('id,user_id,roi_payment_id,amount,status,created_at,admin_notes').eq('status','pending_review').order('created_at',{ascending:true})
    ]);
    if(userResult.error) throw new Error(`Could not load users. Deploy supabase/functions/admin-management first. ${userResult.error.message}`);
    const fetchedUsers=(userResult.data?.users||[]) as UserRow[];
    setUsers(fetchedUsers);
    if(appResult.length){
      const ids=[...new Set(appResult.map((a:any)=>a.user_id))];
      const profiles=await supabase.from('profiles').select('id,full_name').in('id',ids);
      const userMap=new Map((userResult.data?.users||[]).map((u:any)=>[u.id,u.email]));
      const names=new Map((profiles.data||[]).map((p:any)=>[p.id,p.full_name]));
      const enriched=await Promise.all(appResult.map(async(a:any)=>{let receiptUrl:string|undefined;try{receiptUrl=await createReceiptSignedUrl(a.receipt_path)}catch{};return {...a,name:names.get(a.user_id)||'Investor',email:userMap.get(a.user_id),receiptUrl} as AppRow}));
      setApps(enriched);
    } else setApps([]);
    if(roiResult.error) throw roiResult.error;
    if(reinvestResult.error) throw reinvestResult.error;
    const roiRows=(roiResult.data||[]) as RoiRow[];
    const p=await supabase.from('profiles').select('id,full_name').in('id',[...new Set(roiRows.map(r=>r.user_id))].length?[...new Set(roiRows.map(r=>r.user_id))]:['00000000-0000-0000-0000-000000000000']);
    const userMap=new Map<string,string|undefined>(fetchedUsers.map((u):[string,string|undefined]=>[u.id,u.email]));
    const names=new Map<string,string>((p.data||[]).map((x:any):[string,string]=>[x.id,x.full_name]));
    setRoi(roiRows.map(r=>({...r,name:names.get(r.user_id)||'Investor',email:userMap.get(r.user_id)})));
    const requestRows=(reinvestResult.data||[]) as ReinvestmentRow[];
    const roiById=new Map(roiRows.map((r):[string,RoiRow]=>[r.id,r]));
    setReinvestmentRequests(requestRows.map(r=>({...r,name:names.get(r.user_id)||'Investor',email:userMap.get(r.user_id),period_month:roiById.get(r.roi_payment_id)?.period_month,due_date:roiById.get(r.roi_payment_id)?.due_date})));
    if(bankResult.error) throw bankResult.error;
    if(bankResult.data){setBankId(bankResult.data.id);setBankName(bankResult.data.bank_name||'');setAccountName(bankResult.data.account_name||'');setAccountNumber(bankResult.data.account_number||'');setInstructions(bankResult.data.payment_instructions||'');}
  },[]);
  useEffect(()=>{load().catch((e:any)=>Alert.alert('Admin portal error',e?.message||'Could not load admin data.')).finally(()=>setLoading(false));},[load]);
  const refresh=async()=>{setRefreshing(true);try{await load()}catch(e:any){Alert.alert('Refresh failed',e.message)}finally{setRefreshing(false)}};
  const invoke=async(action:string,body:any)=>{const {data,error}=await supabase.functions.invoke('admin-management',{body:{action,...body}});if(error)throw error;if(data?.error)throw new Error(data.error);return data};
  const supportAction=async(action:string,extra:any={})=>{
    const {data,error}=await supabase.functions.invoke('support-chat',{body:{action,...extra}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    return data;
  };
  const loadSupportConversations=async()=>{
    setSupportLoading(true);
    try{
      const data=await supportAction('list_conversations');
      setSupportConversations(data.conversations||[]);
    }catch(e:any){Alert.alert('Support inbox error',e?.message||'Could not load complaints.');}
    finally{setSupportLoading(false);}
  };
  const openSupportConversation=async(conversation:any)=>{
    setSupportLoading(true);
    try{
      setSelectedConversation(conversation);
      const data=await supportAction('get_messages',{conversationId:conversation.id});
      setSupportMessages(data.messages||[]);
      await supportAction('mark_read',{conversationId:conversation.id});
    }catch(e:any){Alert.alert('Could not open conversation',e?.message||'Please try again.');}
    finally{setSupportLoading(false);}
  };
  const sendSupportReply=async()=>{
    if(!selectedConversation||!replyText.trim()) return;
    setSupportLoading(true);
    try{
      await supportAction('send_message',{conversationId:selectedConversation.id,message:replyText.trim()});
      setReplyText('');
      const data=await supportAction('get_messages',{conversationId:selectedConversation.id});
      setSupportMessages(data.messages||[]);
      await loadSupportConversations();
      Alert.alert('Reply sent','Your reply was submitted. Push delivery depends on the deployed support-chat function and device configuration.');
    }catch(e:any){Alert.alert('Reply failed',e?.message||'Please try again.');}
    finally{setSupportLoading(false);}
  };
  const resolveSupportConversation=()=>{
    if(!selectedConversation) return;
    Alert.alert('Resolve complaint?','This will mark the conversation as resolved.',[
      {text:'Cancel',style:'cancel'},
      {text:'Resolve',onPress:async()=>{
        setSupportLoading(true);
        try{
          await supportAction('update_status',{conversationId:selectedConversation.id,status:'resolved'});
          setSelectedConversation({...selectedConversation,status:'resolved'});
          await loadSupportConversations();
          Alert.alert('Completed','Complaint marked as resolved.');
        }catch(e:any){Alert.alert('Could not resolve complaint',e?.message||'Please try again.');}
        finally{setSupportLoading(false);}
      }}
    ]);
  };
  useEffect(()=>{if(tab==='Support') loadSupportConversations();},[tab]);

  const filteredUsers=useMemo(()=>users.filter(u=>`${u.email||''} ${u.profile?.full_name||''} ${u.profile?.phone||''} ${u.id}`.toLowerCase().includes(search.toLowerCase())),[users,search]);
  const activeUsers=users.filter(u=>u.profile?.account_status!=='suspended');
  const totalPrincipal=users.reduce((sum,u)=>sum+u.investments.filter((i:any)=>i.status==='active').reduce((a:number,i:any)=>a+Number(i.principal||0),0),0);
  const dueRoi=roi.filter(r=>r.status==='pending'&&r.due_date<=new Date().toISOString().slice(0,10));
  const pendingRoi=roi.filter(r=>r.status==='pending');
  const exportUsers = () => exportWorkbook('concept-investment-users','Users',
    ['Name','Email','Phone','Role','Account status','Registered','Active principal USD','Applications'],
    filteredUsers.map(u=>[u.profile?.full_name||'',u.email||'',u.profile?.phone||'',u.profile?.role||'investor',u.profile?.account_status||'active',u.created_at,u.investments.filter((i:any)=>i.status==='active').reduce((n:number,i:any)=>n+Number(i.principal||0),0),u.applications.length]));
  const exportApplications = () => exportWorkbook('concept-investment-applications','Applications',
    ['Application ID','Investor name','Email','User ID','Amount USD','Status','Submitted','Transaction reference'],
    apps.map(a=>[a.id,a.name||'',a.email||'',a.user_id,a.amount,a.status,a.submitted_at,a.transaction_reference||'']));
  const exportRoi = () => exportWorkbook('concept-investment-roi','ROI Ledger',
    ['ROI ID','Investor name','Email','User ID','Investment ID','Period month','Due date','Amount USD','Status','Paid at','Payout reference'],
    roi.map(r=>[r.id,r.name||'',r.email||'',r.user_id,r.investment_id,r.period_month,r.due_date,r.amount,r.status,r.paid_at||'',r.payout_reference||'']));
  const setSuspension=(u:UserRow,suspended:boolean)=>Alert.alert(suspended?'Suspend account?':'Restore account?',suspended?`This blocks ${u.email||'this user'} from signing in until restored.`:'This user will be allowed to sign in again.',[
    {text:'Cancel',style:'cancel'},{text:suspended?'Suspend':'Restore',style:suspended?'destructive':'default',onPress:async()=>{setBusy(true);try{await invoke('set_suspension',{userId:u.id,suspended,reason:suspended?'Suspended by administrator':''});Alert.alert('Updated',suspended?'Account suspended.':'Account restored.');await load()}catch(e:any){Alert.alert('Could not update account',e.message)}finally{setBusy(false)}}}
  ]);
  const saveBank=async()=>{
    if(!bankName.trim()||!accountName.trim()||!accountNumber.trim()){Alert.alert('Missing details','Enter the bank name, account name and account number.');return}
    setBusy(true);try{
      const {data:{user}}=await supabase.auth.getUser();
      if(bankId){
        const {error}=await supabase.from('payment_accounts').update({bank_name:bankName.trim(),account_name:accountName.trim(),account_number:accountNumber.trim(),payment_instructions:instructions.trim(),is_active:true,updated_at:new Date().toISOString()}).eq('id',bankId);if(error)throw error;
      }else{
        const {data,error}=await supabase.from('payment_accounts').insert({bank_name:bankName.trim(),account_name:accountName.trim(),account_number:accountNumber.trim(),currency:'USD',payment_instructions:instructions.trim(),is_active:true}).select('id').single();if(error)throw error;setBankId(data.id);
      }
      await supabase.from('admin_audit_log').insert({admin_id:user?.id,action:'payment_account_updated',entity_type:'payment_account',entity_id:bankId,details:{bank_name:bankName,account_name:accountName,account_number:'[updated]'}});
      Alert.alert('Saved','Company payment details are now available to investors.');await load();
    }catch(e:any){Alert.alert('Could not save bank details',e.message)}finally{setBusy(false)}
  };
  const review=(row:AppRow,decision:'approved'|'rejected')=>Alert.alert(decision==='approved'?'Approve and activate?':'Reject application?',`${usd(Number(row.amount))} · ${row.email||row.name}\n${decision==='approved'?'This creates the 24-month investment and ROI schedule.':'The application will be marked rejected.'}`,[{text:'Cancel',style:'cancel'},{text:decision==='approved'?'Approve':'Reject',style:decision==='rejected'?'destructive':'default',onPress:async()=>{setBusy(true);try{await reviewApplication(row.id,decision);Alert.alert('Completed',decision==='approved'?'Investment activated and ROI schedule created.':'Application rejected.');await load()}catch(e:any){Alert.alert('Review failed',e.message)}finally{setBusy(false)}}}]);
  const payout=(row:RoiRow,reinvest:boolean)=>{if(reinvest&&!roiNotes.trim()){Alert.alert('Confirm investor consent','Enter a note confirming the investor explicitly requested reinvestment before recording it.');return;}Alert.alert(reinvest?'Record ROI reinvestment?':'Record ROI payout?',`${usd(Number(row.amount))} for month ${row.period_month}, due ${row.due_date}.\n\nOnly record a payout after the transfer is confirmed. Reinvestment must reflect the investor's consent.`,[{text:'Cancel',style:'cancel'},{text:reinvest?'Record reinvestment':'Mark as paid',onPress:async()=>{setBusy(true);try{const {data,error}=await supabase.rpc(reinvest?'admin_record_roi_reinvestment':'admin_record_roi_payout',reinvest?{p_roi_id:row.id,p_notes:roiNotes}:{p_roi_id:row.id,p_reference:reference||null,p_notes:roiNotes||null});if(error)throw error;setReference('');setRoiNotes('');Alert.alert('Recorded',reinvest?'ROI marked as reinvested.':'ROI payout recorded.');await load()}catch(e:any){Alert.alert('ROI update failed',e.message)}finally{setBusy(false)}}}]);};
  const reviewReinvestment=(row:ReinvestmentRow,decision:'approved'|'rejected')=>Alert.alert(decision==='approved'?'Approve reinvestment?':'Reject reinvestment?',`${row.name||'Investor'} · ${usd(Number(row.amount))} · ${row.due_date||'ROI due date'}`,[
    {text:'Cancel',style:'cancel'},{text:decision==='approved'?'Approve':'Reject',style:decision==='rejected'?'destructive':'default',onPress:async()=>{setBusy(true);try{const {error}=await supabase.rpc('admin_review_reinvestment_request',{p_request_id:row.id,p_decision:decision,p_admin_notes:roiNotes||null});if(error)throw error;setRoiNotes('');Alert.alert('Updated',decision==='approved'?'Reinvestment approved and ROI recorded.':'Reinvestment request rejected.');await load()}catch(e:any){Alert.alert('Could not review request',e.message)}finally{setBusy(false)}}}
  ]);
  const sendPush=async()=>{
    if(!pushTitle.trim()||!pushBody.trim()){Alert.alert('Missing message','Enter a notification title and message.');return}
    if(pushUserId && !users.some(u=>u.id===pushUserId)){Alert.alert('Invalid recipient','Choose a user from the recipient list, or select All investors.');return}
    setBusy(true);
    try{
      const data=await invoke('send_push',{title:pushTitle.trim(),message:pushBody.trim(),userId:pushUserId||null});
      const accepted=Number(data.pushMessagesAcceptedByExpo ?? data.pushMessagesAttempted ?? 0);
      const rejected=Number(data.pushMessagesRejectedByExpo ?? 0);
      const tokens=Number(data.registeredDeviceTokens ?? data.pushMessagesAttempted ?? 0);
      const recipients=Number(data.inAppRecipients ?? 0);
      const errors=Array.isArray(data.errors)?data.errors:[];
      let summary=`In-app notifications saved for ${recipients} user(s).\\nRegistered device tokens: ${tokens}.\\nAccepted by Expo: ${accepted}.\\nRejected by Expo: ${rejected}.`;
      if(tokens===0) summary+='\\n\\nNo registered push tokens were found. In-app notices may still be saved; push cannot reach devices until tokens are registered.';
      if(errors.length) summary+='\\n\\nPush errors:\\n'+errors.slice(0,4).join('\\n');
      Alert.alert(recipients===0?'No recipients notified':'Notification result',summary);
      if(recipients>0){setPushTitle('');setPushBody('');}
    }catch(e:any){Alert.alert('Notification failed',e?.message||'The server could not process this notification.')}finally{setBusy(false)}
  };
  const recipientLabel = pushUserId ? (()=>{const u=users.find(item=>item.id===pushUserId);return u ? `${u.profile?.full_name||'Investor'} · ${u.email||u.id}` : 'Choose a user';})() : 'All investors (broadcast)';
  const filteredRecipients = users.filter(u=>u.profile?.role!=='admin' && `${u.profile?.full_name||''} ${u.email||''} ${u.profile?.phone||''} ${u.id}`.toLowerCase().includes(recipientSearch.toLowerCase()));
  const metric=(label:string,value:string,icon:any)=><View style={s.metric}><Ionicons name={icon} size={19} color={C.blue}/><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{value}</Text></View>;
  const input=(label:string,value:string,onChange:(v:string)=>void,placeholder:string,multiline=false)=><View style={s.inputWrap}><Text style={s.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted} multiline={multiline} style={[s.input,multiline&&{minHeight:85,textAlignVertical:'top'}]}/></View>;
  const button=(label:string,onPress:()=>void,secondary=false)=><TouchableOpacity disabled={busy} onPress={onPress} style={[s.button,secondary&&s.secondaryButton]}><Text style={[s.buttonText,secondary&&{color:C.text}]}>{busy?'Please wait…':label}</Text></TouchableOpacity>;

  return <View style={s.screen}>
    <View style={s.header}><TouchableOpacity onPress={()=>router.back()} style={s.iconButton}><Ionicons name="arrow-back" size={20} color={C.text}/></TouchableOpacity><View style={{flex:1}}><Text style={s.eyebrow}>THE CONCEPT · MANAGEMENT</Text><Text style={s.title}>Admin portal</Text><Text style={s.subtitle}>Investors, payments and operations</Text></View><TouchableOpacity onPress={refresh} style={s.iconButton}><Ionicons name="refresh" size={19} color={C.blue}/></TouchableOpacity></View>
    <View style={s.navShell}>
      <View style={s.tabs}>
        {tabs.map(t=>{
          const iconName = ({Overview:'grid-outline',Users:'people-outline',Applications:'document-text-outline',ROI:'wallet-outline',Bank:'business-outline',Notifications:'notifications-outline',Support:'chatbubbles-outline'} as const)[t];
          const selected = tab===t;
          return <TouchableOpacity key={t} onPress={()=>setTab(t)} activeOpacity={0.8} accessibilityRole="tab" accessibilityState={{selected}} style={[s.tab,selected&&s.tabActive]}>
            <Ionicons name={iconName as any} size={16} color={selected?'#FFFFFF':C.muted}/>
            <Text numberOfLines={1} style={[s.tabText,selected&&s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>;
        })}
      </View>
    </View>
    {loading?<View style={s.center}><ActivityIndicator size="large" color={C.blue}/></View>:<ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
      {tab==='Overview'&&<><Text style={s.sectionTitle}>Operations overview</Text><View style={s.metrics}>{metric('TOTAL USERS',String(users.length),'people-outline')}{metric('ACTIVE USERS',String(activeUsers.length),'person-circle-outline')}</View><View style={s.metrics}>{metric('ACTIVE PRINCIPAL',usd(totalPrincipal),'wallet-outline')}{metric('PENDING APPLICATIONS',String(apps.length),'time-outline')}</View><View style={s.metrics}>{metric('ROI DUE NOW',String(dueRoi.length),'cash-outline')}{metric('ROI AWAITING DUE DATE',String(pendingRoi.length-dueRoi.length),'calendar-outline')}</View><View style={s.card}><Text style={s.cardTitle}>Quick actions</Text>{button('Manage users',()=>setTab('Users'))}{button('Review applications',()=>setTab('Applications'),true)}{button('Process ROI due',()=>setTab('ROI'),true)}{button('Update company bank account',()=>setTab('Bank'),true)}</View><Text style={s.note}>ROI payout approval records an administrator-confirmed transaction; it does not send money to a bank account.</Text></>}
      {tab==='Users'&&<><Text style={s.sectionTitle}>Investor directory</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search name, email, phone or user ID" placeholderTextColor={C.muted} style={s.input}/>{button('Export filtered users to Excel (.xlsx)',exportUsers,true)}<Text style={s.note}>Downloads a real .xlsx workbook. User emails are retrieved securely through the admin-management Edge Function.</Text>{filteredUsers.map(u=><View key={u.id} style={s.card}><View style={s.rowBetween}><View style={{flex:1}}><Text style={s.cardTitle}>{u.profile?.full_name||'Investor'}</Text><Text style={s.sub}>{u.email||'No email'} · {u.profile?.phone||'No phone'}</Text></View><View style={[s.badge,{backgroundColor:u.profile?.account_status==='suspended'?C.red+'22':C.greenLight}]}><Text style={{fontSize:9,fontWeight:'900',color:u.profile?.account_status==='suspended'?C.red:C.green}}>{(u.profile?.account_status||'active').toUpperCase()}</Text></View></View><Text style={s.sub}>Registered: {new Date(u.created_at).toLocaleDateString()} · Investments: {u.investments.length} · Applications: {u.applications.length}</Text><Text style={s.sub}>User ID: {u.id}</Text><Text style={s.sub}>Active principal: {usd(u.investments.filter((i:any)=>i.status==='active').reduce((n:number,i:any)=>n+Number(i.principal||0),0))}</Text>{u.applications.slice(0,4).map((a:any,index:number)=><Text key={`${a.status}-${index}`} style={s.sub}>Application: {a.status} · {usd(Number(a.amount))} · {a.submitted_at?new Date(a.submitted_at).toLocaleDateString():'—'}</Text>)}{u.investments.slice(0,4).map((i:any,index:number)=><Text key={`${i.status}-${index}`} style={s.sub}>Investment: {i.status} · {usd(Number(i.principal))}</Text>)}{u.profile?.role!=='admin'&&<View style={s.row}>{button(u.profile?.account_status==='suspended'?'Restore login':'Suspend login',()=>setSuspension(u,u.profile?.account_status!=='suspended'),u.profile?.account_status!=='suspended')}</View>}</View>)}</>}
      {tab==='Applications'&&<><Text style={s.sectionTitle}>Pending investment applications</Text>{button('Export applications to Excel (.xlsx)',exportApplications,true)}{apps.length===0?<View style={s.card}><Text style={s.cardTitle}>No pending applications</Text><Text style={s.sub}>New submissions appear here after receipt upload.</Text></View>:apps.map(row=><View key={row.id} style={s.card}><Text style={s.amount}>{usd(Number(row.amount))}</Text><Text style={s.sub}>{row.name} · {row.email||row.user_id}</Text><Text style={s.sub}>2.5% monthly ROI: {usd(Number(row.amount)*0.025)} · submitted {new Date(row.submitted_at).toLocaleDateString()}</Text>{row.transaction_reference&&<Text style={s.sub}>Reference: {row.transaction_reference}</Text>}{row.receiptUrl?<Image source={{uri:row.receiptUrl}} style={s.receipt} resizeMode="contain"/>:<Text style={s.sub}>Receipt preview unavailable.</Text>}<View style={s.row}>{button('Reject',()=>review(row,'rejected'),true)}{button('Approve & activate',()=>review(row,'approved'))}</View></View>)}</>}
      {tab==='ROI'&&<><Text style={s.sectionTitle}>ROI due dates and payouts</Text>{button('Export ROI ledger to Excel (.xlsx)',exportRoi,true)}<Text style={s.note}>Only ROI entries with a due date today or earlier can be processed by the backend. Confirm the investor's choice before recording cash payout or reinvestment.</Text>{input('Payment reference (cash payout)','',setReference,'Bank transfer reference')}{input('Admin notes','',setRoiNotes,'Payout notes / reason for request decision',true)}
      <Text style={s.cardTitle}>Pending reinvestment requests ({reinvestmentRequests.length})</Text>
      {reinvestmentRequests.map(request=><View key={request.id} style={s.card}><Text style={s.cardTitle}>{usd(Number(request.amount))} · {request.name||'Investor'}</Text><Text style={s.sub}>{request.email||request.user_id} · Month {request.period_month??'—'} · due {request.due_date||'—'}</Text><Text style={s.sub}>Requested {new Date(request.created_at).toLocaleDateString()}</Text><View style={s.row}>{button('Reject request',()=>reviewReinvestment(request,'rejected'),true)}{button('Approve reinvestment',()=>reviewReinvestment(request,'approved'))}</View></View>)}
      {roi.map(row=><View key={row.id} style={s.card}><View style={s.rowBetween}><Text style={s.cardTitle}>{usd(Number(row.amount))}</Text><View style={[s.badge,{backgroundColor:row.status==='paid'?C.greenLight:row.status==='reinvested'?C.blueLight:row.due_date<=new Date().toISOString().slice(0,10)?C.amberLight:C.soft}]}><Text style={{fontSize:8,fontWeight:'900',color:row.status==='paid'?C.green:row.status==='reinvested'?C.blue:C.amber}}>{row.status==='pending'&&row.due_date<=new Date().toISOString().slice(0,10)?'DUE':row.status.toUpperCase()}</Text></View></View><Text style={s.sub}>{row.name||'Investor'} · {row.email||row.user_id}</Text><Text style={s.sub}>Month {row.period_month} · due {row.due_date}</Text>{row.paid_at&&<Text style={s.sub}>Paid: {new Date(row.paid_at).toLocaleDateString()} {row.payout_reference?`· Ref: ${row.payout_reference}`:''}</Text>}{row.status==='pending'&&row.due_date<=new Date().toISOString().slice(0,10)&&<View style={s.row}>{button('Record confirmed cash payout',()=>payout(row,false))}</View>}</View>)}</>}
      {tab==='Bank'&&<><Text style={s.sectionTitle}>Company payment account</Text><Text style={s.note}>Investors retrieve these details from Supabase on the payment step. Verify the account details before saving. Currency is USD.</Text>{input('Bank name',bankName,setBankName,'Bank / payment provider')}{input('Account name',accountName,setAccountName,'Registered account name')}{input('Account number',accountNumber,setAccountNumber,'Account number')}{input('Payment instructions',instructions,setInstructions,'Transfer instructions, memo, reference',true)}{button(bankId?'Save bank account changes':'Add company bank account',saveBank)}<View style={s.card}><Text style={s.cardTitle}>Current details preview</Text><Text style={s.sub}>{bankName||'Bank name not set'}</Text><Text style={s.sub}>{accountName||'Account name not set'}</Text><Text style={s.amount}>{accountNumber||'Account number not set'}</Text><Text style={s.sub}>{instructions||'No extra instructions'}</Text></View></>}
      {tab==='Support'&&<>
        <Text style={s.sectionTitle}>Investor Support Inbox</Text>
        <Text style={s.note}>Review investor complaints and reply here. Replies use the support-chat Edge Function; actual push delivery also depends on registered device tokens and Expo push configuration.</Text>
        {button('Refresh complaints',loadSupportConversations,true)}
        {selectedConversation ? <View style={s.card}>
          <Text style={s.cardTitle}>{selectedConversation.subject||selectedConversation.title||'Investor complaint'}</Text>
          <Text style={s.sub}>Status: {(selectedConversation.status||'open').toUpperCase()}</Text>
          {button('Back to inbox',()=>{setSelectedConversation(null);setSupportMessages([]);},true)}
          {supportLoading&&<ActivityIndicator color={C.blue}/>}
          <ScrollView style={{maxHeight:360}} nestedScrollEnabled>
            {supportMessages.map((message:any)=><View key={message.id} style={[s.card,{backgroundColor:message.sender_id===currentAdmin?C.blueLight:C.white}]}>
              <Text style={s.sub}>{message.sender_id===currentAdmin?'You · Admin':'Investor'}</Text>
              <Text style={{color:C.text,fontSize:12,lineHeight:18}}>{message.message||message.content||''}</Text>
              {!!message.created_at&&<Text style={s.sub}>{new Date(message.created_at).toLocaleString()}</Text>}
            </View>)}
          </ScrollView>
          {selectedConversation.status!=='resolved' ? <>
            {input('Reply to investor',replyText,setReplyText,'Type your reply...',true)}
            {button('Send reply',sendSupportReply)}
            {button('Resolve complaint',resolveSupportConversation,true)}
          </> : <Text style={s.note}>This conversation is resolved.</Text>}
        </View> : supportLoading ? <View style={s.center}><ActivityIndicator size="large" color={C.blue}/></View> : supportConversations.length===0 ? <View style={s.card}><Text style={s.cardTitle}>No complaints found</Text><Text style={s.sub}>Pull to refresh or tap Refresh complaints when a new support request arrives.</Text></View> : supportConversations.map((conversation:any)=><TouchableOpacity key={conversation.id} activeOpacity={0.8} style={s.card} onPress={()=>openSupportConversation(conversation)}>
          <View style={s.rowBetween}><Text style={s.cardTitle}>{conversation.subject||conversation.title||'Investor complaint'}</Text><View style={s.badge}><Text style={{fontSize:9,fontWeight:'900',color:C.blue}}>{(conversation.status||'open').toUpperCase()}</Text></View></View>
          <Text style={s.sub}>Investor ID: {conversation.user_id||conversation.investor_id||'—'}</Text>
          {!!conversation.updated_at&&<Text style={s.sub}>Updated {new Date(conversation.updated_at).toLocaleString()}</Text>}
          <Text style={{color:C.blue,fontSize:11,fontWeight:'900'}}>Open conversation →</Text>
        </TouchableOpacity>)}
      </>}
      {tab==='Notifications'&&<>
        <Text style={s.sectionTitle}>Send notifications</Text>
        <Text style={s.note}>Choose All investors to broadcast or select one user from your registered user directory. Notifications are saved in-app; push delivery is reported separately by Expo.</Text>
        <View style={s.inputWrap}>
          <Text style={s.inputLabel}>Recipient</Text>
          <TouchableOpacity onPress={()=>{setRecipientSearch('');setRecipientPickerVisible(true)}} style={[s.input,{minHeight:48,justifyContent:'center'}]}>
            <Text numberOfLines={2} style={{color:C.text,fontSize:12}}>{recipientLabel}</Text>
            <Text style={{position:'absolute',right:12,color:C.blue,fontWeight:'900'}}>⌄</Text>
          </TouchableOpacity>
        </View>
        {input('Notification title',pushTitle,setPushTitle,'e.g. Your ROI is due')}
        {input('Message',pushBody,setPushBody,'Write the notification message',true)}
        {button('Send notification',sendPush)}
        <Text style={s.note}>If Expo reports zero registered device tokens, the app can still save in-app notices but cannot deliver phone push notifications to those users. Test on a physical device with notification permission enabled.</Text>
      </>}
    </ScrollView>}
    <Modal visible={recipientPickerVisible} transparent animationType="slide" onRequestClose={()=>setRecipientPickerVisible(false)}>
      <View style={s.pickerBackdrop}>
        <View style={[s.pickerPanel,{backgroundColor:C.bg,borderColor:C.border}]}>
          <View style={s.rowBetween}>
            <Text style={s.sectionTitle}>Choose recipient</Text>
            <TouchableOpacity onPress={()=>setRecipientPickerVisible(false)} style={s.iconButton}>
              <Ionicons name="close" size={20} color={C.text}/>
            </TouchableOpacity>
          </View>
          <TextInput value={recipientSearch} onChangeText={setRecipientSearch} placeholder="Search name, email or phone" placeholderTextColor={C.muted} style={s.input}/>
          <TouchableOpacity onPress={()=>{setPushUserId('');setRecipientPickerVisible(false)}} style={[s.recipientOption,{backgroundColor:!pushUserId?C.blueLight:C.white,borderColor:C.border}]}>
            <Ionicons name="people-outline" size={20} color={C.blue}/>
            <View style={{flex:1}}><Text style={s.cardTitle}>All investors</Text><Text style={s.sub}>Broadcast to all non-admin users</Text></View>
            {!pushUserId&&<Ionicons name="checkmark-circle" size={20} color={C.blue}/>}
          </TouchableOpacity>
          <FlatList
            data={filteredRecipients}
            keyExtractor={item=>item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{gap:8,paddingBottom:16}}
            ListEmptyComponent={<Text style={s.note}>No matching users found.</Text>}
            renderItem={({item})=><TouchableOpacity onPress={()=>{setPushUserId(item.id);setRecipientPickerVisible(false)}} style={[s.recipientOption,{backgroundColor:pushUserId===item.id?C.blueLight:C.white,borderColor:C.border}]}>
              <Ionicons name="person-circle-outline" size={22} color={C.blue}/>
              <View style={{flex:1,gap:3}}>
                <Text style={s.cardTitle}>{item.profile?.full_name||'Investor'}</Text>
                <Text style={s.sub}>{item.email||'No email'}{item.profile?.phone?` · ${item.profile.phone}`:''}</Text>
                <Text style={s.sub}>ID: {item.id}</Text>
              </View>
              {pushUserId===item.id&&<Ionicons name="checkmark-circle" size={20} color={C.blue}/>}
            </TouchableOpacity>}
          />
        </View>
      </View>
    </Modal>
  </View>;
}
const makeStyles=(dark:boolean)=>{const C=getPalette(dark);return StyleSheet.create({
 screen:{flex:1,backgroundColor:C.bg},pickerBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.45)',justifyContent:'flex-end'},pickerPanel:{height:'82%',borderTopLeftRadius:22,borderTopRightRadius:22,borderWidth:1,padding:16,gap:12},recipientOption:{borderWidth:1,borderRadius:13,padding:12,flexDirection:'row',alignItems:'center',gap:10},header:{paddingTop:56,paddingHorizontal:16,paddingBottom:12,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.bg},iconButton:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:C.white,borderWidth:1,borderColor:C.border},eyebrow:{fontSize:8,color:C.blue,fontWeight:'900',letterSpacing:1},title:{fontSize:22,color:C.text,fontWeight:'900'},subtitle:{fontSize:10,color:C.muted,marginTop:3},navShell:{height:154,flexGrow:0,flexShrink:0,backgroundColor:C.bg,borderBottomWidth:1,borderBottomColor:C.border,paddingHorizontal:10,paddingVertical:7,justifyContent:'center'},tabs:{height:138,flexDirection:'row',flexWrap:'wrap',alignContent:'space-between',justifyContent:'space-between',rowGap:6,columnGap:6},tab:{width:'31.5%',height:42,flexGrow:0,flexShrink:0,borderRadius:12,backgroundColor:C.white,borderWidth:1,borderColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:5},tabActive:{backgroundColor:C.navy,borderColor:C.navy},tabText:{fontSize:10,fontWeight:'800',color:C.text},tabTextActive:{color:'#FFF'},content:{padding:15,paddingBottom:40,gap:12},center:{flex:1,alignItems:'center',justifyContent:'center'},sectionTitle:{fontSize:17,fontWeight:'900',color:C.text,marginBottom:2},metrics:{flexDirection:'row',gap:9},metric:{flex:1,backgroundColor:C.white,borderRadius:15,borderWidth:1,borderColor:C.border,padding:13,gap:7},metricLabel:{fontSize:8,fontWeight:'900',color:C.muted},metricValue:{fontSize:16,fontWeight:'900',color:C.text},card:{backgroundColor:C.white,borderRadius:16,borderWidth:1,borderColor:C.border,padding:14,gap:10},cardTitle:{fontSize:13,fontWeight:'900',color:C.text},sub:{fontSize:10,color:C.muted,lineHeight:15},amount:{fontSize:22,fontWeight:'900',color:C.text},row:{flexDirection:'row',gap:8},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},button:{flex:1,minHeight:42,paddingHorizontal:12,paddingVertical:10,alignItems:'center',justifyContent:'center',borderRadius:11,backgroundColor:C.blue},secondaryButton:{backgroundColor:C.soft,borderWidth:1,borderColor:C.border},buttonText:{fontSize:10,fontWeight:'900',color:'#FFF',textAlign:'center'},badge:{paddingHorizontal:8,paddingVertical:6,borderRadius:20},note:{fontSize:10,color:C.muted,lineHeight:15,backgroundColor:C.blueLight,padding:11,borderRadius:10},inputWrap:{gap:5},inputLabel:{fontSize:10,fontWeight:'800',color:C.muted},input:{minHeight:43,borderWidth:1,borderColor:C.border,backgroundColor:C.white,borderRadius:11,paddingHorizontal:12,paddingVertical:10,color:C.text,fontSize:12},receipt:{height:210,width:'100%',backgroundColor:C.bg,borderRadius:10},});
};


// import React, { useCallback, useEffect, useMemo, useState } from 'react';
// import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// import { router } from 'expo-router';
// import { Ionicons } from '@expo/vector-icons';
// import * as FileSystem from 'expo-file-system/legacy';
// import * as Sharing from 'expo-sharing';
// import * as XLSX from 'xlsx';
// import { supabase } from '../lib/supabase';
// import { createReceiptSignedUrl, getPendingApplicationsForAdmin, reviewApplication } from '../services/investments';
// import { getPalette, useAppTheme } from '../constants/app-theme';

// type Tab = 'Overview' | 'Users' | 'Applications' | 'ROI' | 'Bank' | 'Notifications';
// type UserRow = { id:string; email?:string; created_at:string; last_sign_in_at?:string; profile:any; investments:any[]; applications:any[] };
// type AppRow = { id:string; user_id:string; amount:number; currency:string; monthly_roi_rate:number; transaction_reference:string|null; receipt_path:string; submitted_at:string; status:string; name?:string; email?:string; receiptUrl?:string };
// type RoiRow = { id:string; user_id:string; investment_id:string; period_month:number; due_date:string; amount:number; status:string; paid_at?:string|null; payout_reference?:string|null; name?:string; email?:string };
// type ReinvestmentRow = { id:string; user_id:string; roi_payment_id:string; amount:number; status:string; created_at:string; admin_notes?:string|null; name?:string; email?:string; period_month?:number; due_date?:string };
// const usd = (value:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));
// const tabs:Tab[]=['Overview','Users','Applications','ROI','Bank','Notifications'];

// async function exportWorkbook(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
//   const workbook = XLSX.utils.book_new();
//   const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
//   worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, Math.min(32, header.length + 4)) }));
//   XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
//   const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
//   const uri = `${FileSystem.cacheDirectory || ''}${filename}-${new Date().toISOString().slice(0,10)}.xlsx`;
//   await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
//   if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, {
//     mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//     dialogTitle: 'Export Excel workbook',
//   });
//   else Alert.alert('Export created', `Excel file saved at ${uri}`);
// }

// export default function AdminReviewScreen() {
//   const { isDark } = useAppTheme(); const C = getPalette(isDark); const s = makeStyles(isDark);
//   const [tab,setTab]=useState<Tab>('Overview');
//   const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false);
//   const [users,setUsers]=useState<UserRow[]>([]); const [apps,setApps]=useState<AppRow[]>([]); const [roi,setRoi]=useState<RoiRow[]>([]); const [reinvestmentRequests,setReinvestmentRequests]=useState<ReinvestmentRow[]>([]);
//   const [bankId,setBankId]=useState<string|null>(null); const [bankName,setBankName]=useState(''); const [accountName,setAccountName]=useState(''); const [accountNumber,setAccountNumber]=useState(''); const [instructions,setInstructions]=useState('');
//   const [search,setSearch]=useState(''); const [busy,setBusy]=useState(false);
//   const [pushTitle,setPushTitle]=useState(''); const [pushBody,setPushBody]=useState(''); const [pushUserId,setPushUserId]=useState('');
//   const [reference,setReference]=useState(''); const [roiNotes,setRoiNotes]=useState('');
//   const [currentAdmin,setCurrentAdmin]=useState('');

//   const load=useCallback(async()=>{
//     const {data:{user},error:userError}=await supabase.auth.getUser();
//     if(userError||!user){router.replace('/(auth)/login' as never);return;}
//     const {data:me,error:roleError}=await supabase.from('profiles').select('role').eq('id',user.id).single();
//     if(roleError||me?.role!=='admin'){Alert.alert('Admin access required','This portal is restricted to authorized administrators.');router.replace('/(tabs)' as never);return;}
//     setCurrentAdmin(user.id);
//     const [userResult,appResult,roiResult,bankResult,reinvestResult]=await Promise.all([
//       supabase.functions.invoke('admin-management',{body:{action:'list_users'}}),
//       getPendingApplicationsForAdmin(),
//       supabase.from('roi_payments').select('id,user_id,investment_id,period_month,due_date,amount,status,paid_at,payout_reference').in('status',['pending','paid','reinvested']).order('due_date',{ascending:true}),
//       supabase.from('payment_accounts').select('id,bank_name,account_name,account_number,payment_instructions,is_active').order('created_at',{ascending:false}).limit(1).maybeSingle(),
//       supabase.from('reinvestment_requests').select('id,user_id,roi_payment_id,amount,status,created_at,admin_notes').eq('status','pending_review').order('created_at',{ascending:true})
//     ]);
//     if(userResult.error) throw new Error(`Could not load users. Deploy supabase/functions/admin-management first. ${userResult.error.message}`);
//     const fetchedUsers=(userResult.data?.users||[]) as UserRow[];
//     setUsers(fetchedUsers);
//     if(appResult.length){
//       const ids=[...new Set(appResult.map((a:any)=>a.user_id))];
//       const profiles=await supabase.from('profiles').select('id,full_name').in('id',ids);
//       const userMap=new Map((userResult.data?.users||[]).map((u:any)=>[u.id,u.email]));
//       const names=new Map((profiles.data||[]).map((p:any)=>[p.id,p.full_name]));
//       const enriched=await Promise.all(appResult.map(async(a:any)=>{let receiptUrl:string|undefined;try{receiptUrl=await createReceiptSignedUrl(a.receipt_path)}catch{};return {...a,name:names.get(a.user_id)||'Investor',email:userMap.get(a.user_id),receiptUrl} as AppRow}));
//       setApps(enriched);
//     } else setApps([]);
//     if(roiResult.error) throw roiResult.error;
//     if(reinvestResult.error) throw reinvestResult.error;
//     const roiRows=(roiResult.data||[]) as RoiRow[];
//     const p=await supabase.from('profiles').select('id,full_name').in('id',[...new Set(roiRows.map(r=>r.user_id))].length?[...new Set(roiRows.map(r=>r.user_id))]:['00000000-0000-0000-0000-000000000000']);
//     const userMap=new Map<string,string|undefined>(fetchedUsers.map((u):[string,string|undefined]=>[u.id,u.email]));
//     const names=new Map<string,string>((p.data||[]).map((x:any):[string,string]=>[x.id,x.full_name]));
//     setRoi(roiRows.map(r=>({...r,name:names.get(r.user_id)||'Investor',email:userMap.get(r.user_id)})));
//     const requestRows=(reinvestResult.data||[]) as ReinvestmentRow[];
//     const roiById=new Map(roiRows.map((r):[string,RoiRow]=>[r.id,r]));
//     setReinvestmentRequests(requestRows.map(r=>({...r,name:names.get(r.user_id)||'Investor',email:userMap.get(r.user_id),period_month:roiById.get(r.roi_payment_id)?.period_month,due_date:roiById.get(r.roi_payment_id)?.due_date})));
//     if(bankResult.error) throw bankResult.error;
//     if(bankResult.data){setBankId(bankResult.data.id);setBankName(bankResult.data.bank_name||'');setAccountName(bankResult.data.account_name||'');setAccountNumber(bankResult.data.account_number||'');setInstructions(bankResult.data.payment_instructions||'');}
//   },[]);
//   useEffect(()=>{load().catch((e:any)=>Alert.alert('Admin portal error',e?.message||'Could not load admin data.')).finally(()=>setLoading(false));},[load]);
//   const refresh=async()=>{setRefreshing(true);try{await load()}catch(e:any){Alert.alert('Refresh failed',e.message)}finally{setRefreshing(false)}};
//   const invoke=async(action:string,body:any)=>{const {data,error}=await supabase.functions.invoke('admin-management',{body:{action,...body}});if(error)throw error;if(data?.error)throw new Error(data.error);return data};
//   const filteredUsers=useMemo(()=>users.filter(u=>`${u.email||''} ${u.profile?.full_name||''} ${u.profile?.phone||''} ${u.id}`.toLowerCase().includes(search.toLowerCase())),[users,search]);
//   const activeUsers=users.filter(u=>u.profile?.account_status!=='suspended');
//   const totalPrincipal=users.reduce((sum,u)=>sum+u.investments.filter((i:any)=>i.status==='active').reduce((a:number,i:any)=>a+Number(i.principal||0),0),0);
//   const dueRoi=roi.filter(r=>r.status==='pending'&&r.due_date<=new Date().toISOString().slice(0,10));
//   const pendingRoi=roi.filter(r=>r.status==='pending');
//   const exportUsers = () => exportWorkbook('concept-investment-users','Users',
//     ['Name','Email','Phone','Role','Account status','Registered','Active principal USD','Applications'],
//     filteredUsers.map(u=>[u.profile?.full_name||'',u.email||'',u.profile?.phone||'',u.profile?.role||'investor',u.profile?.account_status||'active',u.created_at,u.investments.filter((i:any)=>i.status==='active').reduce((n:number,i:any)=>n+Number(i.principal||0),0),u.applications.length]));
//   const exportApplications = () => exportWorkbook('concept-investment-applications','Applications',
//     ['Application ID','Investor name','Email','User ID','Amount USD','Status','Submitted','Transaction reference'],
//     apps.map(a=>[a.id,a.name||'',a.email||'',a.user_id,a.amount,a.status,a.submitted_at,a.transaction_reference||'']));
//   const exportRoi = () => exportWorkbook('concept-investment-roi','ROI Ledger',
//     ['ROI ID','Investor name','Email','User ID','Investment ID','Period month','Due date','Amount USD','Status','Paid at','Payout reference'],
//     roi.map(r=>[r.id,r.name||'',r.email||'',r.user_id,r.investment_id,r.period_month,r.due_date,r.amount,r.status,r.paid_at||'',r.payout_reference||'']));
//   const setSuspension=(u:UserRow,suspended:boolean)=>Alert.alert(suspended?'Suspend account?':'Restore account?',suspended?`This blocks ${u.email||'this user'} from signing in until restored.`:'This user will be allowed to sign in again.',[
//     {text:'Cancel',style:'cancel'},{text:suspended?'Suspend':'Restore',style:suspended?'destructive':'default',onPress:async()=>{setBusy(true);try{await invoke('set_suspension',{userId:u.id,suspended,reason:suspended?'Suspended by administrator':''});Alert.alert('Updated',suspended?'Account suspended.':'Account restored.');await load()}catch(e:any){Alert.alert('Could not update account',e.message)}finally{setBusy(false)}}}
//   ]);
//   const saveBank=async()=>{
//     if(!bankName.trim()||!accountName.trim()||!accountNumber.trim()){Alert.alert('Missing details','Enter the bank name, account name and account number.');return}
//     setBusy(true);try{
//       const {data:{user}}=await supabase.auth.getUser();
//       if(bankId){
//         const {error}=await supabase.from('payment_accounts').update({bank_name:bankName.trim(),account_name:accountName.trim(),account_number:accountNumber.trim(),payment_instructions:instructions.trim(),is_active:true,updated_at:new Date().toISOString()}).eq('id',bankId);if(error)throw error;
//       }else{
//         const {data,error}=await supabase.from('payment_accounts').insert({bank_name:bankName.trim(),account_name:accountName.trim(),account_number:accountNumber.trim(),currency:'USD',payment_instructions:instructions.trim(),is_active:true}).select('id').single();if(error)throw error;setBankId(data.id);
//       }
//       await supabase.from('admin_audit_log').insert({admin_id:user?.id,action:'payment_account_updated',entity_type:'payment_account',entity_id:bankId,details:{bank_name:bankName,account_name:accountName,account_number:'[updated]'}});
//       Alert.alert('Saved','Company payment details are now available to investors.');await load();
//     }catch(e:any){Alert.alert('Could not save bank details',e.message)}finally{setBusy(false)}
//   };
//   const review=(row:AppRow,decision:'approved'|'rejected')=>Alert.alert(decision==='approved'?'Approve and activate?':'Reject application?',`${usd(Number(row.amount))} · ${row.email||row.name}\n${decision==='approved'?'This creates the 24-month investment and ROI schedule.':'The application will be marked rejected.'}`,[{text:'Cancel',style:'cancel'},{text:decision==='approved'?'Approve':'Reject',style:decision==='rejected'?'destructive':'default',onPress:async()=>{setBusy(true);try{await reviewApplication(row.id,decision);Alert.alert('Completed',decision==='approved'?'Investment activated and ROI schedule created.':'Application rejected.');await load()}catch(e:any){Alert.alert('Review failed',e.message)}finally{setBusy(false)}}}]);
//   const payout=(row:RoiRow,reinvest:boolean)=>{if(reinvest&&!roiNotes.trim()){Alert.alert('Confirm investor consent','Enter a note confirming the investor explicitly requested reinvestment before recording it.');return;}Alert.alert(reinvest?'Record ROI reinvestment?':'Record ROI payout?',`${usd(Number(row.amount))} for month ${row.period_month}, due ${row.due_date}.\n\nOnly record a payout after the transfer is confirmed. Reinvestment must reflect the investor's consent.`,[{text:'Cancel',style:'cancel'},{text:reinvest?'Record reinvestment':'Mark as paid',onPress:async()=>{setBusy(true);try{const {data,error}=await supabase.rpc(reinvest?'admin_record_roi_reinvestment':'admin_record_roi_payout',reinvest?{p_roi_id:row.id,p_notes:roiNotes}:{p_roi_id:row.id,p_reference:reference||null,p_notes:roiNotes||null});if(error)throw error;setReference('');setRoiNotes('');Alert.alert('Recorded',reinvest?'ROI marked as reinvested.':'ROI payout recorded.');await load()}catch(e:any){Alert.alert('ROI update failed',e.message)}finally{setBusy(false)}}}]);};
//   const reviewReinvestment=(row:ReinvestmentRow,decision:'approved'|'rejected')=>Alert.alert(decision==='approved'?'Approve reinvestment?':'Reject reinvestment?',`${row.name||'Investor'} · ${usd(Number(row.amount))} · ${row.due_date||'ROI due date'}`,[
//     {text:'Cancel',style:'cancel'},{text:decision==='approved'?'Approve':'Reject',style:decision==='rejected'?'destructive':'default',onPress:async()=>{setBusy(true);try{const {error}=await supabase.rpc('admin_review_reinvestment_request',{p_request_id:row.id,p_decision:decision,p_admin_notes:roiNotes||null});if(error)throw error;setRoiNotes('');Alert.alert('Updated',decision==='approved'?'Reinvestment approved and ROI recorded.':'Reinvestment request rejected.');await load()}catch(e:any){Alert.alert('Could not review request',e.message)}finally{setBusy(false)}}}
//   ]);
//   const sendPush=async()=>{if(!pushTitle.trim()||!pushBody.trim()){Alert.alert('Missing message','Enter a notification title and message.');return}setBusy(true);try{const data=await invoke('send_push',{title:pushTitle.trim(),message:pushBody.trim(),userId:pushUserId.trim()||null});Alert.alert('Notification processed',`Saved for ${data.inAppRecipients} in-app recipient(s). Push messages attempted: ${data.pushMessagesAttempted}.`);setPushTitle('');setPushBody('');}catch(e:any){Alert.alert('Notification failed',e.message)}finally{setBusy(false)}};
//   const metric=(label:string,value:string,icon:any)=><View style={s.metric}><Ionicons name={icon} size={19} color={C.blue}/><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{value}</Text></View>;
//   const input=(label:string,value:string,onChange:(v:string)=>void,placeholder:string,multiline=false)=><View style={s.inputWrap}><Text style={s.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted} multiline={multiline} style={[s.input,multiline&&{minHeight:85,textAlignVertical:'top'}]}/></View>;
//   const button=(label:string,onPress:()=>void,secondary=false)=><TouchableOpacity disabled={busy} onPress={onPress} style={[s.button,secondary&&s.secondaryButton]}><Text style={[s.buttonText,secondary&&{color:C.text}]}>{busy?'Please wait…':label}</Text></TouchableOpacity>;

//   return <View style={s.screen}>
//     <View style={s.header}><TouchableOpacity onPress={()=>router.back()} style={s.iconButton}><Ionicons name="arrow-back" size={20} color={C.text}/></TouchableOpacity><View style={{flex:1}}><Text style={s.eyebrow}>THE CONCEPT · MANAGEMENT</Text><Text style={s.title}>Admin portal</Text><Text style={s.subtitle}>Investors, payments and operations</Text></View><TouchableOpacity onPress={refresh} style={s.iconButton}><Ionicons name="refresh" size={19} color={C.blue}/></TouchableOpacity></View>
//     <View style={s.navShell}>
//       <View style={s.tabs}>
//         {tabs.map(t=>{
//           const iconName = ({Overview:'grid-outline',Users:'people-outline',Applications:'document-text-outline',ROI:'wallet-outline',Bank:'business-outline',Notifications:'notifications-outline'} as const)[t];
//           const selected = tab===t;
//           return <TouchableOpacity key={t} onPress={()=>setTab(t)} activeOpacity={0.8} accessibilityRole="tab" accessibilityState={{selected}} style={[s.tab,selected&&s.tabActive]}>
//             <Ionicons name={iconName as any} size={16} color={selected?'#FFFFFF':C.muted}/>
//             <Text numberOfLines={1} style={[s.tabText,selected&&s.tabTextActive]}>{t}</Text>
//           </TouchableOpacity>;
//         })}
//       </View>
//     </View>
//     {loading?<View style={s.center}><ActivityIndicator size="large" color={C.blue}/></View>:<ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
//       {tab==='Overview'&&<><Text style={s.sectionTitle}>Operations overview</Text><View style={s.metrics}>{metric('TOTAL USERS',String(users.length),'people-outline')}{metric('ACTIVE USERS',String(activeUsers.length),'person-circle-outline')}</View><View style={s.metrics}>{metric('ACTIVE PRINCIPAL',usd(totalPrincipal),'wallet-outline')}{metric('PENDING APPLICATIONS',String(apps.length),'time-outline')}</View><View style={s.metrics}>{metric('ROI DUE NOW',String(dueRoi.length),'cash-outline')}{metric('ROI AWAITING DUE DATE',String(pendingRoi.length-dueRoi.length),'calendar-outline')}</View><View style={s.card}><Text style={s.cardTitle}>Quick actions</Text>{button('Manage users',()=>setTab('Users'))}{button('Review applications',()=>setTab('Applications'),true)}{button('Process ROI due',()=>setTab('ROI'),true)}{button('Update company bank account',()=>setTab('Bank'),true)}</View><Text style={s.note}>ROI payout approval records an administrator-confirmed transaction; it does not send money to a bank account.</Text></>}
//       {tab==='Users'&&<><Text style={s.sectionTitle}>Investor directory</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search name, email, phone or user ID" placeholderTextColor={C.muted} style={s.input}/>{button('Export filtered users to Excel (.xlsx)',exportUsers,true)}<Text style={s.note}>Downloads a real .xlsx workbook. User emails are retrieved securely through the admin-management Edge Function.</Text>{filteredUsers.map(u=><View key={u.id} style={s.card}><View style={s.rowBetween}><View style={{flex:1}}><Text style={s.cardTitle}>{u.profile?.full_name||'Investor'}</Text><Text style={s.sub}>{u.email||'No email'} · {u.profile?.phone||'No phone'}</Text></View><View style={[s.badge,{backgroundColor:u.profile?.account_status==='suspended'?C.red+'22':C.greenLight}]}><Text style={{fontSize:9,fontWeight:'900',color:u.profile?.account_status==='suspended'?C.red:C.green}}>{(u.profile?.account_status||'active').toUpperCase()}</Text></View></View><Text style={s.sub}>Registered: {new Date(u.created_at).toLocaleDateString()} · Investments: {u.investments.length} · Applications: {u.applications.length}</Text><Text style={s.sub}>User ID: {u.id}</Text><Text style={s.sub}>Active principal: {usd(u.investments.filter((i:any)=>i.status==='active').reduce((n:number,i:any)=>n+Number(i.principal||0),0))}</Text>{u.applications.slice(0,4).map((a:any,index:number)=><Text key={`${a.status}-${index}`} style={s.sub}>Application: {a.status} · {usd(Number(a.amount))} · {a.submitted_at?new Date(a.submitted_at).toLocaleDateString():'—'}</Text>)}{u.investments.slice(0,4).map((i:any,index:number)=><Text key={`${i.status}-${index}`} style={s.sub}>Investment: {i.status} · {usd(Number(i.principal))}</Text>)}{u.profile?.role!=='admin'&&<View style={s.row}>{button(u.profile?.account_status==='suspended'?'Restore login':'Suspend login',()=>setSuspension(u,u.profile?.account_status!=='suspended'),u.profile?.account_status!=='suspended')}</View>}</View>)}</>}
//       {tab==='Applications'&&<><Text style={s.sectionTitle}>Pending investment applications</Text>{button('Export applications to Excel (.xlsx)',exportApplications,true)}{apps.length===0?<View style={s.card}><Text style={s.cardTitle}>No pending applications</Text><Text style={s.sub}>New submissions appear here after receipt upload.</Text></View>:apps.map(row=><View key={row.id} style={s.card}><Text style={s.amount}>{usd(Number(row.amount))}</Text><Text style={s.sub}>{row.name} · {row.email||row.user_id}</Text><Text style={s.sub}>2.5% monthly ROI: {usd(Number(row.amount)*0.025)} · submitted {new Date(row.submitted_at).toLocaleDateString()}</Text>{row.transaction_reference&&<Text style={s.sub}>Reference: {row.transaction_reference}</Text>}{row.receiptUrl?<Image source={{uri:row.receiptUrl}} style={s.receipt} resizeMode="contain"/>:<Text style={s.sub}>Receipt preview unavailable.</Text>}<View style={s.row}>{button('Reject',()=>review(row,'rejected'),true)}{button('Approve & activate',()=>review(row,'approved'))}</View></View>)}</>}
//       {tab==='ROI'&&<><Text style={s.sectionTitle}>ROI due dates and payouts</Text>{button('Export ROI ledger to Excel (.xlsx)',exportRoi,true)}<Text style={s.note}>Only ROI entries with a due date today or earlier can be processed by the backend. Confirm the investor's choice before recording cash payout or reinvestment.</Text>{input('Payment reference (cash payout)','',setReference,'Bank transfer reference')}{input('Admin notes','',setRoiNotes,'Payout notes / reason for request decision',true)}
//       <Text style={s.cardTitle}>Pending reinvestment requests ({reinvestmentRequests.length})</Text>
//       {reinvestmentRequests.map(request=><View key={request.id} style={s.card}><Text style={s.cardTitle}>{usd(Number(request.amount))} · {request.name||'Investor'}</Text><Text style={s.sub}>{request.email||request.user_id} · Month {request.period_month??'—'} · due {request.due_date||'—'}</Text><Text style={s.sub}>Requested {new Date(request.created_at).toLocaleDateString()}</Text><View style={s.row}>{button('Reject request',()=>reviewReinvestment(request,'rejected'),true)}{button('Approve reinvestment',()=>reviewReinvestment(request,'approved'))}</View></View>)}
//       {roi.map(row=><View key={row.id} style={s.card}><View style={s.rowBetween}><Text style={s.cardTitle}>{usd(Number(row.amount))}</Text><View style={[s.badge,{backgroundColor:row.status==='paid'?C.greenLight:row.status==='reinvested'?C.blueLight:row.due_date<=new Date().toISOString().slice(0,10)?C.amberLight:C.soft}]}><Text style={{fontSize:8,fontWeight:'900',color:row.status==='paid'?C.green:row.status==='reinvested'?C.blue:C.amber}}>{row.status==='pending'&&row.due_date<=new Date().toISOString().slice(0,10)?'DUE':row.status.toUpperCase()}</Text></View></View><Text style={s.sub}>{row.name||'Investor'} · {row.email||row.user_id}</Text><Text style={s.sub}>Month {row.period_month} · due {row.due_date}</Text>{row.paid_at&&<Text style={s.sub}>Paid: {new Date(row.paid_at).toLocaleDateString()} {row.payout_reference?`· Ref: ${row.payout_reference}`:''}</Text>}{row.status==='pending'&&row.due_date<=new Date().toISOString().slice(0,10)&&<View style={s.row}>{button('Record confirmed cash payout',()=>payout(row,false))}</View>}</View>)}</>}
//       {tab==='Bank'&&<><Text style={s.sectionTitle}>Company payment account</Text><Text style={s.note}>Investors retrieve these details from Supabase on the payment step. Verify the account details before saving. Currency is USD.</Text>{input('Bank name',bankName,setBankName,'Bank / payment provider')}{input('Account name',accountName,setAccountName,'Registered account name')}{input('Account number',accountNumber,setAccountNumber,'Account number')}{input('Payment instructions',instructions,setInstructions,'Transfer instructions, memo, reference',true)}{button(bankId?'Save bank account changes':'Add company bank account',saveBank)}<View style={s.card}><Text style={s.cardTitle}>Current details preview</Text><Text style={s.sub}>{bankName||'Bank name not set'}</Text><Text style={s.sub}>{accountName||'Account name not set'}</Text><Text style={s.amount}>{accountNumber||'Account number not set'}</Text><Text style={s.sub}>{instructions||'No extra instructions'}</Text></View></>}
//       {tab==='Notifications'&&<><Text style={s.sectionTitle}>Send push notification</Text><Text style={s.note}>Leave recipient user ID empty to notify all users with registered push tokens. Enter a user's UUID to target one user. The message is also saved to their in-app notifications.</Text>{input('Recipient user ID (optional)',pushUserId,setPushUserId,'Blank = all users')}{input('Notification title',pushTitle,setPushTitle,'e.g. Your ROI is due')}{input('Message',pushBody,setPushBody,'Write the notification message',true)}{button('Send notification',sendPush)}<Text style={s.note}>Push delivery requires the investor app to register Expo push tokens and device notification permissions. Users without a token still receive the in-app notification.</Text></>}
//     </ScrollView>}
//   </View>;
// }
// const makeStyles=(dark:boolean)=>{const C=getPalette(dark);return StyleSheet.create({
//  screen:{flex:1,backgroundColor:C.bg},header:{paddingTop:56,paddingHorizontal:16,paddingBottom:12,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.bg},iconButton:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:C.white,borderWidth:1,borderColor:C.border},eyebrow:{fontSize:8,color:C.blue,fontWeight:'900',letterSpacing:1},title:{fontSize:22,color:C.text,fontWeight:'900'},subtitle:{fontSize:10,color:C.muted,marginTop:3},navShell:{height:108,flexGrow:0,flexShrink:0,backgroundColor:C.bg,borderBottomWidth:1,borderBottomColor:C.border,paddingHorizontal:10,paddingVertical:7,justifyContent:'center'},tabs:{height:92,flexDirection:'row',flexWrap:'wrap',alignContent:'space-between',justifyContent:'space-between',rowGap:6,columnGap:6},tab:{width:'31.5%',height:42,flexGrow:0,flexShrink:0,borderRadius:12,backgroundColor:C.white,borderWidth:1,borderColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:5},tabActive:{backgroundColor:C.navy,borderColor:C.navy},tabText:{fontSize:10,fontWeight:'800',color:C.text},tabTextActive:{color:'#FFF'},content:{padding:15,paddingBottom:40,gap:12},center:{flex:1,alignItems:'center',justifyContent:'center'},sectionTitle:{fontSize:17,fontWeight:'900',color:C.text,marginBottom:2},metrics:{flexDirection:'row',gap:9},metric:{flex:1,backgroundColor:C.white,borderRadius:15,borderWidth:1,borderColor:C.border,padding:13,gap:7},metricLabel:{fontSize:8,fontWeight:'900',color:C.muted},metricValue:{fontSize:16,fontWeight:'900',color:C.text},card:{backgroundColor:C.white,borderRadius:16,borderWidth:1,borderColor:C.border,padding:14,gap:10},cardTitle:{fontSize:13,fontWeight:'900',color:C.text},sub:{fontSize:10,color:C.muted,lineHeight:15},amount:{fontSize:22,fontWeight:'900',color:C.text},row:{flexDirection:'row',gap:8},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},button:{flex:1,minHeight:42,paddingHorizontal:12,paddingVertical:10,alignItems:'center',justifyContent:'center',borderRadius:11,backgroundColor:C.blue},secondaryButton:{backgroundColor:C.soft,borderWidth:1,borderColor:C.border},buttonText:{fontSize:10,fontWeight:'900',color:'#FFF',textAlign:'center'},badge:{paddingHorizontal:8,paddingVertical:6,borderRadius:20},note:{fontSize:10,color:C.muted,lineHeight:15,backgroundColor:C.blueLight,padding:11,borderRadius:10},inputWrap:{gap:5},inputLabel:{fontSize:10,fontWeight:'800',color:C.muted},input:{minHeight:43,borderWidth:1,borderColor:C.border,backgroundColor:C.white,borderRadius:11,paddingHorizontal:12,paddingVertical:10,color:C.text,fontSize:12},receipt:{height:210,width:'100%',backgroundColor:C.bg,borderRadius:10},});
// };
