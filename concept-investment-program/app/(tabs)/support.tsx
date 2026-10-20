
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getPalette, useAppTheme } from '../../constants/app-theme';

const getC = getPalette;
type FAQ = { category: string; question: string; answer: string };
const FAQS: FAQ[] = [
  { category: 'Investments', question: 'When does my investment become active?', answer: 'Your application remains pending while the administrator reviews your payment receipt. It becomes active only after the payment is verified and the investment is approved.' },
  { category: 'Investments', question: 'What is the investment term?', answer: 'The programme is designed around a 24-month investment term. Check your approved investment details and agreement for the dates and terms that apply to your account.' },
  { category: 'ROI & payments', question: 'How is my monthly ROI calculated?', answer: 'The programme displays a stated monthly ROI rate of 2.5% on the principal. Your actual schedule and amounts should be checked against your approved contract and the records shown in the app.' },
  { category: 'ROI & payments', question: 'Why is my ROI still pending?', answer: 'A scheduled ROI may remain pending until it is due and the company updates the payment record. If a due payment still looks incorrect, contact investor support with the month and due date.' },
  { category: 'ROI & payments', question: 'Can I reinvest an ROI payment?', answer: 'Reinvestment should happen only after the company confirms the ROI is eligible and you have explicitly chosen to reinvest it. Review the available options before confirming.' },
  { category: 'Applications', question: 'How do I apply for an investment?', answer: 'Open My Investments, select Apply to invest, enter the requested amount, follow the payment instructions shown in the app, and upload your payment receipt. Keep your transfer confirmation for reference.' },
  { category: 'Applications', question: 'I uploaded a receipt. Why is my application not active?', answer: 'Uploading a receipt does not automatically activate an investment. The application must be reviewed and approved by an administrator first.' },
  { category: 'Account & security', question: 'What should I do if my profile details are wrong?', answer: 'Open My Profile and check the details shown there. If a detail cannot be edited in the app, send investor support the field that needs correction. Never send your password or PIN.' },
  { category: 'Account & security', question: 'How do I keep my account secure?', answer: 'Use a strong, unique password, sign out on shared devices, and never share your password, one-time codes, or banking PIN. Support should never need those secrets.' },
];
const CATEGORIES = ['All', 'Investments', 'ROI & payments', 'Applications', 'Account & security'];

export default function SupportScreen() {
  const { isDark } = useAppTheme();
  const C = getC(isDark);
  const styles = makeStyles(isDark);
  const [category, setCategory] = useState('All');
  const [openFAQ, setOpenFAQ] = useState<string | null>(FAQS[0].question);
  const [showContactForm, setShowContactForm] = useState(false);
  const [topic, setTopic] = useState('Investment application');
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const visibleFAQs = useMemo(() => FAQS.filter(item => category === 'All' || item.category === category), [category]);

  const submitRequest = () => {
    if (!message.trim()) {
      Alert.alert('Add a message', 'Please describe what you need help with before continuing.');
      return;
    }
    Alert.alert(
      'Support request not sent',
      'This screen is ready, but a support-request backend has not been connected yet. Please connect it to your official support email or Supabase support_requests table before using it to submit real requests.'
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={21} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>THE CONCEPT · INVESTOR PORTAL</Text>
            <Text style={styles.title}>Help & Investor Support</Text>
            <Text style={styles.subtitle}>Answers and guidance for your account</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="help-buoy-outline" size={26} color="#FFFFFF" /></View>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroText}>Find answers about applications, investment terms, ROI schedules and account security.</Text>
          <TouchableOpacity style={styles.heroButton} onPress={() => setShowContactForm(v => !v)} activeOpacity={0.85}>
            <Ionicons name="chatbubble-ellipses-outline" size={17} color={C.blue} />
            <Text style={styles.heroButtonText}>{showContactForm ? 'Hide support form' : 'Contact investor support'}</Text>
          </TouchableOpacity>
        </View>

        {showContactForm && (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Tell us what you need</Text>
            <Text style={styles.formHint}>Include only the details needed to understand the issue. Do not include passwords, PINs or one-time codes.</Text>
            <Text style={styles.fieldLabel}>Topic</Text>
            <View style={styles.topicWrap}>
              {['Investment application', 'ROI payment', 'Account access', 'Profile details', 'Other'].map(item => (
                <TouchableOpacity key={item} onPress={() => setTopic(item)} style={[styles.topicChip, topic === item && styles.topicChipActive]}>
                  <Text style={[styles.topicText, topic === item && styles.topicTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Reference (optional)</Text>
            <TextInput value={reference} onChangeText={setReference} placeholder="Application ID or ROI month" placeholderTextColor={C.muted} style={styles.input} autoCapitalize="none" />
            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput value={message} onChangeText={setMessage} placeholder="Describe the issue and what you need help with…" placeholderTextColor={C.muted} style={[styles.input, styles.messageInput]} multiline textAlignVertical="top" maxLength={1500} />
            <Text style={styles.charCount}>{message.length}/1500</Text>
            <TouchableOpacity style={styles.submitButton} onPress={submitRequest} activeOpacity={0.85}>
              <Ionicons name="send-outline" size={16} color="#FFFFFF" /><Text style={styles.submitText}>Prepare support request</Text>
            </TouchableOpacity>
            <Text style={styles.backendNote}>Request submission needs to be connected to the company’s official support channel before it can send.</Text>
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <View><Text style={styles.sectionTitle}>Frequently asked questions</Text><Text style={styles.sectionSubtitle}>Tap a question to read the answer</Text></View>
          <View style={styles.countBadge}><Text style={styles.countText}>{visibleFAQs.length}</Text></View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {CATEGORIES.map(item => (
            <TouchableOpacity key={item} onPress={() => { setCategory(item); setOpenFAQ(null); }} style={[styles.categoryChip, category === item && styles.categoryChipActive]}>
              <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.faqList}>
          {visibleFAQs.map((item, index) => {
            const expanded = openFAQ === item.question;
            return (
              <View key={item.question} style={styles.faqCard}>
                <TouchableOpacity style={styles.faqQuestion} onPress={() => setOpenFAQ(expanded ? null : item.question)} activeOpacity={0.75}>
                  <View style={styles.faqNumber}><Text style={styles.faqNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
                  <Text style={styles.questionText}>{item.question}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
                </TouchableOpacity>
                {expanded && <View style={styles.answerWrap}><Text style={styles.answerCategory}>{item.category.toUpperCase()}</Text><Text style={styles.answerText}>{item.answer}</Text></View>}
              </View>
            );
          })}
        </View>

        <View style={styles.securityCard}>
          <View style={styles.securityIcon}><Ionicons name="shield-checkmark-outline" size={21} color={C.green} /></View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.securityTitle}>Your security matters</Text>
            <Text style={styles.securityText}>Never share your password, banking PIN, one-time password or recovery code. Verify payment instructions in the official app before transferring funds.</Text>
          </View>
        </View>
        <View style={styles.footerCard}>
          <Ionicons name="information-circle-outline" size={18} color={C.blue} />
          <Text style={styles.footerText}>These FAQs provide general guidance. Your approved investment agreement and official company records take precedence if details differ.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (dark: boolean) => {
  const C = getC(dark);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    fixedHeader: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 14, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, zIndex: 5 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    eyebrow: { fontSize: 8, color: C.blue, fontWeight: '800', letterSpacing: 1, marginBottom: 5 },
    title: { color: C.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }, subtitle: { color: C.muted, fontSize: 10, marginTop: 4 },
    scrollArea: { flex: 1 }, content: { padding: 18, paddingBottom: 38, gap: 17 },
    hero: { backgroundColor: C.navy, borderRadius: 20, padding: 20, gap: 10 },
    heroIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#29415C', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' }, heroText: { color: '#C4D0DF', fontSize: 11, lineHeight: 17 },
    heroButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, marginTop: 3 }, heroButtonText: { color: C.blue, fontSize: 11, fontWeight: '800' },
    formCard: { backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 }, sectionTitle: { color: C.text, fontSize: 16, fontWeight: '900' }, formHint: { color: C.muted, fontSize: 10, lineHeight: 15 }, fieldLabel: { color: C.text, fontSize: 10, fontWeight: '800', marginTop: 4 },
    topicWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, topicChip: { borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.bg }, topicChipActive: { backgroundColor: C.blue, borderColor: C.blue }, topicText: { color: C.text, fontSize: 9, fontWeight: '700' }, topicTextActive: { color: '#FFFFFF' },
    input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, color: C.text, fontSize: 11 }, messageInput: { minHeight: 105 }, charCount: { color: C.muted, fontSize: 9, textAlign: 'right', marginTop: -6 },
    submitButton: { backgroundColor: C.blue, borderRadius: 12, minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, submitText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' }, backendNote: { color: C.muted, fontSize: 9, lineHeight: 14 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sectionSubtitle: { color: C.muted, fontSize: 10, marginTop: 4 }, countBadge: { minWidth: 30, height: 30, borderRadius: 10, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 }, countText: { color: C.blue, fontSize: 11, fontWeight: '900' },
    categories: { gap: 7, paddingRight: 10 }, categoryChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: dark ? '#1A2638' : '#ECEEF0' }, categoryChipActive: { backgroundColor: C.navy }, categoryText: { color: dark ? '#C6D0DE' : '#44474C', fontSize: 9, fontWeight: '800' }, categoryTextActive: { color: '#FFFFFF' },
    faqList: { gap: 9 }, faqCard: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }, faqQuestion: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 }, faqNumber: { width: 30, height: 30, borderRadius: 9, backgroundColor: dark ? '#1A2638' : '#F0F3F6', alignItems: 'center', justifyContent: 'center' }, faqNumberText: { color: C.blue, fontSize: 9, fontWeight: '900' }, questionText: { flex: 1, color: C.text, fontSize: 11, fontWeight: '800', lineHeight: 16 }, answerWrap: { borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 15, gap: 7 }, answerCategory: { color: C.blue, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, answerText: { color: C.muted, fontSize: 11, lineHeight: 18 },
    securityCard: { flexDirection: 'row', gap: 11, padding: 15, backgroundColor: C.white, borderRadius: 15, borderWidth: 1, borderColor: C.border }, securityIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: dark ? '#12372F' : '#E7F7EF', alignItems: 'center', justifyContent: 'center' }, securityTitle: { color: C.text, fontSize: 12, fontWeight: '900' }, securityText: { color: C.muted, fontSize: 10, lineHeight: 16 },
    footerCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.blueLight, borderRadius: 12, padding: 12 }, footerText: { flex: 1, color: dark ? '#C6D0DE' : '#34475C', fontSize: 9, lineHeight: 15 },
  });
};