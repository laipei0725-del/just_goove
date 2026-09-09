import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const C = { lime: '#C8FF35', bg: '#171717', text: '#F4F4F2', muted: '#B5B5AF' };
const STEPS = [
  ['新增練舞專案', '點此上傳影片或貼上 YouTube 連結，建立新的練習。'],
  ['專案卡片與選單', '在卡片上開啟影片；︙選單可以置頂、改名或刪除。'],
  ['練習工具列', '進入專案後可調整速度、鏡像、AB 循環與桌面版錄影。'],
];

export default function OnboardingOverlay({ userId = 'guest', visible, onClose }) {
  const key = `hasSeenOnboarding:${userId}`;
  const [step, setStep] = useState(0);
  useEffect(() => { if (visible) setStep(0); }, [visible]);
  const finish = () => { try { globalThis?.localStorage?.setItem(key, 'true'); } catch {} onClose?.(); };
  if (!visible) return null;
  const [title, copy] = STEPS[step];
  return <Modal visible transparent animationType="fade" onRequestClose={finish}><View style={styles.backdrop}><View style={styles.card}><View style={styles.progress}>{STEPS.map((_, index) => <View key={index} style={[styles.dot, index === step && styles.dotActive]} />)}</View><Text style={styles.kicker}>JUST GROOVE · 快速導覽</Text><Text style={styles.title}>{title}</Text><Text style={styles.copy}>{copy}</Text><View style={styles.actions}><Pressable onPress={finish}><Text style={styles.skip}>跳過引導</Text></Pressable><Pressable style={styles.next} onPress={() => step === STEPS.length - 1 ? finish() : setStep((value) => value + 1)}><Text style={styles.nextText}>{step === STEPS.length - 1 ? '開始練習' : '下一步'}</Text></Pressable></View></View></View></Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.74)', justifyContent: 'flex-end', padding: 16 }, card: { backgroundColor: C.bg, borderRadius: 26, padding: 22, borderWidth: 1, borderColor: '#3A3A3A' }, progress: { flexDirection: 'row', gap: 6, marginBottom: 20 }, dot: { height: 4, flex: 1, borderRadius: 4, backgroundColor: '#3A3A3A' }, dotActive: { backgroundColor: C.lime }, kicker: { color: C.lime, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, title: { color: C.text, fontSize: 23, fontWeight: '800', marginTop: 12 }, copy: { color: C.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }, actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25 }, skip: { color: C.muted, fontSize: 13 }, next: { backgroundColor: C.lime, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 14 }, nextText: { color: '#0D0D0D', fontWeight: '800' } });
