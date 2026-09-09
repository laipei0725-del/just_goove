import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

const SEEN_KEY = 'just-groove:brand-intro-seen';

export default function BrandIntroOverlay() {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.78)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let seen = false;
    try { seen = Boolean(globalThis?.sessionStorage?.getItem(SEEN_KEY)); } catch {}
    if (seen) return undefined;
    try { globalThis?.sessionStorage?.setItem(SEEN_KEY, '1'); } catch {}
    setVisible(true);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(580),
      Animated.timing(opacity, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]).start(() => setVisible(false));
    return undefined;
  }, [glow, opacity, scale]);

  if (!visible) return null;
  return <Animated.View pointerEvents="none" style={[styles.overlay, { opacity }]}>
    <Animated.View style={[styles.glow, { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.2] }) }] }]} />
    <Animated.View style={{ transform: [{ scale }] }}><Text style={styles.mark}>JG</Text><Text style={styles.wordmark}>JUST GROOVE</Text><Text style={styles.tagline}>MOVE WITH YOUR OWN RHYTHM</Text></Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, backgroundColor: '#090909', alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#C8FF35', opacity: 0.28, ...(Platform.OS === 'web' ? { filter: 'blur(42px)' } : {}) },
  mark: { color: '#C8FF35', fontSize: 74, fontWeight: '900', letterSpacing: -6, textAlign: 'center' },
  wordmark: { color: '#F4F4F2', fontSize: 22, fontWeight: '800', letterSpacing: 4, textAlign: 'center', marginTop: 12 },
  tagline: { color: '#9A9A96', fontSize: 9, letterSpacing: 2.4, textAlign: 'center', marginTop: 9 },
});
