import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPalette, useAppTheme } from '../../constants/app-theme';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordScreen() {
  const { isDark } = useAppTheme();
  const C = getPalette(isDark);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { Alert.alert('Enter your email', 'Please enter a valid email address.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(value);
    setLoading(false);
    if (error) Alert.alert('Could not send reset email', error.message);
    else Alert.alert('Check your inbox', 'If an account exists for this email, a password reset link will be sent.');
  };
  return <KeyboardAvoidingView style={[styles.screen,{backgroundColor:C.bg}]} behavior={Platform.OS==='ios'?'padding':undefined}>
    <TouchableOpacity onPress={()=>router.replace('/login' as never)} style={styles.back}><Ionicons name="arrow-back" size={22} color={C.text}/></TouchableOpacity>
    <Text style={[styles.title,{color:C.text}]}>Reset password</Text>
    <Text style={[styles.subtitle,{color:C.muted}]}>Enter the email address linked to your investor account.</Text>
    <TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={C.muted} autoCapitalize="none" keyboardType="email-address" style={[styles.input,{backgroundColor:C.white,borderColor:C.border,color:C.text}]}/>
    <TouchableOpacity disabled={loading} onPress={submit} style={[styles.button,{backgroundColor:C.navy,opacity:loading?0.7:1}]}><Text style={styles.buttonText}>{loading?'Sending…':'Send reset link'}</Text></TouchableOpacity>
  </KeyboardAvoidingView>;
}
const styles=StyleSheet.create({screen:{flex:1,padding:24,paddingTop:64},back:{width:44,height:44,alignItems:'center',justifyContent:'center',marginBottom:28},title:{fontSize:28,fontWeight:'900'},subtitle:{fontSize:13,lineHeight:20,marginTop:10,marginBottom:24},input:{height:52,borderWidth:1,borderRadius:13,paddingHorizontal:14},button:{height:52,borderRadius:13,alignItems:'center',justifyContent:'center',marginTop:16},buttonText:{color:'#fff',fontWeight:'800'}});
