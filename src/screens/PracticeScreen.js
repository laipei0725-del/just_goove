import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEvent } from 'expo';
import { useKeepAwake } from 'expo-keep-awake';
import { useVideoPlayer, VideoView } from 'expo-video';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProjects } from '../store/ProjectContext';

const C = { bg: '#0D0D0D', panel: '#1B1B1B', line: '#343434', lime: '#C8FF35', text: '#F4F4F2', muted: '#99999E', danger: '#FF6868' };
const YT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const finiteNumber = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const tenth = (value) => Math.round(finiteNumber(value) * 10) / 10;
const time = (value) => { const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`; };
const abTime = (value) => { const safe = Math.max(0, tenth(value)); return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}.${Math.round((safe % 1) * 10)}`; };

function ABTimeline({ min, max, a, b, onAChange, onBChange }) {
  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  const range = Math.max(0.1, max - min);
  const visualA = a == null ? min : a;
  const visualB = b == null ? max : b;
  const xFor = useCallback((value) => ((Math.max(min, Math.min(value, max)) - min) / range) * width, [min, max, range, width]);
  const valueFor = useCallback((x) => tenth(min + (Math.max(0, Math.min(x, width)) / Math.max(1, width)) * range), [min, range, width]);
  const createHandle = (value, onChange) => useMemo(() => {
    const startX = { current: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startX.current = xFor(value); },
      onPanResponderMove: (_, gesture) => onChange(valueFor(startX.current + gesture.dx)),
    });
  }, [onChange, value, valueFor, xFor]);
  const aResponder = createHandle(visualA, onAChange);
  const bResponder = createHandle(visualB, onBChange);
  const aX = xFor(visualA);
  const bX = xFor(visualB);
  const rangeLeft = Math.min(aX, bX);
  const rangeWidth = Math.abs(bX - aX);
  return <View style={styles.abTimeline} onLayout={(event) => { const next = event.nativeEvent.layout.width; widthRef.current = next; setWidth(next); }}>
    <Pressable style={styles.abTimelineTouch} onPress={(event) => {
      const value = valueFor(event.nativeEvent.locationX);
      if (Math.abs(value - visualA) <= Math.abs(value - visualB)) onAChange(value);
      else onBChange(value);
    }} />
    <View style={styles.abTrack} />
    {a != null && b != null && <View style={[styles.abRange, { left: rangeLeft, width: rangeWidth }]} />}
    <View {...aResponder.panHandlers} style={[styles.abHandle, styles.abHandleA, a == null && styles.abHandleUnset, { left: aX - 14 }]}><Text style={styles.abHandleText}>A</Text></View>
    <View {...bResponder.panHandlers} style={[styles.abHandle, styles.abHandleB, b == null && styles.abHandleUnset, { left: bX - 14 }]}><Text style={styles.abHandleText}>B</Text></View>
  </View>;
}

function ChoiceRow({ label, value, selected, onPress }) {
  return <Pressable onPress={onPress} style={styles.choice}><View><Text style={styles.choiceLabel}>{label}</Text>{value ? <Text style={styles.choiceValue}>{value}</Text> : null}</View><Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? C.lime : C.muted} /></Pressable>;
}

export default function PracticeScreen({ route, navigation }) {
  useKeepAwake('just-groove-practice');
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { projects, updateProject } = useProjects();
  const project = projects.find((item) => item.id === route.params?.projectId);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const ytRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({ writeOnly: true });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(finiteNumber(project?.speed, 1));
  const [youtubeRates, setYoutubeRates] = useState(YT_RATES);
  const [playMode, setPlayModeState] = useState(project?.playMode || 'full-loop');
  const [ytPosition, setYtPosition] = useState(finiteNumber(project?.position));
  const [ytDuration, setYtDuration] = useState(0);
  const [mirrored, setMirrored] = useState(false);
  const [videoZoom, setVideoZoom] = useState(1);
  const videoZoomRef = useRef(1);
  const pinchStartDistance = useRef(0);
  const pinchStartZoom = useRef(1);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraReadyRef = useRef(false);
  const [cameraMode, setCameraMode] = useState(project?.cameraMode || 'pip');
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [activeBookmarkId, setActiveBookmarkId] = useState(project?.bookmarks?.[0]?.id || null);
  const [draftA, setDraftA] = useState(null);
  const [draftB, setDraftB] = useState(null);
  const [abEditTarget, setAbEditTarget] = useState('a');
  const source = project?.source;
  const player = useVideoPlayer(source?.type === 'local' ? source.uri : null, (p) => {
    p.timeUpdateEventInterval = 0.2;
    if (source?.type === 'local') p.currentTime = project?.position || 0;
  });
  const { currentTime = 0 } = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const { duration = 0 } = useEvent(player, 'sourceLoad', { duration: 0, availableVideoTracks: [], availableAudioTracks: [], availableSubtitleTracks: [] });
  const activeBookmark = project?.bookmarks?.find((item) => item.id === activeBookmarkId) || null;
  // expo-video can briefly report NaN while restoring/loading a media source.
  // UIKit's native slider throws an uncaught exception when given NaN, so every
  // value crossing the JS/native boundary must be finite and internally ordered.
  const position = Math.max(0, finiteNumber(source?.type === 'youtube' ? ytPosition : currentTime));
  const total = Math.max(0, finiteNumber(source?.type === 'youtube' ? ytDuration : duration));
  const trimStart = Math.max(0, finiteNumber(project?.trimStart));
  const storedTrimEnd = finiteNumber(project?.trimEnd, 0);
  const timelineMaximum = Math.max(trimStart, storedTrimEnd > trimStart ? storedTrimEnd : total, 1);
  const timelineValue = Math.max(trimStart, Math.min(position, timelineMaximum));
  const activeAbRange = draftA != null && draftB != null ? { start: draftA, end: draftB } : activeBookmark;

  const setPlayMode = useCallback((value) => {
    setPlayModeState(value);
    if (project?.id) updateProject(project.id, { playMode: value });
  }, [project?.id, updateProject]);

  const refreshYoutubeRates = useCallback(async () => {
    if (source?.type !== 'youtube' || !ytRef.current) return;
    try {
      const available = await ytRef.current.getAvailablePlaybackRates();
      const rates = [...new Set((available || []).filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
      if (!rates.length) return;
      setYoutubeRates(rates);
      setSpeed((current) => rates.reduce((nearest, value) => Math.abs(value - current) < Math.abs(nearest - current) ? value : nearest, rates[0]));
    } catch {}
  }, [source?.type]);

  useEffect(() => {
    if (!project) navigation.goBack();
  }, [project, navigation]);

  useEffect(() => {
    player.playbackRate = speed;
    if (source?.type === 'local') playing ? player.play() : player.pause();
  }, [player, playing, source?.type, speed]);

  useEffect(() => {
    if (source?.type !== 'youtube' || !playing) return undefined;
    const timer = setInterval(async () => {
      try {
        const [nextPosition, nextDuration] = await Promise.all([ytRef.current?.getCurrentTime(), ytRef.current?.getDuration()]);
        if (Number.isFinite(nextPosition)) setYtPosition(nextPosition);
        if (Number.isFinite(nextDuration)) setYtDuration(nextDuration);
      } catch {}
    }, 250);
    return () => clearInterval(timer);
  }, [playing, source?.type]);

  useEffect(() => {
    if (!activeAbRange || playMode !== 'ab-loop' || position < activeAbRange.end) return;
    seek(activeAbRange.start);
  }, [position, activeAbRange, playMode]);

  useEffect(() => {
    if (playMode !== 'full-loop' || !total || position < total - 0.2) return;
    seek(project.trimStart || 0);
  }, [position, total, playMode, project?.trimStart]);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => setRecordSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!project?.id) return undefined;
    const timer = setTimeout(() => updateProject(project.id, { speed, position, cameraMode }), 800);
    return () => clearTimeout(timer);
  }, [project?.id, speed, position, cameraMode, updateProject]);

  useEffect(() => () => { ScreenOrientation.unlockAsync().catch(() => {}); }, []);

  const seek = useCallback((value) => {
    const requested = finiteNumber(value, trimStart);
    const bounded = Math.max(trimStart, Math.min(requested, timelineMaximum));
    if (source?.type === 'youtube') { ytRef.current?.seekTo(bounded, true); setYtPosition(bounded); }
    else player.currentTime = bounded;
  }, [player, source?.type, timelineMaximum, trimStart]);

  const applyAbPoint = useCallback((target, rawValue) => {
    const value = tenth(Math.max(trimStart, Math.min(finiteNumber(rawValue), timelineMaximum)));
    let nextA = target === 'a' ? value : draftA;
    let nextB = target === 'b' ? value : draftB;
    if (nextA != null && nextB != null && nextA > nextB) [nextA, nextB] = [nextB, nextA];
    setDraftA(nextA);
    setDraftB(nextB);
    setAbEditTarget(target === 'a' ? 'b' : 'a');
    if (nextA != null && nextB != null && nextB > nextA) setPlayMode('ab-loop');
  }, [draftA, draftB, setPlayMode, timelineMaximum, trimStart]);

  const openAbPanel = () => {
    setAbEditTarget(draftA == null ? 'a' : draftB == null ? 'b' : 'a');
    setPanelOpen(true);
  };

  const resetAB = () => {
    setDraftA(null);
    setDraftB(null);
    setAbEditTarget('a');
    setPlayMode('full-loop');
  };

  const adjustSpeed = (direction) => setSpeed((old) => {
    if (source?.type === 'youtube') {
      const rates = youtubeRates.length ? youtubeRates : YT_RATES;
      const nearest = rates.reduce((a, b) => Math.abs(b - old) < Math.abs(a - old) ? b : a);
      return rates[Math.max(0, Math.min(rates.length - 1, rates.indexOf(nearest) + direction))];
    }
    return Math.max(0.1, Math.min(2, Number((old + direction * 0.1).toFixed(1))));
  });

  const toggleCamera = async () => {
    if (!cameraVisible && !cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) return Alert.alert('需要相機權限', '請允許前鏡頭權限才能進行對照與錄影。');
    }
    setCameraVisible((value) => {
      if (value) {
        cameraReadyRef.current = false;
        setCameraReady(false);
      }
      return !value;
    });
  };

  const showPermissionAlert = (label, permission) => {
    const actions = [{ text: '取消', style: 'cancel' }];
    if (permission?.canAskAgain === false) actions.push({ text: '前往設定', onPress: () => Linking.openSettings() });
    Alert.alert(`需要${label}權限`, `請允許${label}權限才能錄影。`, actions);
  };

  const waitForCameraReady = async () => {
    const deadline = Date.now() + 6000;
    while (!cameraReadyRef.current && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return cameraReadyRef.current;
  };

  const finishRecording = async (result) => {
    if (!result?.uri || !project) return;
    try {
      const directory = `${FileSystem.documentDirectory}recordings/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const savedUri = `${directory}${project.id}-${Date.now()}.mp4`;
      await FileSystem.copyAsync({ from: result.uri, to: savedUri });
      let assetId = null;
      let permission = mediaPermission;
      if (!permission?.granted) permission = await requestMediaPermission();
      if (permission?.granted) assetId = (await MediaLibrary.createAssetAsync(savedUri)).id;
      updateProject(project.id, { recordings: [...(project.recordings || []), { id: `${Date.now()}`, uri: savedUri, assetId, duration: recordSeconds, createdAt: Date.now() }] });
      Alert.alert('錄影已保存', permission?.granted ? '已儲存在練舞專案與手機相簿。' : '已儲存在練舞專案；尚未取得相簿寫入權限。');
    } catch { Alert.alert('保存失敗', '錄影已結束，但檔案無法保存，請確認儲存空間與相簿權限。'); }
  };

  const beginRecording = async () => {
    let nextCameraPermission = cameraPermission;
    if (!nextCameraPermission?.granted) nextCameraPermission = await requestCameraPermission();
    if (!nextCameraPermission.granted) {
      showPermissionAlert('相機', nextCameraPermission);
      return;
    }

    let nextMicrophonePermission = microphonePermission;
    if (!nextMicrophonePermission?.granted) nextMicrophonePermission = await requestMicrophonePermission();
    if (!nextMicrophonePermission.granted) {
      showPermissionAlert('麥克風', nextMicrophonePermission);
      return;
    }

    if (!cameraVisible) {
      cameraReadyRef.current = false;
      setCameraReady(false);
      setCameraVisible(true);
    }
    if (!cameraReadyRef.current && !(await waitForCameraReady())) {
      Alert.alert('相機尚未就緒', '相機啟動時間過長，請關閉相機後再開啟並重試。');
      return;
    }
    setCountdown(3);
    for (let value = 3; value > 0; value -= 1) {
      setCountdown(value);
      await new Promise((resolve) => setTimeout(resolve, 850));
    }
    setCountdown(null); setRecordSeconds(0); setPlaying(true); setRecording(true);
    try {
      const result = await cameraRef.current?.recordAsync();
      await finishRecording(result);
    } catch (error) { Alert.alert('無法錄影', error?.message || '相機無法開始錄影，請關閉相機後再試一次。'); }
    finally { setRecording(false); }
  };

  const stopRecording = () => cameraRef.current?.stopRecording();
  const toggleRecording = () => recording ? stopRecording() : beginRecording();

  const addBookmark = () => {
    if (draftA == null || draftB == null || draftB <= draftA) return Alert.alert('尚未完成 AB 範圍', '請先拖曳或設定 A、B 點，且 B 必須晚於 A。');
    const nextIndex = (project.bookmarks?.length || 0) + 1;
    const bookmark = { id: `${Date.now()}`, title: `段落 ${nextIndex}`, start: draftA, end: draftB, speed };
    updateProject(project.id, { bookmarks: [...project.bookmarks, bookmark] });
    setPlayMode('ab-loop');
    setActiveBookmarkId(bookmark.id); setPlaying(true);
  };

  const selectBookmark = (bookmark) => {
    setActiveBookmarkId(bookmark.id); setDraftA(tenth(bookmark.start)); setDraftB(tenth(bookmark.end)); setAbEditTarget('a'); setSpeed(bookmark.speed); setPlayMode('ab-loop'); seek(bookmark.start); setPlaying(true);
  };

  const renameBookmark = (bookmark) => Alert.prompt('重新命名書籤', '', (title) => title?.trim() && updateProject(project.id, { bookmarks: project.bookmarks.map((item) => item.id === bookmark.id ? { ...item, title: title.trim() } : item) }), 'plain-text', bookmark.title);
  const moveBookmark = (bookmark, direction) => {
    const items = [...project.bookmarks]; const index = items.findIndex((item) => item.id === bookmark.id); const target = index + direction;
    if (target < 0 || target >= items.length) return; [items[index], items[target]] = [items[target], items[index]]; updateProject(project.id, { bookmarks: items });
  };
  const manageBookmark = (bookmark) => Alert.alert(bookmark.title, `${time(bookmark.start)}–${time(bookmark.end)} · ${bookmark.speed.toFixed(1)}x`, [
    { text: '重新命名', onPress: () => renameBookmark(bookmark) },
    { text: '更新為目前 A/B', onPress: () => draftA != null && draftB != null && updateProject(project.id, { bookmarks: project.bookmarks.map((item) => item.id === bookmark.id ? { ...item, start: draftA, end: draftB, speed } : item) }) },
    { text: '向前移', onPress: () => moveBookmark(bookmark, -1) }, { text: '向後移', onPress: () => moveBookmark(bookmark, 1) },
    { text: '複製', onPress: () => updateProject(project.id, { bookmarks: [...project.bookmarks, { ...bookmark, id: `${Date.now()}`, title: `${bookmark.title} 副本` }] }) },
    { text: '刪除', style: 'destructive', onPress: () => updateProject(project.id, { bookmarks: project.bookmarks.filter((item) => item.id !== bookmark.id) }) }, { text: '取消', style: 'cancel' },
  ]);

  const rotate = async () => {
    const current = await ScreenOrientation.getOrientationAsync();
    const landscape = current === ScreenOrientation.Orientation.LANDSCAPE_LEFT || current === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
    await ScreenOrientation.lockAsync(landscape ? ScreenOrientation.OrientationLock.PORTRAIT_UP : ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
  };
  const toggleFullscreen = () => setFullscreen((value) => !value);

  const panelPan = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 12, onPanResponderRelease: (_, gesture) => { if (gesture.dy > 70) setPanelOpen(false); } }), []);
  const videoPinch = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length === 2,
    onMoveShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length === 2,
    onPanResponderGrant: (event) => {
      const [first, second] = event.nativeEvent.touches;
      if (!first || !second) return;
      pinchStartDistance.current = Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
      pinchStartZoom.current = videoZoomRef.current;
    },
    onPanResponderMove: (event) => {
      const [first, second] = event.nativeEvent.touches;
      if (!first || !second || !pinchStartDistance.current) return;
      const distance = Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
      const nextZoom = Math.max(1, Math.min(3, pinchStartZoom.current * distance / pinchStartDistance.current));
      videoZoomRef.current = nextZoom;
      setVideoZoom(nextZoom);
    },
    onPanResponderRelease: () => { pinchStartDistance.current = 0; },
    onPanResponderTerminate: () => { pinchStartDistance.current = 0; },
  }), []);
  if (!project) return null;

  const videoFit = project.crop === 'cover' ? 'cover' : 'contain';
  const cameraStyle = cameraMode === 'split' ? styles.cameraSplit : cameraMode === 'overlay' ? styles.cameraOverlay : styles.cameraPip;
  const stageHeight = fullscreen ? height : Math.max(390, Math.min(height * 0.7, width * 1.35));

  return (
    <View style={[styles.screen, fullscreen && styles.fullscreen, { paddingTop: fullscreen ? 0 : insets.top }]}>
      {!fullscreen && <View style={styles.header}><Pressable style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityLabel="返回首頁"><Ionicons name="arrow-back" size={24} color={C.text} /></Pressable><Text numberOfLines={1} style={styles.headerTitle}>{project.title}</Text><Pressable style={styles.iconButton} onPress={() => setSettingsOpen(true)} accessibilityLabel="練舞設定"><Ionicons name="settings-outline" size={22} color={C.text} /></Pressable></View>}
      <View style={[styles.stage, { height: stageHeight, borderRadius: fullscreen ? 0 : 25 }]}>
        <View
          {...videoPinch.panHandlers}
          style={[styles.videoLayer, { transform: [{ scaleX: mirrored ? -videoZoom : videoZoom }, { scaleY: videoZoom }] }]}
          accessibilityLabel="影片畫面，可用雙指放大縮小"
        >
          {source?.type === 'local' ? <VideoView ref={videoRef} player={player} style={styles.fill} contentFit={videoFit} nativeControls={false} /> : <YoutubePlayer ref={ytRef} height="100%" width="100%" play={playing} videoId={source.id} playbackRate={speed} onReady={refreshYoutubeRates} onPlaybackRateChange={(rate) => Number.isFinite(rate) && setSpeed(rate)} onChangeState={(state) => { setPlaying(state === 'playing'); if (state === 'playing' || state === 'video cued') refreshYoutubeRates(); }} />}
        </View>
        {cameraVisible && <View style={[styles.camera, cameraStyle]}><CameraView ref={cameraRef} style={styles.fill} facing="front" mirror mode="video" active={cameraVisible} onCameraReady={() => { cameraReadyRef.current = true; setCameraReady(true); }} onMountError={(event) => { cameraReadyRef.current = false; setCameraReady(false); Alert.alert('相機啟動失敗', event.message); }} /><View style={styles.liveBadge}><Text style={styles.liveText}>{recording ? `REC ${time(recordSeconds)}` : cameraReady ? 'LIVE' : '準備中'}</Text></View></View>}
        {countdown != null && <View style={styles.countdown}><Text style={styles.countdownText}>{countdown}</Text></View>}
        <View style={styles.sideTools}>
          <Pressable style={[styles.roundTool, mirrored && styles.activeTool]} onPress={() => setMirrored((value) => !value)} accessibilityLabel="鏡像"><Ionicons name="swap-horizontal" size={21} color={mirrored ? C.bg : C.text} /></Pressable>
          <Pressable style={[styles.roundTool, cameraVisible && styles.activeTool]} onPress={toggleCamera} accessibilityLabel="開啟或關閉相機"><Ionicons name="camera-outline" size={21} color={cameraVisible ? C.bg : C.text} /></Pressable>
          <Pressable style={styles.roundTool} onPress={rotate} accessibilityLabel="切換直向或橫向"><Ionicons name="phone-landscape-outline" size={21} color={C.text} /></Pressable>
          <Pressable style={styles.roundTool} onPress={toggleFullscreen} accessibilityLabel="切換全螢幕"><Ionicons name={fullscreen ? 'contract-outline' : 'expand-outline'} size={21} color={C.text} /></Pressable>
        </View>
        <View style={styles.timeline}><Text style={styles.clock}>{time(position)}</Text><Slider style={styles.slider} minimumValue={trimStart} maximumValue={timelineMaximum} value={timelineValue} onSlidingComplete={seek} minimumTrackTintColor={C.lime} maximumTrackTintColor="#56565A" thumbTintColor={C.text} /><Text style={styles.clock}>{time(total)}</Text></View>
        <View style={styles.bottomBar}>
          <Pressable style={styles.barButton} onPress={openAbPanel}><Ionicons name="bookmark-outline" size={21} color={playMode === 'ab-loop' ? C.lime : C.text} /><Text style={styles.barLabel}>AB</Text></Pressable>
          <Pressable style={styles.barButton} onPress={toggleRecording}><Ionicons name={recording ? 'stop-circle' : 'radio-button-on'} size={25} color={recording ? C.danger : C.text} /><Text style={styles.barLabel}>{recording ? '停止' : '錄影'}</Text></Pressable>
          <Pressable style={styles.play} onPress={() => setPlaying((value) => !value)}><Ionicons name={playing ? 'pause' : 'play'} size={28} color={C.bg} /></Pressable>
          <Pressable style={styles.speedButton} onPress={openAbPanel}><Text style={styles.speedText}>{speed.toFixed(1)}x</Text></Pressable>
          <Pressable style={styles.barButton} onPress={() => setPlayMode(playMode === 'ab-loop' ? 'full-loop' : 'ab-loop')}><Ionicons name="repeat" size={22} color={playMode === 'full-loop' ? C.lime : C.text} /><Text style={styles.barLabel}>{playMode === 'ab-loop' ? '關閉 AB' : '循環'}</Text></Pressable>
        </View>

        {panelOpen && <Pressable style={styles.dismissArea} onPress={() => setPanelOpen(false)} />}
        {panelOpen && <View style={styles.floatingPanel} {...panelPan.panHandlers}>
          <View style={styles.panelHeader}><View style={styles.panelTitleRow}><Ionicons name="bookmark-outline" size={24} color={C.muted} /><Text style={styles.panelTitle}>書籤</Text></View><Pressable style={styles.fold} onPress={() => setPanelOpen(false)}><Ionicons name="chevron-down" size={23} color={C.text} /></Pressable><Text style={styles.foldLabel}>折疊</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookmarkList}>
            {project.bookmarks.map((bookmark, index) => <Pressable key={bookmark.id} onPress={() => selectBookmark(bookmark)} onLongPress={() => manageBookmark(bookmark)} style={[styles.bookmark, activeBookmarkId === bookmark.id && styles.bookmarkActive]}><Text style={styles.bookmarkNumber}>{index + 1}</Text><View style={styles.bookmarkThumb}><Ionicons name="play" size={22} color={activeBookmarkId === bookmark.id ? C.bg : C.muted} /></View><Text numberOfLines={1} style={[styles.bookmarkTitle, activeBookmarkId === bookmark.id && { color: C.bg }]}>{bookmark.title}</Text><Text style={[styles.bookmarkTime, activeBookmarkId === bookmark.id && { color: '#313131' }]}>{time(bookmark.start)}–{time(bookmark.end)}</Text></Pressable>)}
            <Pressable onPress={addBookmark} style={styles.addBookmark}><Ionicons name="add" size={28} color={C.lime} /><Text style={styles.addBookmarkText}>儲存 AB</Text></Pressable>
          </ScrollView>
          <View style={styles.abEditor}>
            <View style={styles.abLabels}>
              <Pressable onPress={() => applyAbPoint('a', position)} style={[styles.abPoint, abEditTarget === 'a' && styles.abPointActive]}><Text style={styles.abName}>A 起點</Text><Text style={styles.abValue}>{draftA == null ? '設定目前位置' : abTime(draftA)}</Text><Text style={styles.abHint}>點擊設為目前位置</Text></Pressable>
              <Pressable onPress={() => applyAbPoint('b', position)} style={[styles.abPoint, abEditTarget === 'b' && styles.abPointActive]}><Text style={styles.abName}>B 終點</Text><Text style={styles.abValue}>{draftB == null ? '設定目前位置' : abTime(draftB)}</Text><Text style={styles.abHint}>點擊設為目前位置</Text></Pressable>
            </View>
            <ABTimeline min={trimStart} max={timelineMaximum} a={draftA} b={draftB} onAChange={(value) => applyAbPoint('a', value)} onBChange={(value) => applyAbPoint('b', value)} />
            <View style={styles.abQuickActions}><Text style={styles.abInstruction}>{draftA != null && draftB != null ? 'AB 已啟用，可繼續拖曳微調' : `下一步：設定 ${abEditTarget.toUpperCase()} 點`}</Text><Pressable style={styles.abReset} onPress={resetAB}><Ionicons name="refresh" size={15} color={C.muted} /><Text style={styles.abResetText}>重設 AB</Text></Pressable></View>
          </View>
          <View style={styles.panelFooter}><Pressable style={styles.panelAction} onPress={() => setPlayMode(playMode === 'ab-loop' ? 'full-loop' : 'ab-loop')}><Ionicons name="repeat" size={25} color={playMode === 'ab-loop' ? C.lime : C.muted} /><Text style={styles.panelActionText}>{playMode === 'ab-loop' ? '關閉 AB' : 'AB 模式'}</Text></Pressable><Pressable style={styles.panelAction} onPress={() => setSettingsOpen(true)}><Ionicons name="cube-outline" size={25} color={C.muted} /><Text style={styles.panelActionText}>剪輯長度</Text></Pressable><Pressable style={styles.panelPlay} onPress={() => setPlaying((value) => !value)}><Ionicons name={playing ? 'pause' : 'play'} size={27} color={C.bg} /></Pressable><Pressable style={styles.speedStep} onPress={() => adjustSpeed(-1)}><Ionicons name="chevron-back" size={27} color={C.text} /></Pressable><View style={styles.speedBox}><Text style={styles.speedBig}>{speed.toFixed(1)}x</Text></View><Pressable style={styles.speedStep} onPress={() => adjustSpeed(1)}><Ionicons name="chevron-forward" size={27} color={C.text} /></Pressable></View>
        </View>}
      </View>

      {!fullscreen && <View style={styles.hintCard}><Text style={styles.hintTitle}>練舞專案已自動保存</Text><Text style={styles.hintText}>AB 書籤、倍速、播放位置與畫面設定會保留到下次練習。</Text></View>}

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} project={project} playMode={playMode} setPlayMode={setPlayMode} position={position} total={total} cameraMode={cameraMode} setCameraMode={(value) => { setCameraMode(value); updateProject(project.id, { cameraMode: value }); }} update={(patch) => updateProject(project.id, patch)} />
    </View>
  );
}

function SettingsModal({ visible, onClose, project, playMode, setPlayMode, position, total, cameraMode, setCameraMode, update }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.settingsSheet}><View style={styles.settingsHeader}><Text style={styles.settingsTitle}>練舞設定</Text><Pressable style={styles.close} onPress={onClose}><Ionicons name="close" size={23} color={C.text} /></Pressable></View><ScrollView showsVerticalScrollIndicator={false}>
    <Text style={styles.groupTitle}>播放模式</Text><ChoiceRow label="整支影片循環" selected={playMode === 'full-loop'} onPress={() => setPlayMode('full-loop')} /><ChoiceRow label="AB 區間循環" selected={playMode === 'ab-loop'} onPress={() => setPlayMode('ab-loop')} />
    <Text style={styles.groupTitle}>剪輯長度（不修改原影片）</Text><View style={styles.trimRow}><Pressable style={styles.trimButton} onPress={() => update({ trimStart: position || 0 })}><Text style={styles.trimLabel}>開始</Text><Text style={styles.trimValue}>{time(project.trimStart || 0)}</Text></Pressable><Pressable style={styles.trimButton} onPress={() => update({ trimEnd: position || total || 0 })}><Text style={styles.trimLabel}>結束</Text><Text style={styles.trimValue}>{time(project.trimEnd || total)}</Text></Pressable></View>
    <Text style={styles.groupTitle}>裁切畫面</Text>{[['完整顯示', 'contain', 'auto'], ['填滿畫面', 'cover', 'auto'], ['9:16', 'contain', '9:16'], ['16:9', 'contain', '16:9'], ['1:1', 'contain', '1:1']].map(([label, crop, ratio]) => <ChoiceRow key={label} label={label} selected={project.crop === crop && project.aspectRatio === ratio} onPress={() => update({ crop, aspectRatio: ratio })} />)}
    <Text style={styles.groupTitle}>相機畫面模式</Text>{[['前鏡頭小窗', 'pip'], ['半透明全身疊加', 'overlay'], ['影片與相機左右分割', 'split']].map(([label, value]) => <ChoiceRow key={value} label={label} selected={cameraMode === value} onPress={() => setCameraMode(value)} />)}
    <Text style={styles.groupTitle}>快進／後退秒數</Text><View style={styles.pills}>{[5, 10, 15].map((value) => <Pressable key={value} onPress={() => update({ skipSeconds: value })} style={[styles.settingPill, project.skipSeconds === value && styles.settingPillActive]}><Text style={[styles.settingPillText, project.skipSeconds === value && { color: C.bg }]}>{value} 秒</Text></Pressable>)}</View>
  </ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg }, fullscreen: { backgroundColor: '#000' }, header: { height: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 }, iconButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#292929' }, headerTitle: { flex: 1, color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 17 }, stage: { marginHorizontal: 12, overflow: 'hidden', backgroundColor: '#050505', borderWidth: 1, borderColor: '#292929' }, fill: { width: '100%', height: '100%' }, videoLayer: { flex: 1 }, sideTools: { position: 'absolute', right: 12, top: 13, gap: 9 }, roundTool: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(20,20,20,.84)', borderWidth: 1, borderColor: '#434343', alignItems: 'center', justifyContent: 'center' }, activeTool: { backgroundColor: C.lime, borderColor: C.lime }, camera: { position: 'absolute', overflow: 'hidden', borderWidth: 2, borderColor: C.lime, backgroundColor: '#111' }, cameraPip: { width: 118, height: 172, left: 13, bottom: 126, borderRadius: 19 }, cameraOverlay: { left: 0, top: 0, right: 0, bottom: 112, opacity: 0.46, borderWidth: 0 }, cameraSplit: { width: '50%', top: 0, right: 0, bottom: 112, borderRadius: 0 }, liveBadge: { position: 'absolute', left: 8, top: 8, borderRadius: 8, backgroundColor: C.lime, paddingHorizontal: 7, paddingVertical: 4 }, liveText: { color: C.bg, fontFamily: 'JetBrainsMono', fontSize: 9 }, countdown: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.55)', alignItems: 'center', justifyContent: 'center' }, countdownText: { color: C.lime, fontFamily: 'JetBrainsMono', fontSize: 84 }, timeline: { position: 'absolute', left: 14, right: 14, bottom: 86, height: 38, flexDirection: 'row', alignItems: 'center', gap: 6 }, slider: { flex: 1, height: 36 }, clock: { color: C.text, fontFamily: 'JetBrainsMono', fontSize: 10 }, bottomBar: { position: 'absolute', left: 9, right: 9, bottom: 9, height: 72, borderRadius: 22, backgroundColor: 'rgba(25,25,25,.94)', borderWidth: 1, borderColor: '#414141', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 5 }, barButton: { width: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3 }, barLabel: { color: C.muted, fontSize: 9 }, play: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }, speedButton: { minWidth: 58, height: 48, borderRadius: 15, backgroundColor: '#292929', alignItems: 'center', justifyContent: 'center' }, speedText: { color: C.text, fontFamily: 'JetBrainsMono', fontSize: 15 }, dismissArea: { ...StyleSheet.absoluteFillObject, bottom: '51%' }, floatingPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '53%', minHeight: 350, backgroundColor: '#1B1B1B', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: '#3A3A3A', paddingTop: 14 }, panelHeader: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }, panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, panelTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 18 }, fold: { marginLeft: 'auto', width: 42, height: 42, borderRadius: 21, backgroundColor: '#303030', alignItems: 'center', justifyContent: 'center' }, foldLabel: { color: C.muted, marginLeft: 8 }, bookmarkList: { paddingHorizontal: 14, gap: 10, paddingVertical: 8 }, bookmark: { width: 122, height: 106, borderRadius: 16, backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#303030', padding: 9 }, bookmarkActive: { backgroundColor: C.lime, borderColor: C.lime }, bookmarkNumber: { color: C.muted, fontFamily: 'JetBrainsMono', fontSize: 10 }, bookmarkThumb: { flex: 1, alignItems: 'center', justifyContent: 'center' }, bookmarkTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 10 }, bookmarkTime: { color: C.muted, fontFamily: 'JetBrainsMono', fontSize: 8, marginTop: 2 }, addBookmark: { width: 105, height: 106, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#4A4A4A', alignItems: 'center', justifyContent: 'center' }, addBookmarkText: { color: C.muted, fontSize: 10, marginTop: 4 }, abEditor: { paddingHorizontal: 18, paddingTop: 3 }, abLabels: { flexDirection: 'row', gap: 10 }, abPoint: { flex: 1, borderRadius: 12, backgroundColor: '#262626', padding: 9 }, abName: { color: C.muted, fontSize: 9 }, abValue: { color: C.text, fontFamily: 'JetBrainsMono', fontSize: 11, marginTop: 2 }, panelFooter: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10, borderTopWidth: 1, borderColor: '#2D2D2D' }, panelAction: { minWidth: 58, alignItems: 'center', gap: 4 }, panelActionText: { color: C.muted, fontSize: 9 }, panelPlay: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }, speedStep: { width: 42, height: 50, alignItems: 'center', justifyContent: 'center' }, speedBox: { minWidth: 66, height: 54, borderRadius: 16, backgroundColor: '#292929', alignItems: 'center', justifyContent: 'center' }, speedBig: { color: C.text, fontFamily: 'JetBrainsMono', fontSize: 17 }, hintCard: { margin: 16, padding: 16, borderRadius: 20, backgroundColor: C.panel, borderWidth: 1, borderColor: '#282828' }, hintTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 13 }, hintText: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 5 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end' }, settingsSheet: { maxHeight: '88%', backgroundColor: '#181818', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, borderWidth: 1, borderColor: '#363636' }, settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, settingsTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 21 }, close: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#292929', alignItems: 'center', justifyContent: 'center' }, groupTitle: { color: C.lime, fontFamily: 'ZenGothic-Bold', fontSize: 11, letterSpacing: 1, marginTop: 19, marginBottom: 6 }, choice: { minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#2C2C2C' }, choiceLabel: { color: C.text, fontSize: 14 }, choiceValue: { color: C.muted, fontSize: 10, marginTop: 2 }, trimRow: { flexDirection: 'row', gap: 10 }, trimButton: { flex: 1, borderRadius: 15, backgroundColor: '#242424', padding: 13 }, trimLabel: { color: C.muted, fontSize: 10 }, trimValue: { color: C.text, fontFamily: 'JetBrainsMono', fontSize: 16, marginTop: 4 }, pills: { flexDirection: 'row', gap: 9 }, settingPill: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#292929', alignItems: 'center', justifyContent: 'center' }, settingPillActive: { backgroundColor: C.lime }, settingPillText: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 12 },
});

Object.assign(styles, {
  abPointActive: { borderWidth: 1, borderColor: C.lime },
  abHint: { color: C.muted, fontSize: 8, marginTop: 4 },
  abTimeline: { height: 45, marginTop: 7, justifyContent: 'center' },
  abTimelineTouch: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  abTrack: { position: 'absolute', left: 0, right: 0, top: 21, height: 6, borderRadius: 3, backgroundColor: '#454545' },
  abRange: { position: 'absolute', top: 21, height: 6, borderRadius: 3, backgroundColor: C.lime },
  abHandle: { position: 'absolute', top: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 3, borderWidth: 2 },
  abHandleA: { backgroundColor: C.lime, borderColor: C.lime },
  abHandleB: { backgroundColor: C.text, borderColor: C.text },
  abHandleUnset: { opacity: 0.65 },
  abHandleText: { color: C.bg, fontFamily: 'JetBrainsMono', fontSize: 9 },
  abQuickActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  abInstruction: { color: C.muted, fontSize: 9, flex: 1 },
  abReset: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 5 },
  abResetText: { color: C.muted, fontSize: 9 },
});
