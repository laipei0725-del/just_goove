import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Image } from 'expo-image';
import { videoFilmstrip } from '../utils/videoFilmstrip';
const { clamp, movePoint, preciseTime } = require('../utils/practiceRange.cjs');

export default function RangeEditor({ min, max, a, b, source, player, fps, onFpsChange, onChange, position }) {
  const [target, setTarget] = useState('a');
  const [zoom, setZoom] = useState(1);
  const [windowStart, setWindowStart] = useState(min);
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [frameError, setFrameError] = useState(false);
  const [width, setWidth] = useState(1);
  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const latest = useRef(null);
  const youtube = source?.type === 'youtube';
  const span = Math.max(1 / fps, max - min);
  const visibleSpan = Math.min(span, Math.max(1 / fps * 8, span / zoom));
  const start = clamp(windowStart, min, Math.max(min, max - visibleSpan));
  const end = Math.min(max, start + visibleSpan);
  const selected = target === 'a' ? a : b;
  const xFor = (value) => clamp((value - start) / visibleSpan, 0, 1) * width;
  const move = (point, value) => {
    const next = movePoint({ a, b, target: point, value, min, max, fps });
    setTarget(point);
    onChange(next, point);
  };
  latest.current = { move, start, visibleSpan, width, a, b };

  useEffect(() => {
    if (youtube || !source?.uri || max <= min) return undefined;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setFrames([]);
    setFrameError(false);
    const timer = setTimeout(async () => {
      const times = Array.from({ length: 10 }, (_, i) => start + (end - start) * i / 10);
      try {
        const images = Platform.OS === 'web'
          ? await videoFilmstrip(source.uri, times, controller.signal)
          : await player.generateThumbnailsAsync(times, { maxWidth: 200, maxHeight: 120 });
        if (active) { setFrames(images); setLoading(false); }
      } catch {
        if (active) { setLoading(false); setFrameError(true); }
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [youtube, source?.uri, player, start, end, min, max]);

  const focus = (point) => {
    setTarget(point);
    const value = point === 'a' ? a : b;
    setWindowStart(clamp(value - visibleSpan / 2, min, max - visibleSpan));
    onChange({ a, b }, point);
  };
  const step = (direction) => {
    const next = movePoint({ a, b, target, value: selected + direction / fps, min, max, fps });
    const value = target === 'a' ? next.a : next.b;
    if (value < start || value > end) setWindowStart(clamp(value - visibleSpan / 2, min, max - visibleSpan));
    onChange(next, target);
  };
  const pointerX = (event) => event.clientX ?? event.nativeEvent?.clientX ?? event.nativeEvent?.pageX;
  const pointerDown = (event, point) => {
    event.stopPropagation();
    const rect = trackRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    const x = pointerX(event);
    const value = start + clamp((x - rect.left) / rect.width, 0, 1) * visibleSpan;
    const active = point || target;
    dragRef.current = { point: active, x, base: point ? (point === 'a' ? a : b) : value, span: visibleSpan, width: rect.width };
    event.currentTarget.setPointerCapture?.(event.pointerId ?? event.nativeEvent?.pointerId);
    if (!point) move(active, value);
    else setTarget(active);
  };
  const pointerMove = (event) => {
    const drag = dragRef.current;
    if (drag) latest.current.move(drag.point, drag.base + (pointerX(event) - drag.x) / drag.width * drag.span);
  };
  const pointerEnd = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId ?? event.nativeEvent?.pointerId);
    dragRef.current = null;
  };
  const nativeResponder = (point) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      const current = latest.current;
      dragRef.current = { point, base: point === 'a' ? current.a : current.b, span: current.visibleSpan, width: current.width };
      setTarget(point);
    },
    onPanResponderMove: (_, gesture) => {
      const drag = dragRef.current;
      if (drag) latest.current.move(point, drag.base + gesture.dx / drag.width * drag.span);
    },
    onPanResponderRelease: () => { dragRef.current = null; },
  });
  const aResponder = useRef(nativeResponder('a')).current;
  const bResponder = useRef(nativeResponder('b')).current;
  const webHandlers = (point) => ({ onPointerDown: (event) => pointerDown(event, point), onPointerMove: pointerMove, onPointerUp: pointerEnd, onPointerCancel: pointerEnd });
  return <View style={s.editor}>
    <View style={s.row}>
      {[['a', 'A · 起點', a], ['b', 'B · 終點', b]].map(([point, label, value]) => <Pressable key={point} accessibilityLabel={`選擇${point.toUpperCase()}點`} onPress={() => focus(point)} style={[s.point, target === point && s.pointActive]}>
        <Text style={s.muted}>{label}</Text><Text style={s.time}>{preciseTime(value)}</Text>
      </Pressable>)}
    </View>
    <View style={s.between}><Text style={s.muted}>選取 {(b - a).toFixed(3)} 秒</Text><Text style={s.muted}>{youtube ? '時間定位' : '影格縮圖'} · {zoom}×</Text></View>
    <View ref={trackRef} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={s.track} {...(Platform.OS === 'web' ? webHandlers(null) : {})}>
      <View pointerEvents="none" style={s.filmstrip}>
        {frames.length ? frames.map((frame, i) => <Image key={i} source={frame} style={s.frame} contentFit="cover" />) : Array.from({ length: 10 }, (_, i) => <View key={i} style={s.tick} />)}
      </View>
      <View pointerEvents="none" style={[s.selection, { left: xFor(a), width: Math.max(0, xFor(b) - xFor(a)) }]} />
      {position >= start && position <= end && <View pointerEvents="none" style={[s.cursor, { left: xFor(position) }]} />}
      {loading && <View pointerEvents="none" style={s.loading}><ActivityIndicator color="#C8FF35" /></View>}
      {[['a', a], ['b', b]].map(([point, value]) => value >= start - 0.0001 && value <= end + 0.0001 && <View key={point} accessibilityRole="adjustable" accessibilityLabel={`${point.toUpperCase()}點拖曳把手`} style={[s.handle, point === 'b' && s.handleB, { left: clamp(xFor(value) - 16, -8, width - 24) }]} {...(Platform.OS === 'web' ? webHandlers(point) : (point === 'a' ? aResponder : bResponder).panHandlers)}><Text style={s.handleText}>{point.toUpperCase()}</Text></View>)}
    </View>
    <View style={s.between}>{[start, (start + end) / 2, end].map((value, i) => <Text key={i} style={s.tickLabel}>{value.toFixed(2)}s</Text>)}</View>
    {zoom > 1 && <Slider accessibilityLabel="移動時間軸視窗" minimumValue={min} maximumValue={Math.max(min, max - visibleSpan)} value={start} onValueChange={setWindowStart} minimumTrackTintColor="#C8FF35" thumbTintColor="#F4F4F2" />}
    <View style={s.between}>
      <Text style={s.muted}>時間軸放大</Text><View style={s.row}>{[1, 4, 16, 64].map((value) => <Pressable accessibilityLabel={`時間軸放大${value}倍`} key={value} style={[s.pill, zoom === value && s.pillActive]} onPress={() => { setZoom(value); setWindowStart(clamp(selected - span / value / 2, min, Math.max(min, max - span / value))); }}><Text style={s.text}>{value}×</Text></Pressable>)}</View>
    </View>
    <View style={s.between}><Text style={s.muted}>微調步長</Text><View style={s.row}>{[24, 30, 60].map((value) => <Pressable key={value} accessibilityLabel={`${value}fps微調`} style={[s.pill, fps === value && s.pillActive]} onPress={() => onFpsChange(value)}><Text style={s.text}>1/{value}s</Text></Pressable>)}</View></View>
    <View style={s.row}>
      <Pressable style={s.step} accessibilityLabel="往前微調一格" onPress={() => step(-1)}><Text style={s.text}>− {youtube ? '一步' : '一格'}</Text></Pressable>
      <Text style={[s.muted, { flex: 1, textAlign: 'center' }]}>{target.toUpperCase()} · {preciseTime(selected)}</Text>
      <Pressable style={s.step} accessibilityLabel="往後微調一格" onPress={() => step(1)}><Text style={s.text}>＋ {youtube ? '一步' : '一格'}</Text></Pressable>
    </View>
    <Text style={s.note}>{youtube ? '拖曳時在上方影片預覽；YouTube 定位可能落在鄰近影格。' : frameError ? '此影片暫時無法擷取縮圖；仍可拖曳並在上方預覽。' : '拖曳或微調會暫停並預覽。步長不會改變原片幀率。'}</Text>
  </View>;
}
const s = StyleSheet.create({
  editor: { gap: 10 }, row: { flexDirection: 'row', alignItems: 'center', gap: 6 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  point: { flex: 1, backgroundColor: '#252525', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#424242' }, pointActive: { borderColor: '#C8FF35' },
  muted: { color: '#BBBDB5', fontSize: 11 }, time: { color: '#F4F4F2', fontFamily: 'JetBrainsMono', fontSize: 17, marginTop: 5 }, text: { color: '#F4F4F2', fontSize: 12 },
  track: { height: 68, marginTop: 2, touchAction: 'none' }, filmstrip: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', overflow: 'hidden', borderRadius: 8, backgroundColor: '#30322B' }, frame: { flex: 1, height: '100%' }, tick: { flex: 1, borderLeftWidth: 1, borderColor: '#63665A' },
  selection: { position: 'absolute', top: 0, bottom: 0, borderWidth: 2, borderColor: '#C8FF35', backgroundColor: 'rgba(200,255,53,0.12)' }, cursor: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'white' }, loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  handle: { position: 'absolute', top: -4, bottom: -4, width: 32, backgroundColor: '#C8FF35', borderRadius: 8, alignItems: 'center', justifyContent: 'center', touchAction: 'none' }, handleB: { backgroundColor: '#F4F4F2' }, handleText: { color: '#0D0D0D', fontWeight: 'bold' }, tickLabel: { color: '#BBBDB5', fontSize: 10, fontFamily: 'JetBrainsMono' },
  pill: { paddingHorizontal: 9, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#292929', borderWidth: 1, borderColor: '#444' }, pillActive: { borderColor: '#C8FF35' }, step: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#30322B', borderRadius: 10 }, note: { color: '#9A9D91', fontSize: 11, lineHeight: 17 },
});
