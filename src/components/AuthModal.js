import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = { bg: '#171717', line: '#343434', text: '#F4F4F2', muted: '#A0A09B', lime: '#C8FF35' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const friendlyAuthError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('already registered') || message.includes('already been registered') || message.includes('user already exists')) return '這個 Email 已經註冊，請直接登入。';
  if (message.includes('password') && (message.includes('short') || message.includes('least') || message.includes('weak'))) return '密碼強度不足，請至少輸入 6 碼。';
  if (message.includes('invalid login credentials')) return 'Email 或密碼不正確。';
  if (message.includes('invalid') && message.includes('email')) return 'Email 格式不正確。';
  if (message.includes('rate limit') || message.includes('too many')) return '嘗試次數過多，請稍後再試。';
  return error?.message || '認證服務暫時無法使用，請稍後再試。';
};

export default function AuthModal({ visible, onClose, onAuthenticated, contextMessage, signInWithEmail, signUpWithEmail, signInWithGoogle, onContinueGuest }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState('signIn');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    const cleanEmail = email.trim();
    const cleanUsername = username.trim();
    setSuccess(false);
    if (mode === 'signUp' && !cleanUsername) return setMessage('請輸入名稱或使用者名稱。');
    if (!EMAIL_PATTERN.test(cleanEmail)) return setMessage('請輸入正確的 Email 格式。');
    if (password.length < 6) return setMessage('密碼至少需要 6 碼。');
    if (mode === 'signUp' && password !== confirmPassword) return setMessage('兩次輸入的密碼不一致。');

    setBusy(true);
    setMessage('');
    try {
      if (mode === 'signIn') {
        const result = await signInWithEmail?.(cleanEmail, password);
        if (result?.error) return setMessage(friendlyAuthError(result.error));
        (onAuthenticated || onClose)?.();
        return;
      }

      const result = await signUpWithEmail?.(cleanUsername, cleanEmail, password);
      if (result?.error) return setMessage(friendlyAuthError(result.error));
      if (result?.data?.user?.identities?.length === 0) return setMessage('這個 Email 已經註冊，請直接登入。');
      if (result?.data?.session) {
        (onAuthenticated || onClose)?.();
        return;
      }
      setSuccess(true);
      setMessage('驗證信已寄出，請至信箱點擊連結後再登入。');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode((current) => current === 'signIn' ? 'signUp' : 'signIn');
    setMessage('');
    setSuccess(false);
    setConfirmPassword('');
  };

  const google = async () => {
    setBusy(true); setMessage(''); setSuccess(false);
    try {
      const result = await signInWithGoogle?.();
      if (result?.error) setMessage(friendlyAuthError(result.error));
    } catch (error) { setMessage(friendlyAuthError(error)); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.heading}><Text maxFontSizeMultiplier={1.2} style={styles.kicker}>JUST GROOVE ACCOUNT</Text><Text maxFontSizeMultiplier={1.25} style={styles.title}>{mode === 'signIn' ? '登入同步專案' : '建立舞者帳號'}</Text></View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="關閉登入視窗"><Ionicons name="close" size={24} color={C.text} /></Pressable>
            </View>
            {contextMessage ? <View style={styles.contextNotice}><Ionicons name="lock-closed-outline" size={17} color={C.lime} /><Text maxFontSizeMultiplier={1.25} style={styles.contextText}>{contextMessage}</Text></View> : null}
            {mode === 'signUp' ? <TextInput value={username} onChangeText={setUsername} placeholder="名稱 / 使用者名稱" placeholderTextColor="#69696D" autoCapitalize="words" autoComplete="name" style={styles.input} /> : null}
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#69696D" autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" style={styles.input} />
            <TextInput value={password} onChangeText={setPassword} placeholder="密碼（至少 6 碼）" placeholderTextColor="#69696D" secureTextEntry autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} style={styles.input} />
            {mode === 'signUp' ? <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="再次輸入密碼" placeholderTextColor="#69696D" secureTextEntry autoComplete="new-password" style={styles.input} /> : null}
            <Text accessibilityRole={message ? 'alert' : undefined} maxFontSizeMultiplier={1.25} style={[styles.message, success && styles.success]}>{message}</Text>
            <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={submit} disabled={busy}><Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.primaryText}>{busy ? '處理中…' : mode === 'signIn' ? 'Email 登入' : '建立帳號'}</Text></Pressable>
            <Pressable style={({ pressed }) => [styles.google, pressed && styles.pressed]} onPress={google} disabled={busy}><Ionicons name="logo-google" size={18} color={C.text} /><Text style={styles.googleText}>使用 Google 一鍵登入</Text></Pressable>
            <Pressable onPress={switchMode}><Text maxFontSizeMultiplier={1.2} style={styles.switch}>{mode === 'signIn' ? '第一次使用？建立帳號' : '已有帳號？返回登入'}</Text></Pressable>
            <Pressable style={styles.guest} onPress={onContinueGuest}><Text maxFontSizeMultiplier={1.2} style={styles.guestText}>先以訪客模式使用</Text></Pressable>
            <Text maxFontSizeMultiplier={1.2} style={styles.note}>登入後會同步專案與影片設定；訪客資料只保存在此裝置。</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.78)' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 460, backgroundColor: C.bg, borderRadius: 26, padding: 22, borderWidth: 1, borderColor: C.line },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  heading: { flex: 1, paddingRight: 12 },
  kicker: { color: C.lime, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: C.text, fontSize: 23, lineHeight: 30, fontWeight: '800', marginTop: 8 },
  contextNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 14, backgroundColor: '#20281A', borderWidth: 1, borderColor: '#4B6421', marginBottom: 4 },
  contextText: { flex: 1, color: C.text, fontSize: 12, lineHeight: 18 },
  input: { minHeight: 52, borderRadius: 15, backgroundColor: '#111', borderWidth: 1, borderColor: '#383838', color: C.text, fontSize: 16, paddingHorizontal: 15, marginTop: 10 },
  message: { minHeight: 20, color: '#FFB5B5', fontSize: 12, lineHeight: 18, marginTop: 8 },
  success: { color: C.lime },
  primary: { minHeight: 52, borderRadius: 15, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 8 },
  pressed: { opacity: 0.8 },
  primaryText: { color: '#0D0D0D', fontWeight: '800', fontSize: 14 },
  google: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: '#4A4A4A', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  googleText: { color: C.text, fontWeight: '700' },
  switch: { color: C.lime, textAlign: 'center', marginTop: 18, fontSize: 13, lineHeight: 20 },
  guest: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  guestText: { color: C.muted, fontSize: 12 },
  note: { color: C.muted, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 10 },
});
