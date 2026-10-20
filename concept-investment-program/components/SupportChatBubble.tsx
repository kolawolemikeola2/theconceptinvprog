import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getPalette, useAppTheme } from '../constants/app-theme';

type Conversation = {
  id: string;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved';
  updated_at: string;
  user_id: string;
};

type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  read_at?: string | null;
};

const statusLabel = (status: string) => {
  if (status === 'in_progress') return 'Being handled';
  if (status === 'resolved') return 'Resolved';
  return 'Open';
};

export default function SupportChatBubble() {
  const { isDark } = useAppTheme();
  const C = getPalette(isDark);

  const [visible, setVisible] = useState(false);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'investor'>('investor');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Other');
  const [draft, setDraft] = useState('');
  const [newComplaint, setNewComplaint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('support-chat', { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const loadIdentity = useCallback(async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw error || new Error('Please sign in again.');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;
    setUserId(user.id);
    setUserRole(profile?.role === 'admin' ? 'admin' : 'investor');
    return { id: user.id, role: profile?.role === 'admin' ? 'admin' as const : 'investor' as const };
  }, []);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      await loadIdentity();
      const data = await invoke({ action: 'list_conversations' });
      setConversations(data.conversations || []);
    } catch (error: any) {
      Alert.alert('Support unavailable', error?.message || 'Could not load support conversations.');
    } finally {
      setLoading(false);
    }
  }, [invoke, loadIdentity]);

  const loadMessages = useCallback(async (conversation: Conversation) => {
    try {
      const data = await invoke({ action: 'get_messages', conversationId: conversation.id });
      setMessages(data.messages || []);
      await invoke({ action: 'mark_read', conversationId: conversation.id });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error: any) {
      Alert.alert('Could not load messages', error?.message || 'Please try again.');
    }
  }, [invoke]);

  useEffect(() => {
    if (!visible) return;
    void loadConversations();
  }, [visible, loadConversations]);

  useEffect(() => {
    if (!visible) return;
    const channel = supabase
      .channel(`support-live-${userId || 'current'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, (payload) => {
        const row = payload.new as Partial<SupportMessage>;
        if (selected && row.conversation_id === selected.id) void loadMessages(selected);
        void loadConversations();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => {
        void loadConversations();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [visible, userId, selected, loadMessages, loadConversations]);

  const createComplaint = async () => {
    if (!subject.trim() || !draft.trim()) {
      Alert.alert('Details required', 'Enter a subject and describe your complaint.');
      return;
    }
    setSending(true);
    try {
      const data = await invoke({
        action: 'create_conversation',
        subject: subject.trim(),
        category,
        message: draft.trim(),
      });
      setSubject('');
      setDraft('');
      setNewComplaint(false);
      await loadConversations();
      setSelected(data.conversation);
      await loadMessages(data.conversation);
    } catch (error: any) {
      Alert.alert('Could not submit complaint', error?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!selected || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      await invoke({ action: 'send_message', conversationId: selected.id, message: text });
      await loadMessages(selected);
      await loadConversations();
    } catch (error: any) {
      setDraft(text);
      Alert.alert('Message not sent', error?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const closeChat = () => {
    setVisible(false);
    setSelected(null);
    setNewComplaint(false);
    setDraft('');
    setMessages([]);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open investor support chat"
        onPress={() => setVisible(true)}
        style={[styles.bubble, { backgroundColor: C.blue, borderColor: C.white }]}
      >
        <Ionicons name="chatbubbles" size={25} color="#FFFFFF" />
      </Pressable>

      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeChat}>
        <KeyboardAvoidingView
          style={[styles.modal, { backgroundColor: C.bg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={[styles.header, { backgroundColor: C.white, borderColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: C.text }]}>
                {userRole === 'admin' ? 'Support Inbox' : 'Investor Support'}
              </Text>
              <Text style={[styles.sub, { color: C.muted }]}>
                {userRole === 'admin' ? 'Respond to investor complaints' : 'Complaints and replies from our team'}
              </Text>
            </View>
            <Pressable accessibilityLabel="Close support" onPress={closeChat} style={styles.close}>
              <Ionicons name="close" size={22} color={C.text} />
            </Pressable>
          </View>

          {selected ? (
            <>
              <View style={[styles.conversationHead, { borderColor: C.border }]}>
                <Pressable onPress={() => { setSelected(null); setMessages([]); setDraft(''); }} style={styles.back}>
                  <Ionicons name="arrow-back" size={19} color={C.blue} />
                  <Text style={{ color: C.blue, fontWeight: '700' }}>All conversations</Text>
                </Pressable>
                <Text style={[styles.subject, { color: C.text }]}>{selected.subject}</Text>
                <Text style={[styles.sub, { color: C.muted }]}>{statusLabel(selected.status)}</Text>
              </View>

              <FlatList
                ref={listRef}
                style={{ flex: 1 }}
                contentContainerStyle={styles.messages}
                data={messages}
                keyExtractor={(item) => item.id}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => {
                  // The backend writes sender_id = authenticated caller ID.
                  // Compare against the authenticated identity; admin role is shown as a label too.
                  const mine = Boolean(userId) && item.sender_id === userId;
                  const senderLabel = mine
                    ? (userRole === 'admin' ? 'You · Support' : 'You')
                    : (userRole === 'admin' ? 'Investor' : 'Investor Support');

                  return (
                    <View style={[styles.messageRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
                      <View style={[
                        styles.message,
                        {
                          backgroundColor: mine ? C.blue : C.white,
                          borderColor: mine ? C.blue : C.border,
                          alignSelf: mine ? 'flex-end' : 'flex-start',
                        },
                      ]}>
                        <Text style={[styles.sender, { color: mine ? '#E5EEFF' : C.blue }]}>{senderLabel}</Text>
                        <Text style={{ color: mine ? '#FFFFFF' : C.text, fontSize: 14, lineHeight: 20 }}>
                          {item.message}
                        </Text>
                        <Text style={{ color: mine ? '#E5EEFF' : C.muted, fontSize: 10, marginTop: 5 }}>
                          {new Date(item.created_at).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={<Text style={[styles.empty, { color: C.muted }]}>No messages yet.</Text>}
              />

              {selected.status !== 'resolved' ? (
                <View style={[styles.composer, { backgroundColor: C.white, borderColor: C.border }]}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Write a message…"
                    placeholderTextColor={C.muted}
                    multiline
                    maxLength={5000}
                    style={[styles.input, { color: C.text, borderColor: C.border }]}
                  />
                  <Pressable disabled={sending || !draft.trim()} onPress={sendMessage}
                    style={[styles.send, { backgroundColor: C.blue, opacity: sending || !draft.trim() ? 0.5 : 1 }]}>
                    {sending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
                  </Pressable>
                </View>
              ) : (
                <Text style={[styles.resolved, { color: C.muted }]}>
                  This complaint is resolved. Start a new complaint if you need more help.
                </Text>
              )}
            </>
          ) : newComplaint ? (
            <View style={styles.newForm}>
              <Pressable onPress={() => setNewComplaint(false)} style={styles.back}>
                <Ionicons name="arrow-back" size={19} color={C.blue} />
                <Text style={{ color: C.blue, fontWeight: '700' }}>Back to conversations</Text>
              </Pressable>
              <Text style={[styles.label, { color: C.text }]}>What do you need help with?</Text>
              <TextInput value={subject} onChangeText={setSubject} placeholder="Complaint subject"
                placeholderTextColor={C.muted} maxLength={150}
                style={[styles.field, { color: C.text, borderColor: C.border, backgroundColor: C.white }]} />
              <Text style={[styles.label, { color: C.text }]}>Category</Text>
              <View style={styles.categories}>
                {['Investment', 'ROI payment', 'Account access', 'Other'].map((item) => (
                  <Pressable key={item} onPress={() => setCategory(item)}
                    style={[styles.category, { borderColor: category === item ? C.blue : C.border, backgroundColor: category === item ? C.blue + '18' : C.white }]}>
                    <Text style={{ color: category === item ? C.blue : C.text, fontSize: 12, fontWeight: '600' }}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.label, { color: C.text }]}>Describe your complaint</Text>
              <TextInput value={draft} onChangeText={setDraft} placeholder="Please explain how we can help…"
                placeholderTextColor={C.muted} multiline maxLength={5000} textAlignVertical="top"
                style={[styles.field, styles.longField, { color: C.text, borderColor: C.border, backgroundColor: C.white }]} />
              <Pressable disabled={sending} onPress={createComplaint}
                style={[styles.primary, { backgroundColor: C.blue, opacity: sending ? 0.6 : 1 }]}>
                {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Submit complaint</Text>}
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.listHeading}>
                <Text style={[styles.sectionTitle, { color: C.text }]}>
                  {userRole === 'admin' ? 'All investor conversations' : 'Your conversations'}
                </Text>
                {userRole !== 'admin' && (
                  <Pressable onPress={() => { setDraft(''); setSubject(''); setCategory('Other'); setNewComplaint(true); }}
                    style={[styles.primarySmall, { backgroundColor: C.blue }]}>
                    <Ionicons name="add" size={17} color="#FFFFFF" />
                    <Text style={styles.primaryText}>New complaint</Text>
                  </Pressable>
                )}
              </View>

              {loading ? <ActivityIndicator style={{ marginTop: 35 }} color={C.blue} /> : (
                <FlatList
                  data={conversations}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  refreshing={loading}
                  onRefresh={loadConversations}
                  ListEmptyComponent={<Text style={[styles.empty, { color: C.muted }]}>
                    {userRole === 'admin' ? 'No investor complaints yet.' : 'No complaints yet. Tap “New complaint” to contact investor support.'}
                  </Text>}
                  renderItem={({ item }) => (
                    <Pressable onPress={() => { setSelected(item); setMessages([]); void loadMessages(item); }}
                      style={[styles.conversation, { backgroundColor: C.white, borderColor: C.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.subject, { color: C.text }]}>{item.subject}</Text>
                        <Text style={[styles.sub, { color: C.muted }]}>
                          {item.category} · {new Date(item.updated_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[styles.status, { backgroundColor: item.status === 'resolved' ? '#DDF7E8' : '#E6EEFF' }]}>
                        <Text style={{ color: item.status === 'resolved' ? '#17683A' : '#2454A6', fontSize: 10, fontWeight: '800' }}>
                          {statusLabel(item.status)}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                />
              )}
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Keep the floating bubble above the app's bottom tabs without overlapping the nav icons.
  bubble: {
    position: 'absolute',
    right: 18,
    bottom: 122,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  modal: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
    paddingHorizontal: 18,
    paddingBottom: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '900' },
  sub: { fontSize: 12, marginTop: 4 },
  close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  conversationHead: { padding: 15, borderBottomWidth: 1, gap: 5 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  subject: { fontSize: 15, fontWeight: '800' },
  sender: { fontSize: 10, fontWeight: '800', marginBottom: 5 },
  messages: { padding: 15, gap: 12, flexGrow: 1 },
  messageRow: { flexDirection: 'row', width: '100%' },
  message: { maxWidth: '86%', borderWidth: 1, borderRadius: 15, padding: 12 },
  empty: { textAlign: 'center', padding: 28, fontSize: 13, lineHeight: 20 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 110, minHeight: 44, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  send: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  resolved: { textAlign: 'center', padding: 16, fontSize: 12 },
  newForm: { flex: 1, padding: 18, gap: 12 },
  label: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  field: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  longField: { minHeight: 150 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 11 },
  primary: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 12, marginTop: 5 },
  primarySmall: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  listHeading: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  list: { paddingHorizontal: 15, paddingBottom: 30, gap: 10, flexGrow: 1 },
  conversation: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { borderRadius: 18, paddingVertical: 6, paddingHorizontal: 8 },
});




// import React, { useCallback, useEffect, useState } from 'react';
// import {
//   ActivityIndicator,
//   Alert,
//   FlatList,
//   KeyboardAvoidingView,
//   Modal,
//   Platform,
//   Pressable,
//   StyleSheet,
//   Text,
//   TextInput,
//   View,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { supabase } from '../lib/supabase';
// import { getPalette, useAppTheme } from '../constants/app-theme';

// type Conversation = {
//   id: string;
//   subject: string;
//   category: string;
//   status: 'open' | 'in_progress' | 'resolved';
//   updated_at: string;
//   user_id: string;
// };

// type SupportMessage = {
//   id: string;
//   conversation_id: string;
//   sender_id: string;
//   message: string;
//   created_at: string;
//   read_at?: string | null;
// };

// export default function SupportChatBubble() {
//   const { isDark } = useAppTheme();
//   const C = getPalette(isDark);

//   const [visible, setVisible] = useState(false);
//   const [userId, setUserId] = useState('');
//   const [conversations, setConversations] = useState<Conversation[]>([]);
//   const [selected, setSelected] = useState<Conversation | null>(null);
//   const [messages, setMessages] = useState<SupportMessage[]>([]);
//   const [subject, setSubject] = useState('');
//   const [category, setCategory] = useState('Other');
//   const [draft, setDraft] = useState('');
//   const [newComplaint, setNewComplaint] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [sending, setSending] = useState(false);

//   const invoke = useCallback(async (body: Record<string, unknown>) => {
//     const { data, error } = await supabase.functions.invoke(
//       'support-chat',
//       { body },
//     );

//     if (error) throw error;
//     if (data?.error) throw new Error(data.error);

//     return data;
//   }, []);

//   const loadConversations = useCallback(async () => {
//     setLoading(true);

//     try {
//       const {
//         data: { user },
//         error,
//       } = await supabase.auth.getUser();

//       if (error || !user) {
//         throw error || new Error('Please sign in again.');
//       }

//       setUserId(user.id);

//       const data = await invoke({
//         action: 'list_conversations',
//       });

//       setConversations(data.conversations || []);
//     } catch (error: any) {
//       Alert.alert(
//         'Support unavailable',
//         error?.message || 'Could not load support conversations.',
//       );
//     } finally {
//       setLoading(false);
//     }
//   }, [invoke]);

//   const loadMessages = useCallback(
//     async (conversation: Conversation) => {
//       try {
//         const data = await invoke({
//           action: 'get_messages',
//           conversationId: conversation.id,
//         });

//         setMessages(data.messages || []);

//         await invoke({
//           action: 'mark_read',
//           conversationId: conversation.id,
//         });
//       } catch (error: any) {
//         Alert.alert(
//           'Could not load messages',
//           error?.message || 'Please try again.',
//         );
//       }
//     },
//     [invoke],
//   );

//   useEffect(() => {
//     if (!visible) return;

//     void loadConversations();
//   }, [visible, loadConversations]);

//   useEffect(() => {
//     if (!visible) return;

//     const channel = supabase
//       .channel('investor-support-live')
//       .on(
//         'postgres_changes',
//         {
//           event: '*',
//           schema: 'public',
//           table: 'support_messages',
//         },
//         (payload) => {
//           const row = payload.new as Partial<SupportMessage>;

//           if (
//             selected &&
//             row.conversation_id === selected.id
//           ) {
//             void loadMessages(selected);
//           }

//           void loadConversations();
//         },
//       )
//       .on(
//         'postgres_changes',
//         {
//           event: '*',
//           schema: 'public',
//           table: 'support_conversations',
//         },
//         () => {
//           void loadConversations();
//         },
//       )
//       .subscribe();

//     return () => {
//       void supabase.removeChannel(channel);
//     };
//   }, [
//     visible,
//     selected,
//     loadMessages,
//     loadConversations,
//   ]);

//   const createComplaint = async () => {
//     if (!subject.trim() || !draft.trim()) {
//       Alert.alert(
//         'Details required',
//         'Enter a subject and describe your complaint.',
//       );
//       return;
//     }

//     setSending(true);

//     try {
//       const data = await invoke({
//         action: 'create_conversation',
//         subject: subject.trim(),
//         category,
//         message: draft.trim(),
//       });

//       setSubject('');
//       setDraft('');
//       setNewComplaint(false);

//       await loadConversations();

//       setSelected(data.conversation);
//       await loadMessages(data.conversation);
//     } catch (error: any) {
//       Alert.alert(
//         'Could not submit complaint',
//         error?.message || 'Please try again.',
//       );
//     } finally {
//       setSending(false);
//     }
//   };

//   const sendMessage = async () => {
//     if (!selected || !draft.trim() || sending) return;

//     const text = draft.trim();
//     setDraft('');
//     setSending(true);

//     try {
//       await invoke({
//         action: 'send_message',
//         conversationId: selected.id,
//         message: text,
//       });

//       await loadMessages(selected);
//       await loadConversations();
//     } catch (error: any) {
//       setDraft(text);

//       Alert.alert(
//         'Message not sent',
//         error?.message || 'Please try again.',
//       );
//     } finally {
//       setSending(false);
//     }
//   };

//   const statusLabel = (status: string) => {
//     if (status === 'in_progress') return 'Being handled';
//     if (status === 'resolved') return 'Resolved';
//     return 'Open';
//   };

//   const closeChat = () => {
//     setVisible(false);
//     setSelected(null);
//     setNewComplaint(false);
//     setDraft('');
//   };

//   return (
//     <>
//       {/* Floating support bubble */}
//       <Pressable
//         accessibilityRole="button"
//         accessibilityLabel="Open investor support chat"
//         onPress={() => setVisible(true)}
//         style={[
//           styles.bubble,
//           {
//             backgroundColor: C.blue,
//             borderColor: C.white,
//           },
//         ]}
//       >
//         <Ionicons
//           name="chatbubbles"
//           size={25}
//           color="#FFFFFF"
//         />
//       </Pressable>

//       {/* Support chat window */}
//       <Modal
//         visible={visible}
//         animationType="slide"
//         presentationStyle="pageSheet"
//         onRequestClose={closeChat}
//       >
//         <KeyboardAvoidingView
//           style={[styles.modal, { backgroundColor: C.bg }]}
//           behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//         >
//           <View
//             style={[
//               styles.header,
//               {
//                 backgroundColor: C.white,
//                 borderColor: C.border,
//               },
//             ]}
//           >
//             <View style={{ flex: 1 }}>
//               <Text style={[styles.title, { color: C.text }]}>
//                 Investor Support
//               </Text>
//               <Text style={[styles.sub, { color: C.muted }]}>
//                 Complaints and replies from our team
//               </Text>
//             </View>

//             <Pressable
//               accessibilityLabel="Close support"
//               onPress={closeChat}
//               style={styles.close}
//             >
//               <Ionicons
//                 name="close"
//                 size={22}
//                 color={C.text}
//               />
//             </Pressable>
//           </View>

//           {selected ? (
//             <>
//               <View
//                 style={[
//                   styles.conversationHead,
//                   { borderColor: C.border },
//                 ]}
//               >
//                 <Pressable
//                   onPress={() => {
//                     setSelected(null);
//                     setMessages([]);
//                     setDraft('');
//                   }}
//                   style={styles.back}
//                 >
//                   <Ionicons
//                     name="arrow-back"
//                     size={19}
//                     color={C.blue}
//                   />
//                   <Text
//                     style={{ color: C.blue, fontWeight: '700' }}
//                   >
//                     All complaints
//                   </Text>
//                 </Pressable>

//                 <Text style={[styles.subject, { color: C.text }]}>
//                   {selected.subject}
//                 </Text>

//                 <Text style={[styles.sub, { color: C.muted }]}>
//                   {statusLabel(selected.status)}
//                 </Text>
//               </View>

//               <FlatList
//                 style={{ flex: 1 }}
//                 contentContainerStyle={styles.messages}
//                 data={messages}
//                 keyExtractor={(item) => item.id}
//                 renderItem={({ item }) => {
//                   const mine = item.sender_id === userId;

//                   return (
//                     <View
//                       style={[
//                         styles.messageRow,
//                         {
//                           justifyContent: mine
//                             ? 'flex-end'
//                             : 'flex-start',
//                         },
//                       ]}
//                     >
//                       <View
//                         style={[
//                           styles.message,
//                           {
//                             backgroundColor: mine
//                               ? C.blue
//                               : C.white,
//                             borderColor: C.border,
//                           },
//                         ]}
//                       >
//                         <Text
//                           style={{
//                             color: mine ? '#FFFFFF' : C.text,
//                             fontSize: 14,
//                             lineHeight: 20,
//                           }}
//                         >
//                           {item.message}
//                         </Text>

//                         <Text
//                           style={{
//                             color: mine ? '#E5EEFF' : C.muted,
//                             fontSize: 10,
//                             marginTop: 5,
//                           }}
//                         >
//                           {new Date(
//                             item.created_at,
//                           ).toLocaleString()}
//                         </Text>
//                       </View>
//                     </View>
//                   );
//                 }}
//                 ListEmptyComponent={
//                   <Text
//                     style={[
//                       styles.empty,
//                       { color: C.muted },
//                     ]}
//                   >
//                     No messages yet.
//                   </Text>
//                 }
//               />

//               {selected.status !== 'resolved' ? (
//                 <View
//                   style={[
//                     styles.composer,
//                     {
//                       backgroundColor: C.white,
//                       borderColor: C.border,
//                     },
//                   ]}
//                 >
//                   <TextInput
//                     value={draft}
//                     onChangeText={setDraft}
//                     placeholder="Write a message…"
//                     placeholderTextColor={C.muted}
//                     multiline
//                     maxLength={5000}
//                     style={[
//                       styles.input,
//                       {
//                         color: C.text,
//                         borderColor: C.border,
//                       },
//                     ]}
//                   />

//                   <Pressable
//                     disabled={sending || !draft.trim()}
//                     onPress={sendMessage}
//                     style={[
//                       styles.send,
//                       {
//                         backgroundColor: C.blue,
//                         opacity:
//                           sending || !draft.trim() ? 0.5 : 1,
//                       },
//                     ]}
//                   >
//                     {sending ? (
//                       <ActivityIndicator color="#FFFFFF" />
//                     ) : (
//                       <Ionicons
//                         name="send"
//                         size={18}
//                         color="#FFFFFF"
//                       />
//                     )}
//                   </Pressable>
//                 </View>
//               ) : (
//                 <Text
//                   style={[
//                     styles.resolved,
//                     { color: C.muted },
//                   ]}
//                 >
//                   This complaint is resolved. Start a new
//                   complaint if you need more help.
//                 </Text>
//               )}
//             </>
//           ) : newComplaint ? (
//             <View style={styles.newForm}>
//               <Pressable
//                 onPress={() => setNewComplaint(false)}
//                 style={styles.back}
//               >
//                 <Ionicons
//                   name="arrow-back"
//                   size={19}
//                   color={C.blue}
//                 />
//                 <Text
//                   style={{ color: C.blue, fontWeight: '700' }}
//                 >
//                   Back to complaints
//                 </Text>
//               </Pressable>

//               <Text style={[styles.label, { color: C.text }]}>
//                 What do you need help with?
//               </Text>

//               <TextInput
//                 value={subject}
//                 onChangeText={setSubject}
//                 placeholder="Complaint subject"
//                 placeholderTextColor={C.muted}
//                 maxLength={150}
//                 style={[
//                   styles.field,
//                   {
//                     color: C.text,
//                     borderColor: C.border,
//                     backgroundColor: C.white,
//                   },
//                 ]}
//               />

//               <Text style={[styles.label, { color: C.text }]}>
//                 Category
//               </Text>

//               <View style={styles.categories}>
//                 {[
//                   'Investment',
//                   'ROI payment',
//                   'Account access',
//                   'Other',
//                 ].map((item) => (
//                   <Pressable
//                     key={item}
//                     onPress={() => setCategory(item)}
//                     style={[
//                       styles.category,
//                       {
//                         borderColor:
//                           category === item ? C.blue : C.border,
//                         backgroundColor:
//                           category === item
//                             ? C.blue + '18'
//                             : C.white,
//                       },
//                     ]}
//                   >
//                     <Text
//                       style={{
//                         color:
//                           category === item ? C.blue : C.text,
//                         fontSize: 12,
//                         fontWeight: '600',
//                       }}
//                     >
//                       {item}
//                     </Text>
//                   </Pressable>
//                 ))}
//               </View>

//               <Text style={[styles.label, { color: C.text }]}>
//                 Describe your complaint
//               </Text>

//               <TextInput
//                 value={draft}
//                 onChangeText={setDraft}
//                 placeholder="Please explain how we can help…"
//                 placeholderTextColor={C.muted}
//                 multiline
//                 maxLength={5000}
//                 textAlignVertical="top"
//                 style={[
//                   styles.field,
//                   styles.longField,
//                   {
//                     color: C.text,
//                     borderColor: C.border,
//                     backgroundColor: C.white,
//                   },
//                 ]}
//               />

//               <Pressable
//                 disabled={sending}
//                 onPress={createComplaint}
//                 style={[
//                   styles.primary,
//                   {
//                     backgroundColor: C.blue,
//                     opacity: sending ? 0.6 : 1,
//                   },
//                 ]}
//               >
//                 {sending ? (
//                   <ActivityIndicator color="#FFFFFF" />
//                 ) : (
//                   <Text style={styles.primaryText}>
//                     Submit complaint
//                   </Text>
//                 )}
//               </Pressable>
//             </View>
//           ) : (
//             <>
//               <View style={styles.listHeading}>
//                 <Text
//                   style={[
//                     styles.sectionTitle,
//                     { color: C.text },
//                   ]}
//                 >
//                   Your conversations
//                 </Text>

//                 <Pressable
//                   onPress={() => {
//                     setDraft('');
//                     setSubject('');
//                     setCategory('Other');
//                     setNewComplaint(true);
//                   }}
//                   style={[
//                     styles.primarySmall,
//                     { backgroundColor: C.blue },
//                   ]}
//                 >
//                   <Ionicons
//                     name="add"
//                     size={17}
//                     color="#FFFFFF"
//                   />
//                   <Text style={styles.primaryText}>
//                     New complaint
//                   </Text>
//                 </Pressable>
//               </View>

//               {loading ? (
//                 <ActivityIndicator
//                   style={{ marginTop: 35 }}
//                   color={C.blue}
//                 />
//               ) : (
//                 <FlatList
//                   data={conversations}
//                   keyExtractor={(item) => item.id}
//                   contentContainerStyle={styles.list}
//                   refreshing={loading}
//                   onRefresh={loadConversations}
//                   ListEmptyComponent={
//                     <Text
//                       style={[
//                         styles.empty,
//                         { color: C.muted },
//                       ]}
//                     >
//                       No complaints yet. Tap “New complaint”
//                       to contact investor support.
//                     </Text>
//                   }
//                   renderItem={({ item }) => (
//                     <Pressable
//                       onPress={() => {
//                         setSelected(item);
//                         setMessages([]);
//                         void loadMessages(item);
//                       }}
//                       style={[
//                         styles.conversation,
//                         {
//                           backgroundColor: C.white,
//                           borderColor: C.border,
//                         },
//                       ]}
//                     >
//                       <View style={{ flex: 1 }}>
//                         <Text
//                           style={[
//                             styles.subject,
//                             { color: C.text },
//                           ]}
//                         >
//                           {item.subject}
//                         </Text>

//                         <Text
//                           style={[
//                             styles.sub,
//                             { color: C.muted },
//                           ]}
//                         >
//                           {item.category} ·{' '}
//                           {new Date(
//                             item.updated_at,
//                           ).toLocaleDateString()}
//                         </Text>
//                       </View>

//                       <View
//                         style={[
//                           styles.status,
//                           {
//                             backgroundColor:
//                               item.status === 'resolved'
//                                 ? '#DDF7E8'
//                                 : '#E6EEFF',
//                           },
//                         ]}
//                       >
//                         <Text
//                           style={{
//                             color:
//                               item.status === 'resolved'
//                                 ? '#17683A'
//                                 : '#2454A6',
//                             fontSize: 10,
//                             fontWeight: '800',
//                           }}
//                         >
//                           {statusLabel(item.status)}
//                         </Text>
//                       </View>
//                     </Pressable>
//                   )}
//                 />
//               )}
//             </>
//           )}
//         </KeyboardAvoidingView>
//       </Modal>
//     </>
//   );
// }

// const styles = StyleSheet.create({
//   bubble: {
//     position: 'absolute',
//     right: 17,
//     bottom: 116,
//     width: 54,
//     height: 54,
//     borderRadius: 27,
//     alignItems: 'center',
//     justifyContent: 'center',
//     zIndex: 999,
//     elevation: 9,
//     borderWidth: 2,
//     shadowColor: '#000',
//     shadowOpacity: 0.18,
//     shadowRadius: 7,
//     shadowOffset: { width: 0, height: 3 },
//   },
//   modal: { flex: 1 },
//   header: {
//     paddingTop: Platform.OS === 'ios' ? 20 : 16,
//     paddingHorizontal: 18,
//     paddingBottom: 15,
//     borderBottomWidth: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 12,
//   },
//   title: { fontSize: 20, fontWeight: '900' },
//   sub: { fontSize: 12, marginTop: 4 },
//   close: {
//     width: 38,
//     height: 38,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   conversationHead: {
//     padding: 15,
//     borderBottomWidth: 1,
//     gap: 5,
//   },
//   back: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 7,
//     marginBottom: 6,
//   },
//   subject: { fontSize: 15, fontWeight: '800' },
//   messages: { padding: 15, gap: 12, flexGrow: 1 },
//   messageRow: { flexDirection: 'row' },
//   message: {
//     maxWidth: '88%',
//     borderWidth: 1,
//     borderRadius: 15,
//     padding: 12,
//   },
//   empty: {
//     textAlign: 'center',
//     padding: 28,
//     fontSize: 13,
//     lineHeight: 20,
//   },
//   composer: {
//     flexDirection: 'row',
//     alignItems: 'flex-end',
//     gap: 9,
//     padding: 12,
//     borderTopWidth: 1,
//   },
//   input: {
//     flex: 1,
//     maxHeight: 110,
//     minHeight: 44,
//     borderWidth: 1,
//     borderRadius: 13,
//     paddingHorizontal: 12,
//     paddingVertical: 10,
//     fontSize: 14,
//   },
//   send: {
//     width: 44,
//     height: 44,
//     borderRadius: 13,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   resolved: {
//     textAlign: 'center',
//     padding: 16,
//     fontSize: 12,
//   },
//   newForm: { flex: 1, padding: 18, gap: 12 },
//   label: { fontSize: 13, fontWeight: '800', marginTop: 4 },
//   field: {
//     borderWidth: 1,
//     borderRadius: 12,
//     padding: 12,
//     fontSize: 14,
//   },
//   longField: { minHeight: 150 },
//   categories: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 8,
//   },
//   category: {
//     borderWidth: 1,
//     borderRadius: 20,
//     paddingVertical: 8,
//     paddingHorizontal: 11,
//   },
//   primary: {
//     minHeight: 46,
//     borderRadius: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//     padding: 12,
//     marginTop: 5,
//   },
//   primarySmall: {
//     borderRadius: 10,
//     paddingHorizontal: 11,
//     paddingVertical: 9,
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//   },
//   primaryText: {
//     color: '#FFFFFF',
//     fontWeight: '800',
//     fontSize: 12,
//   },
//   listHeading: {
//     padding: 16,
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     gap: 10,
//   },
//   sectionTitle: { fontSize: 16, fontWeight: '900' },
//   list: { paddingHorizontal: 15, paddingBottom: 30, gap: 10, flexGrow: 1 },
//   conversation: {
//     borderWidth: 1,
//     borderRadius: 14,
//     padding: 14,
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 10,
//   },
//   status: {
//     borderRadius: 18,
//     paddingVertical: 6,
//     paddingHorizontal: 8,
//   },
// });
