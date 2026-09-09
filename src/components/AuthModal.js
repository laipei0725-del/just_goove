import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = { bg: '#171717', line: '#343434', text: '#F4F4F2', muted: '#A0A09B', lime: '#C8FF35' };

export default function AuthModal({ visible, onClose, onAuthenticated, contextMessage, signInWithEmail, signUpWithEmail, signInWithGoogle, onContinueGuest }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signIn');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    if (!email.trim() || password.length < 6) return setMessage('請輸入 Email，密碼至少 6 碼。');
    setBusy(true); setMessage('');
    const result = await (mode === 'signIn' ? signInWithEmail?.(email.trim(), password) : signUpWithEmail?.(email.trim(), password));
    setBusy(false);
    if (result?.error) setMessage(result.error.message);
    else if (mode === 'signUp') setMessage('註冊完成，請查看信箱確認帳號。');
    else (onAuthenticated || onClose)?.();
  };
  const google = async () => {
    setBusy(true); setMessage('');
    const result = await signInWithGoogle?.();
    setBusy(false);
    if (result?.error) setMessage(result.error.message);
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.card}><View style={styles.header}><View><Text style={styles.kicker}>JUST GROOVE ACCOUNT</Text><Text style={styles.title}>{mode === 'signIn' ? '登入同步專案' : '建立舞者帳號'}</Text></View><Pressable onPress={onClose}><Ionicons name="close" size={24} color={C.text} /></Pressable></View>{contextMessage ? <View style={styles.contextNotice}><Ionicons name="lock-closed-outline" size={17} color={C.lime} /><Text style={styles.contextText}>{contextMessage}</Text></View> : null}<TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#69696D" autoCapitalize="none" keyboardType="email-address" style={styles.input} /><TextInput value={password} onChangeText={setPassword} placeholder="密碼（至少 6 碼）" placeholderTextColor="#69696D" secureTextEntry style={styles.input} /><Text style={styles.message}>{message}</Text><Pressable style={styles.primary} onPress={submit} disabled={busy}><Text style={styles.primaryText}>{busy ? '處理中…' : mode === 'signIn' ? 'Email 登入' : 'Email 註冊'}</Text></Pressable><Pressable style={styles.google} onPress={google} disabled={busy}><Ionicons name="logo-google" size={18} color={C.text} /><Text style={styles.googleText}>使用 Google 一鍵登入</Text></Pressable><Pressable onPress={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setMessage(''); }}><Text style={styles.switch}>{mode === 'signIn' ? '第一次使用？建立帳號' : '已有帳號？返回登入'}</Text></Pressable><Pressable style={styles.guest} onPress={() => { onContinueGuest?.(); onClose?.(); }}><Text style={styles.guestText}>先以訪客模式使用</Text></Pressable><Text style={styles.note}>登入後會同步專案與影片設定；訪客資料只保存在此裝置。</Text></View></KeyboardAvoidingView></Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.78)', alignItems: 'center', justifyContent: 'center', padding: 16 }, card: { width: '100%', maxWidth: 460, backgroundColor: C.bg, borderRadius: 26, padding: 22, borderWidth: 1, borderColor: C.line }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }, kicker: { color: C.lime, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, title: { color: C.text, fontSize: 23, fontWeight: '800', marginTop: 8 }, contextNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 14, backgroundColor: '#20281A', borderWidth: 1, borderColor: '#4B6421', marginBottom: 4 }, contextText: { flex: 1, color: C.text, fontSize: 12, lineHeight: 18 }, input: { minHeight: 52, borderRadius: 15, backgroundColor: '#111', borderWidth: 1, borderColor: '#383838', color: C.text, paddingHorizontal: 15, marginTop: 10 }, message: { minHeight: 20, color: '#FFB5B5', fontSize: 12, marginTop: 8 }, primary: { minHeight: 52, borderRadius: 15, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, primaryText: { color: '#0D0D0D', fontWeight: '800' }, google: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: '#4A4A4A', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, googleText: { color: C.text, fontWeight: '700' }, switch: { color: C.lime, textAlign: 'center', marginTop: 18, fontSize: 13 }, guest: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, guestText: { color: C.muted, fontSize: 12 }, note: { color: C.muted, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 10 } });
