import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';

const LOGO = require('../../assets/icon.png');

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, ready, signInWithEmail, signUpWithEmail } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  useEffect(() => { if (ready && user) navigation.replace('Home'); }, [navigation, ready, user]);

  return <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
    <View style={styles.glow} />
    <Animated.View style={[styles.hero, { opacity, transform: [{ translateY }] }]}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="JUST GROOVE 品牌標誌" />
      <Text style={styles.title}>JUST GROOVE</Text>
      <Text style={styles.slogan}>選一段，開始練</Text>
      <Text style={styles.subtitle}>專為舞者設計的智慧練舞與錄影比對平台</Text>
      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={() => setAuthOpen(true)}><Text style={styles.primaryText}>立即登入 / 開始練舞</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => navigation.replace('Home')}><Text style={styles.secondaryText}>訪客快速試用</Text></Pressable>
      </View>
      <Text style={styles.note}>訪客可瀏覽介面；登入後才能新增並同步練舞專案。</Text>
    </Animated.View>
    <AuthModal visible={authOpen} onClose={() => setAuthOpen(false)} onContinueGuest={() => { setAuthOpen(false); navigation.replace('Home'); }} signInWithEmail={signInWithEmail} signUpWithEmail={signUpWithEmail} />
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, overflow: 'hidden', backgroundColor: '#090909', paddingHorizontal: 22 }, glow: { position: 'absolute', width: 360, height: 360, borderRadius: 180, top: '12%', alignSelf: 'center', backgroundColor: 'rgba(200,255,53,.13)', ...(Platform.OS === 'web' ? { filter: 'blur(72px)' } : {}) }, hero: { flex: 1, maxWidth: 620, width: '100%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, logo: { width: 128, height: 128, marginBottom: 25 }, title: { color: '#C8FF35', fontSize: 38, lineHeight: 46, fontWeight: '900', letterSpacing: 4, textAlign: 'center' }, slogan: { color: '#F4F4F2', fontSize: 25, fontWeight: '800', marginTop: 12 }, subtitle: { color: '#A0A09B', fontSize: 15, lineHeight: 24, textAlign: 'center', marginTop: 14 }, actions: { width: '100%', maxWidth: 420, gap: 12, marginTop: 42 }, primary: { minHeight: 56, borderRadius: 18, backgroundColor: '#C8FF35', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#0D0D0D', fontWeight: '900', fontSize: 15 }, secondary: { minHeight: 54, borderRadius: 18, borderWidth: 1, borderColor: '#C8FF35', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#C8FF35', fontWeight: '800', fontSize: 14 }, note: { color: '#73736F', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 20 } });
