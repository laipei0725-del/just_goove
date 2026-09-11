import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useEvent } from 'expo';
import { useKeepAwake } from 'expo-keep-awake';
import { useVideoPlayer, VideoView } from 'expo-video';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProjects } from '../store/ProjectContext';
import RangeEditor from '../components/RangeEditor';
import { startCleanPracticeRecording } from '../utils/browserTabRecorder';
const { clamp, playbackBounds, preciseTime } = require('../utils/practiceRange.cjs');
const { getAspectFitSize } = require('../utils/youtubeLayout.cjs');
const { extractYouTubeId } = require('../utils/youtubeUrl.cjs');

const C = { bg: '#0D0D0D', panel: '#1B1B1B', line: '#343434', lime: '#C8FF35', text: '#F4F4F2', muted: '#99999E', danger: '#FF6868' };
const YT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const YOUTUBE_PLAYER_PARAMS = Object.freeze({ controls: false, preventFullScreen: true, rel: false, iv_load_policy: 3 });
const YOUTUBE_WEBVIEW_PROPS = Object.freeze({ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false });
const YOUTUBE_CONTROLS_HEIGHT = 124;
const CONTROLS_AUTO_HIDE_MS = 3000;
const finiteNumber = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const tenth = (value) => Math.round(finiteNumber(value) * 10) / 10;
const time = (value) => { const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`; };
const abTime = (value) => { const safe = Math.max(0, tenth(value)); return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}.${Math.round((safe % 1) * 10)}`; };
const nearestYoutubeRate = (requested, rates = YT_RATES) => rates.reduce((nearest, value) => Math.abs(value - requested) < Math.abs(nearest - requested) ? value : nearest, rates[0]);
const speedLabel = (value) => `${Number(finiteNumber(value, 1).toFixed(2))}x`;
let mediaLibraryPromise;
const loadMediaLibrary = () => {
  if (Platform.OS === 'web') return Promise.resolve(null);
  if (!mediaLibraryPromise) mediaLibraryPromise = import('expo-media-library');
  return mediaLibraryPromise;
};
function ChoiceRow({ label, value, selected, onPress }) {
  return <Pressable onPress={onPress} style={styles.choice}><View><Text style={styles.choiceLabel}>{label}</Text>{value ? <Text style={styles.choiceValue}>{value}</Text> : null}</View><Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? C.lime : C.muted} /></Pressable>;
}

const YT_STATE_TO_NAME = { [-1]: 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'video cued' };
let youtubeApiPromise = null;
const loadYoutubeIframeApi = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.reject(new Error('YouTube API 需要瀏覽器環境'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === 'function') previous();
        resolve(window.YT);
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => { youtubeApiPromise = null; reject(new Error('YouTube API 載入失敗')); };
      document.head.appendChild(tag);
    });
  }
  return youtubeApiPromise;
};

// react-native-youtube-iframe cannot play on web: its player iframe is hosted
// on a third-party page that expects the native ReactNativeWebView bridge, so
// onReady never fires in a browser. This web-only replacement drives the
// official YouTube IFrame Player API directly and exposes the same imperative
// API the screen relies on (getCurrentTime/getDuration/seekTo/rates), keeping
// native playback on react-native-youtube-iframe unchanged.
const YouTubePlayerWeb = React.forwardRef(function YouTubePlayerWeb({ height, width, videoId, mirrored = false, play = false, playbackRate = 1, onReady, onStateChange, onPlaybackRateChange, onError }, ref) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const propsRef = useRef({ play, playbackRate, onReady, onStateChange, onPlaybackRateChange, onError });
  propsRef.current = { play, playbackRate, onReady, onStateChange, onPlaybackRateChange, onError };

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => Promise.resolve(playerRef.current ? playerRef.current.getCurrentTime() : 0),
    getDuration: () => Promise.resolve(playerRef.current ? playerRef.current.getDuration() : 0),
    getAvailablePlaybackRates: () => Promise.resolve(playerRef.current?.getAvailablePlaybackRates?.() || [1]),
    seekTo: (seconds, allowSeekAhead) => { playerRef.current?.seekTo(finiteNumber(seconds), Boolean(allowSeekAhead)); },
    playVideo: () => { playerRef.current?.playVideo(); },
    pauseVideo: () => { playerRef.current?.pauseVideo(); },
    getPlaybackRate: () => Promise.resolve(playerRef.current ? playerRef.current.getPlaybackRate() : playbackRate),
  }), [playbackRate]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const host = hostRef.current;
    if (!host || !videoId) return undefined;
    let disposed = false;
    let player = null;
    loadYoutubeIframeApi().then((YT) => {
      if (disposed || !host || player) return;
      const mount = document.createElement('div');
      mount.style.width = '100%';
      mount.style.height = '100%';
      host.appendChild(mount);
      player = new YT.Player(mount, {
        videoId,
        playerVars: {
          controls: 0,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
          fs: 0,
          modestbranding: 1,
          disablekb: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (disposed) return;
            playerRef.current = event.target;
            const frame = event.target.getIframe?.();
            if (frame) {
              frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
              frame.style.width = '100%';
              frame.style.height = '100%';
              frame.style.border = '0';
            }
            const current = propsRef.current;
            try { event.target.setPlaybackRate(current.playbackRate); } catch {}
            if (current.play) { try { event.target.playVideo(); } catch {} }
            current.onReady?.();
          },
          onStateChange: (event) => {
            const name = YT_STATE_TO_NAME[event.data] || 'unstarted';
            propsRef.current.onStateChange?.(name);
          },
          onPlaybackRateChange: (event) => propsRef.current.onPlaybackRateChange?.(Number(event.data)),
          onError: (event) => propsRef.current.onError?.(Number(event.data)),
        },
      });
    }).catch(() => propsRef.current.onError?.('載入失敗'));
    return () => {
      disposed = true;
      try { player?.destroy(); } catch {}
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    try { if (play) player.playVideo(); else player.pauseVideo(); } catch {}
  }, [play]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !Number.isFinite(playbackRate) || playbackRate <= 0) return;
    try {
      if (Math.abs(player.getPlaybackRate() - playbackRate) > 0.001) player.setPlaybackRate(playbackRate);
    } catch {}
  }, [playbackRate]);

  return <View ref={hostRef} style={{ width, height, overflow: 'hidden', transform: [{ scaleX: mirrored ? -1 : 1 }] }} accessibilityLabel="YouTube 影片畫面" />;
});

export default function PracticeScreen({ route, navigation }) {
  useKeepAwake('just-groove-practice', { suppressDeactivateWarnings: Platform.OS === 'web' });
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { projects, updateProject, storageError, syncStatus, retrySync } = useProjects();
  const project = projects.find((item) => item.id === route.params?.projectId);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const ytRef = useRef(null);
  const autoplayDoneRef = useRef(false);
  const autoplayFallbackTimerRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaPermission, setMediaPermission] = useState(null);
  const requestMediaPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      const unsupported = { granted: false, status: 'denied', canAskAgain: false };
      setMediaPermission(unsupported);
      return unsupported;
    }
    const mediaLibrary = await loadMediaLibrary();
    const permission = await mediaLibrary.requestPermissionsAsync();
    setMediaPermission(permission);
    return permission;
  }, []);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(finiteNumber(project?.speed, 1));
  const [youtubeRates, setYoutubeRates] = useState([1]);
  const [requestedSpeed, setRequestedSpeed] = useState(finiteNumber(project?.speed, 1));
  const [speedOpen, setSpeedOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [nameDialog, setNameDialog] = useState(null);
  const [bookmarkName, setBookmarkName] = useState('');
  const [managedBookmark, setManagedBookmark] = useState(null);
  const [trimOpen, setTrimOpen] = useState(false);
  const [trimDraft, setTrimDraft] = useState({ a: 0, b: 1 });
  const [fps, setFps] = useState(project?.frameStep || 30);
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [playMode, setPlayModeState] = useState(project?.playMode || 'full-loop');
  const [ytPosition, setYtPosition] = useState(finiteNumber(project?.position));
  const [ytDuration, setYtDuration] = useState(0);
  const [localDuration, setLocalDuration] = useState(0);
  const [mirrored, setMirrored] = useState(Boolean(project?.mirrored));
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraReadyRef = useRef(false);
  const [cameraMode, setCameraMode] = useState(project?.cameraMode || 'pip');
  const [recordingContent, setRecordingContent] = useState(project?.recordingContent || 'camera');
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [youtubeViewportSize, setYoutubeViewportSize] = useState({ width: 0, height: 0 });
  const controlsHideTimerRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [recordingResult, setRecordingResult] = useState(null);
  const [activeBookmarkId, setActiveBookmarkId] = useState(project?.activeBookmarkId || null);
  const [draftA, setDraftA] = useState(project?.abStart ?? null);
  const [draftB, setDraftB] = useState(project?.abEnd ?? null);
  const browserRecorderRef = useRef(null);

  const source = project?.source;
  const isYoutube = source?.type === 'youtube';
  const youtubeVideoId = isYoutube && /^[\w-]{11}$/.test(source?.id || '') ? source.id : extractYouTubeId(source?.uri || '');
  const isVerticalYoutube = source?.type === 'youtube' && (source.uri?.includes('/shorts/') || project?.aspectRatio === '9:16' || project?.orientation === 'portrait');
  const immersiveYoutube = isYoutube && fullscreen;
  const fullscreenLayout = fullscreen;
  const controlsShown = !isYoutube || controlsVisible;
  const player = useVideoPlayer(source?.type === 'local' ? source.uri : null, (p) => {
    p.timeUpdateEventInterval = 0.05;
    if (source?.type === 'local') p.currentTime = project?.position || 0;
  });
  const { currentTime = 0 } = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const { duration = 0 } = useEvent(player, 'sourceLoad', { duration: 0, availableVideoTracks: [], availableAudioTracks: [], availableSubtitleTracks: [] });
  const { status: playerStatus } = useEvent(player, 'statusChange', { status: player.status });
  // expo-video does not emit sourceLoad on web, so `duration` never updates
  // there. Poll the underlying player on web to keep the timeline/scrubber
  // (and AB loop bounds) in sync with the real clip length.
  useEffect(() => {
    if (source?.type !== 'local' || Platform.OS !== 'web') return undefined;
    const readDuration = () => {
      const value = player.duration;
      if (Number.isFinite(value) && value > 0) setLocalDuration(value);
    };
    readDuration();
    const timer = setInterval(readDuration, 400);
    return () => clearInterval(timer);
  }, [player, source?.type]);
  const activeBookmark = project?.bookmarks?.find((item) => item.id === activeBookmarkId) || null;
  // expo-video can briefly report NaN while restoring/loading a media source.
  // UIKit's native slider throws an uncaught exception when given NaN, so every
  // value crossing the JS/native boundary must be finite and internally ordered.
  const position = Math.max(0, finiteNumber(source?.type === 'youtube' ? ytPosition : currentTime));
  const total = Math.max(0, finiteNumber(source?.type === 'youtube' ? ytDuration : Math.max(duration, localDuration)));
  const bounds = playbackBounds(project?.trimStart, project?.trimEnd, total);
  const trimStart = bounds.start;
  const timelineMaximum = Math.max(trimStart + 1 / 60, bounds.end);
  const timelineValue = clamp(position, trimStart, timelineMaximum);
  const activeAbRange = draftA != null && draftB > draftA ? { start: draftA, end: draftB } : activeBookmark;
  const editing = panelOpen || trimOpen || speedOpen || Boolean(nameDialog);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current) {
      clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  const keepYoutubeControlsVisible = useCallback((autoHide = true) => {
    if (!isYoutube) return;
    clearControlsHideTimer();
    setControlsVisible(true);
    if (autoHide && playing && !editing && !settingsOpen && !recording) {
      controlsHideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
        controlsHideTimerRef.current = null;
      }, CONTROLS_AUTO_HIDE_MS);
    }
  }, [clearControlsHideTimer, isYoutube, editing, playing, recording, settingsOpen]);

  const toggleYoutubeControls = useCallback(() => {
    if (!isYoutube || editing || settingsOpen || recording) return;
    if (controlsVisible) {
      clearControlsHideTimer();
      setControlsVisible(false);
    } else {
      keepYoutubeControlsVisible(true);
    }
  }, [clearControlsHideTimer, controlsVisible, isYoutube, keepYoutubeControlsVisible, editing, recording, settingsOpen]);

  const handleYoutubeViewportLayout = useCallback((event) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight) || nextWidth <= 0 || nextHeight <= 0) return;
    setYoutubeViewportSize((current) => (
      Math.abs(current.width - nextWidth) < 0.5 && Math.abs(current.height - nextHeight) < 0.5
        ? current
        : { width: nextWidth, height: nextHeight }
    ));
  }, []);

  useEffect(() => {
    if (!isYoutube) return undefined;
    if (!playing || editing || settingsOpen || recording) {
      clearControlsHideTimer();
      setControlsVisible(true);
      return undefined;
    }
    keepYoutubeControlsVisible(true);
    return clearControlsHideTimer;
  }, [clearControlsHideTimer, isYoutube, keepYoutubeControlsVisible, editing, playing, recording, settingsOpen]);

  useEffect(() => clearControlsHideTimer, [clearControlsHideTimer]);

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

    } catch {}
  }, [source?.type]);

  useEffect(() => {
    if (!project) navigation.goBack();
  }, [project, navigation]);

  // Attempt autoplay once the local source is ready. Web browsers only allow
  // autoplay with sound after the user has interacted with the page, so on web
  // we skip the attempt when there was no prior gesture. That avoids an
  // unhandled HTMLMediaElement play() rejection and leaves the video paused
  // for the user to start with the play button.
  useEffect(() => {
    if (autoplayDoneRef.current) return;
    const canAutoplay = Platform.OS !== 'web'
      || typeof navigator === 'undefined'
      || !navigator.userActivation
      || navigator.userActivation.hasBeenActive;
    if (!canAutoplay) return;
    if (source?.type === 'local' && playerStatus === 'readyToPlay') {
      autoplayDoneRef.current = true;
      setPlaying(true);
      if (Platform.OS === 'web') {
        autoplayFallbackTimerRef.current = setTimeout(() => {
          if (!player.playing) setPlaying(false);
        }, 700);
      }
    } else if (source?.type === 'youtube' && youtubeReady) {
      autoplayDoneRef.current = true;
      setPlaying(true);
    }
    if (source?.type === 'local' && playerStatus === 'error') {
      setPlaying(false);
    }
  }, [player, playerStatus, source?.type, youtubeReady]);

  useEffect(() => () => {
    if (autoplayFallbackTimerRef.current) clearTimeout(autoplayFallbackTimerRef.current);
  }, []);

  useEffect(() => {
    player.playbackRate = speed;
    if (source?.type !== 'local') return;
    try {
      if (playing) player.play();
      else player.pause();
    } catch {}
  }, [player, playing, source?.type, speed]);

  const togglePlayback = useCallback(() => {
    if (source?.type === 'youtube' && !youtubeReady) return;
    keepYoutubeControlsVisible(true);
    setPlaying((current) => !current);
  }, [keepYoutubeControlsVisible, source?.type, youtubeReady]);

  const handleYoutubeStateChange = useCallback((state) => {
    if (state === 'playing') setPlaying(true);
    if (state === 'paused' || state === 'ended') setPlaying(false);
    if (state === 'playing' || state === 'video cued') refreshYoutubeRates();
  }, [refreshYoutubeRates]);

  const handleYoutubeReady = useCallback(() => {
    setYoutubeReady(true);
    refreshYoutubeRates();
  }, [refreshYoutubeRates]);

  useEffect(() => {
    if (source?.type !== 'youtube' || !youtubeReady) return undefined;
    const timer = setInterval(async () => {
      try {
        const [nextPosition, nextDuration] = await Promise.all([ytRef.current?.getCurrentTime(), ytRef.current?.getDuration()]);
        if (Number.isFinite(nextPosition)) setYtPosition(nextPosition);
        if (Number.isFinite(nextDuration)) setYtDuration(nextDuration);
      } catch {}
    }, 100);
    return () => clearInterval(timer);
  }, [youtubeReady, source?.type]);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => setRecordSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!project?.id) return undefined;
    const timer = setTimeout(() => updateProject(project.id, { speed, position, cameraMode, recordingContent, mirrored, frameStep: fps }), 800);
    return () => clearTimeout(timer);
  }, [project?.id, speed, position, cameraMode, recordingContent, mirrored, fps, updateProject]);

  const seek = useCallback((value, unrestricted = false) => {
    const requested = finiteNumber(value, trimStart);
    const bounded = unrestricted ? clamp(requested, 0, total) : clamp(requested, trimStart, timelineMaximum);
    if (source?.type === 'youtube') { ytRef.current?.seekTo(bounded, true); setYtPosition(bounded); }
    else player.currentTime = bounded;
  }, [player, source?.type, timelineMaximum, trimStart, total]);

  // When a local clip plays to its natural end, restart it from trimStart so
  // full-loop keeps running. Reading latest values through a ref keeps this
  // native event listener from capturing stale state.
  const loopStateRef = useRef({ playMode, trimStart, sourceType: source?.type });
  loopStateRef.current = { playMode, trimStart, sourceType: source?.type };
  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      const { playMode: mode, trimStart: start, sourceType } = loopStateRef.current;
      if (sourceType !== 'local' || mode !== 'full-loop') return;
      player.currentTime = start;
      player.play();
      setPlaying(true);
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (!playing || trimOpen) return;
    if (!activeAbRange || playMode !== 'ab-loop' || position < activeAbRange.end) return;
    seek(activeAbRange.start);
    if (source?.type === 'local' && !player.playing) player.play();
  }, [playing, position, activeAbRange, playMode, seek, player, source?.type, trimOpen]);

  useEffect(() => {
    if (!playing || trimOpen || playMode !== 'full-loop' || !total) return;
    if (position >= timelineMaximum - 0.025 || position < trimStart) seek(trimStart);
  }, [playing, trimOpen, position, total, playMode, trimStart, timelineMaximum, seek]);

  const changeSpeed = (value) => {
    keepYoutubeControlsVisible(false);
    if (isYoutube) {
      setRequestedSpeed(nearestYoutubeRate(value, youtubeRates));
    } else {
      setSpeed(value);
      setRequestedSpeed(value);
    }
  };
  const handleRateChange = useCallback((value) => {
    const actual = Number(value);
    if (Number.isFinite(actual) && actual > 0) setSpeed(actual);
  }, []);
  useEffect(() => {
    if (!isYoutube || !youtubeReady || requestedSpeed === speed) return undefined;
    const timer = setTimeout(async () => {
      try {
        const actual = await ytRef.current?.getPlaybackRate();
        if (Number.isFinite(actual)) {
          setSpeed(actual);
          if (Math.abs(actual - requestedSpeed) > 0.001) {
            setNotice('此影片尚未套用該速度，請開始播放後再試。');
            setRequestedSpeed(actual);
          }
        }
      } catch { setNotice('速度調整未完成，請稍後再試。'); }
    }, 1600);
    return () => clearTimeout(timer);
  }, [isYoutube, youtubeReady, requestedSpeed, speed]);

  const openAbPanel = () => {
    keepYoutubeControlsVisible(false);
    setPlaying(false);
    if (draftA == null || draftB == null || draftB <= draftA) {
      setDraftA(trimStart); setDraftB(timelineMaximum);
    }
    setPanelOpen(true);
  };
  const changeAbRange = (range, target) => {
    setDraftA(range.a); setDraftB(range.b); setActiveBookmarkId(null);
    setPlaying(false);
    seek(target === 'a' ? range.a : range.b);
  };
  const resetAB = () => {
    setDraftA(trimStart); setDraftB(timelineMaximum); setActiveBookmarkId(null);
    setPlayMode('full-loop');
  };
  const closeAbPanel = () => {
    updateProject(project.id, { abStart: draftA, abEnd: draftB, activeBookmarkId, frameStep: fps });
    setPanelOpen(false);
  };
  const openTrim = () => {
    setTrimDraft({ a: trimStart, b: timelineMaximum });
    setPlaying(false); setTrimOpen(true); keepYoutubeControlsVisible(false);
  };
  const closeTrim = () => { setTrimOpen(false); seek(trimStart); };
  const applyTrim = () => {
    if (trimDraft.b <= trimDraft.a) return;
    updateProject(project.id, { trimStart: trimDraft.a, trimEnd: trimDraft.b, abStart: null, abEnd: null, activeBookmarkId: null, playMode: 'full-loop' });
    setDraftA(null); setDraftB(null); setActiveBookmarkId(null); setPlayModeState('full-loop');
    seek(trimDraft.a, true); setTrimOpen(false); setNotice('已套用剪輯範圍，原影片保持完整。');
  };

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
      if (Platform.OS !== 'web') {
        if (!permission?.granted) permission = await requestMediaPermission();
        const mediaLibrary = await loadMediaLibrary();
        if (permission?.granted && mediaLibrary) {
          if (typeof mediaLibrary.createAssetAsync === 'function') {
            assetId = (await mediaLibrary.createAssetAsync(savedUri)).id;
          } else if (mediaLibrary.Asset?.create) {
            assetId = (await mediaLibrary.Asset.create(savedUri)).id;
          }
        }
      }
      updateProject(project.id, { recordings: [...(project.recordings || []), { id: `${Date.now()}`, uri: savedUri, assetId, duration: recordSeconds, createdAt: Date.now() }] });
      Alert.alert('錄影已保存', permission?.granted ? '已儲存在練舞專案與手機相簿。' : '已儲存在練舞專案；尚未取得相簿寫入權限。');
    } catch { Alert.alert('保存失敗', '錄影已結束，但檔案無法保存，請確認儲存空間與相簿權限。'); }
  };

  const finishBrowserRecording = ({ uri, mimeType, duration, blob }) => {
    updateProject(project.id, {
      recordings: [...(project.recordings || []), { id: `${Date.now()}`, uri, mimeType, duration, createdAt: Date.now(), downloaded: true }],
    });
    setRecordingResult({ uri, mimeType, duration, blob, content: recordingContent });
    setNotice('錄影完成，請在彈出視窗按「下載影片」。');
  };

  const downloadRecording = () => {
    if (!recordingResult?.uri || typeof document === 'undefined') return;
    const extension = recordingResult.mimeType?.includes('mp4') ? 'mp4' : 'webm';
    const link = document.createElement('a');
    link.href = recordingResult.uri;
    link.download = `just-groove-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
    link.click();
    setRecordingResult(null);
    setNotice('影片已下載到本機。');
  };

  const findPracticeVideoElement = (selector) => {
    const root = document.getElementById(selector);
    if (root?.tagName === 'VIDEO') return root;
    return root?.querySelector?.('video') || null;
  };
  const waitForPracticeVideoElement = async (selector, timeoutMs = 2200) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const element = findPracticeVideoElement(selector);
      if (element?.readyState >= 2 || element?.srcObject) return element;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return findPracticeVideoElement(selector);
  };

  const preparePlaybackForBrowserRecording = async (startAt, sourceVideo) => {
    setPlaying(false);
    if (source?.type === 'youtube') {
      try {
        ytRef.current?.pauseVideo?.();
        ytRef.current?.seekTo?.(startAt, true);
      } catch {}
      setYtPosition(startAt);
    } else if (sourceVideo) {
      try {
        sourceVideo.pause?.();
        sourceVideo.currentTime = startAt;
        sourceVideo.playbackRate = Number.isFinite(speed) && speed > 0 ? speed : 1;
      } catch {}
    } else {
      seek(startAt, true);
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
    setPlaying(true);
    if (source?.type === 'youtube') {
      try { ytRef.current?.playVideo?.(); } catch {}
    } else if (sourceVideo) {
      try { await sourceVideo.play?.(); } catch {}
    } else {
      seek(startAt, true);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  };

  const pausePracticePlayback = () => {
    setPlaying(false);
    if (source?.type === 'youtube') {
      try { ytRef.current?.pauseVideo?.(); } catch {}
    } else {
      try { player.pause?.(); } catch {}
    }
  };

  const beginRecording = async () => {
    if (Platform.OS === 'web') {
      const canRecordCanvas = typeof navigator !== 'undefined'
        && Boolean(navigator.mediaDevices?.getUserMedia)
        && typeof MediaRecorder !== 'undefined';
      if (!canRecordCanvas) {
        setNotice('目前瀏覽器不支援相機錄影。請改用桌面版 Chrome；iPhone Chrome 會在原生 App 版支援。');
        return;
      }
      if (recordingContent !== 'camera' && source?.type !== 'local') {
        setNotice('YouTube 先支援「只錄我的相機」；影片＋我的相機受跨來源限制，請先下載影片後匯入。');
        return;
      }
      if (source?.type === 'youtube' && !youtubeReady) {
        setNotice('YouTube 尚未載入完成，請等影片可播放後再錄影。');
        return;
      }
      if (!cameraVisible) {
        await toggleCamera();
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      setControlsVisible(false);
      setNotice(recordingContent === 'camera' ? '正在準備只錄我的相機畫面，影片會同步從頭播放。' : '正在準備乾淨合成錄影，錄製內容不包含 App 按鈕與框線。');
      setCountdown(3);
      for (let value = 3; value > 0; value -= 1) {
        setCountdown(value);
        await new Promise((resolve) => setTimeout(resolve, 850));
      }
      setCountdown(null);
      try {
        const sourceVideo = source?.type === 'local' ? findPracticeVideoElement('practice-source-video') : null;
        const cameraVideo = await waitForPracticeVideoElement('practice-camera-video');
        if (!cameraVideo) throw new Error('相機尚未準備好，請允許相機權限後再試。');
        const startAt = 0;
        const videoEnd = Number.isFinite(total) && total > startAt ? total : sourceVideo?.duration;
        const endAt = Number.isFinite(project?.trimEnd) && project.trimEnd > startAt ? project.trimEnd : videoEnd;
        await preparePlaybackForBrowserRecording(startAt, sourceVideo);
        browserRecorderRef.current = await startCleanPracticeRecording({
          sourceVideo: recordingContent === 'camera' ? null : sourceVideo,
          cameraVideo,
          aspectRatio: project.aspectRatio,
          crop: project.crop,
          cameraMode,
          mirrored,
          startAt,
          endAt,
          durationSeconds: Number.isFinite(endAt) && endAt > startAt ? (endAt - startAt) / Math.max(speed, 0.1) : null,
          playbackRate: speed,
          includeCamera: true,
          content: recordingContent,
          onStopped: (result) => {
            browserRecorderRef.current = null;
            setRecording(false);
            setControlsVisible(true);
            pausePracticePlayback();
            finishBrowserRecording(result);
          },
          onError: () => { pausePracticePlayback(); setNotice('錄影失敗，請確認影片與相機已載入後再試。'); setRecording(false); setControlsVisible(true); },
        });
        setRecordSeconds(0);
        setRecording(true);
      } catch (error) {
        pausePracticePlayback();
        setCountdown(null); setControlsVisible(true);
        setNotice(error?.message || 'Chrome 未允許目前分頁的畫面與音訊錄製。');
      }
      return;
    }
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

  const stopRecording = () => {
    if (Platform.OS === 'web') { browserRecorderRef.current?.stop(); return; }
    cameraRef.current?.stopRecording();
  };
  const toggleRecording = () => {
    keepYoutubeControlsVisible(false);
    return recording ? stopRecording() : beginRecording();
  };

  const addBookmark = () => {
    if (draftA == null || draftB == null || draftB <= draftA || !total) {
      setNotice('請先載入影片並選好 A、B 起訖。'); return;
    }
    setBookmarkName(`段落 ${(project.bookmarks?.length || 0) + 1}`);
    setNameDialog({ type: 'add', start: draftA, end: draftB, speed });
  };
  const saveBookmark = () => {
    const title = bookmarkName.trim();
    if (!title || !nameDialog) return;
    if (nameDialog.type === 'rename') {
      updateProject(project.id, { bookmarks: project.bookmarks.map((item) => item.id === nameDialog.id ? { ...item, title } : item) });
    } else {
      const bookmark = { id: `${Date.now()}`, title, start: nameDialog.start, end: nameDialog.end, speed: nameDialog.speed };
      updateProject(project.id, { bookmarks: [...project.bookmarks, bookmark], abStart: bookmark.start, abEnd: bookmark.end, activeBookmarkId: bookmark.id, playMode: 'ab-loop' });
      setActiveBookmarkId(bookmark.id); setPlayModeState('ab-loop');
    }
    setNameDialog(null); setNotice('書籤已儲存');
  };
  const selectBookmark = (bookmark) => {
    // A saved bookmark may lie outside a later trim. Restore a containing range.
    const start = clamp(bookmark.start, 0, Math.max(0, total - 1 / fps));
    const end = clamp(bookmark.end, start + 1 / fps, total);
    updateProject(project.id, { trimStart: Math.min(trimStart, start), trimEnd: Math.max(timelineMaximum, end), abStart: start, abEnd: end, activeBookmarkId: bookmark.id, playMode: 'ab-loop' });
    setActiveBookmarkId(bookmark.id); setDraftA(start); setDraftB(end);
    changeSpeed(bookmark.speed); setPlayModeState('ab-loop'); seek(start, true); setPlaying(true);
  };
  const renameBookmark = (bookmark) => {
    setManagedBookmark(null); setBookmarkName(bookmark.title); setNameDialog({ type: 'rename', id: bookmark.id });
  };
  const moveBookmark = (bookmark, direction) => {
    const items = [...project.bookmarks]; const index = items.findIndex((item) => item.id === bookmark.id); const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    updateProject(project.id, { bookmarks: items }); setManagedBookmark(null);
  };
  const toggleFullscreen = () => {
    keepYoutubeControlsVisible(true);
    setFullscreen((value) => !value);
  };
  if (!project) return null;

  const videoFit = project.crop === 'cover' ? 'cover' : 'contain';
  const practiceAspectRatio = project.aspectRatio === '16:9' ? 16 / 9 : project.aspectRatio === '1:1' ? 1 : 9 / 16;
  const cameraPipAspectStyle = cameraMode === 'pip'
    ? (practiceAspectRatio >= 1 ? { width: 168, height: 95 } : { width: 118, height: 210 })
    : null;
  const cameraStyle = cameraMode === 'split' ? styles.cameraSplit : cameraMode === 'overlay' ? styles.cameraOverlay : [styles.cameraPip, cameraPipAspectStyle];
  const stageHeight = Math.max(220, height - insets.top - insets.bottom - (fullscreen ? 0 : 72));
  const youtubeAspectRatio = project.aspectRatio === '1:1' ? 1 : isVerticalYoutube ? 9 / 16 : 16 / 9;
  const fallbackYoutubeWidth = Math.max(1, width - (immersiveYoutube ? insets.left + insets.right : 24));
  const fallbackYoutubeHeight = Math.max(1, height - (immersiveYoutube ? insets.bottom : insets.top + 62) - YOUTUBE_CONTROLS_HEIGHT);
  const youtubeFrame = getAspectFitSize(
    youtubeViewportSize.width || fallbackYoutubeWidth,
    youtubeViewportSize.height || fallbackYoutubeHeight,
    youtubeAspectRatio,
  );
  const youtubeViewportBottom = YOUTUBE_CONTROLS_HEIGHT;
  const rootSafeArea = fullscreenLayout
    ? {
      paddingTop: 0,
      paddingBottom: immersiveYoutube ? insets.bottom : 0,
      paddingLeft: immersiveYoutube ? insets.left : 0,
      paddingRight: immersiveYoutube ? insets.right : 0,
    }
    : { paddingTop: insets.top, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };

  return (
    <View style={[styles.screen, fullscreenLayout && styles.fullscreen, rootSafeArea]}>
      <StatusBar style="light" hidden={immersiveYoutube} />
      {!fullscreenLayout && <View style={styles.header}><Pressable style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityLabel="返回首頁"><Ionicons name="arrow-back" size={24} color={C.text} /></Pressable><Text numberOfLines={1} style={styles.headerTitle}>{project.title}</Text><Pressable style={styles.iconButton} onPress={() => { keepYoutubeControlsVisible(false); setSettingsOpen(true); }} accessibilityLabel="練舞設定"><Ionicons name="settings-outline" size={22} color={C.text} /></Pressable></View>}
      <View style={[styles.stage, { height: stageHeight }, fullscreenLayout && styles.stageFullscreen, { borderRadius: fullscreenLayout ? 0 : 25 }]}>
        <View
          onLayout={isYoutube ? handleYoutubeViewportLayout : undefined}
          style={[styles.youtubeVideoLayer, { bottom: youtubeViewportBottom }, !isYoutube && { transform: [{ scaleX: mirrored ? -1 : 1 }] }, isYoutube && Platform.OS !== 'web' && { transform: [{ scaleX: mirrored ? -1 : 1 }] }]}
          accessibilityLabel="影片顯示區"
        >
          {source?.type === 'local' ? <VideoView ref={videoRef} player={player} style={styles.fill} contentFit={videoFit} nativeControls={false} nativeID="practice-source-video" playsInline fullscreenOptions={{ enable: false }} surfaceType="textureView" /> : (!youtubeVideoId ? <View style={styles.invalidVideo}><Ionicons name="warning-outline" size={34} color={C.danger} /><Text style={styles.invalidVideoTitle}>YouTube 連結無效</Text><Text style={styles.invalidVideoText}>返回首頁並重新加入正確的影片連結。</Text></View> : Platform.OS === 'web' ? <YouTubePlayerWeb mirrored={mirrored} ref={ytRef} height={youtubeFrame.height} width={youtubeFrame.width} play={playing} videoId={youtubeVideoId} playbackRate={requestedSpeed} onReady={handleYoutubeReady} onPlaybackRateChange={handleRateChange} onStateChange={handleYoutubeStateChange} onError={() => { setYoutubeReady(false); setNotice("YouTube 無法載入，請確認影片允許嵌入播放。"); }} /> : <YoutubePlayer ref={ytRef} height={youtubeFrame.height} width={youtubeFrame.width} play={playing} videoId={youtubeVideoId} playbackRate={requestedSpeed} initialPlayerParams={YOUTUBE_PLAYER_PARAMS} webViewProps={YOUTUBE_WEBVIEW_PROPS} onReady={handleYoutubeReady} onPlaybackRateChange={handleRateChange} onChangeState={handleYoutubeStateChange} onError={() => { setYoutubeReady(false); setNotice("YouTube 無法載入，請確認影片允許嵌入播放。"); }} />)}
        </View>
        {isYoutube && <Pressable style={[styles.youtubeTapTarget, { bottom: youtubeViewportBottom }]} onPress={toggleYoutubeControls} accessibilityLabel={controlsVisible ? '隱藏播放控制' : '顯示播放控制'} />}
        {cameraVisible && <View style={[styles.camera, cameraStyle]} nativeID="practice-camera-video"><CameraView ref={cameraRef} style={styles.fill} facing="front" mirror mode="video" active={cameraVisible} onCameraReady={() => { cameraReadyRef.current = true; setCameraReady(true); }} onMountError={(event) => { cameraReadyRef.current = false; setCameraReady(false); Alert.alert('相機啟動失敗', event.message); }} /><View style={styles.liveBadge}><Text style={styles.liveText}>{recording ? `REC ${time(recordSeconds)}` : cameraReady ? 'LIVE' : '準備中'}</Text></View></View>}
        {countdown != null && <View style={styles.countdown}><Text style={styles.countdownText}>{countdown}</Text></View>}
        {controlsShown && <View style={styles.sideTools}>
          <Pressable style={[styles.roundTool, mirrored && styles.activeTool]} onPress={() => { keepYoutubeControlsVisible(true); setMirrored((value) => { updateProject(project.id, { mirrored: !value }); return !value; }); }} accessibilityLabel="鏡像"><Ionicons name="swap-horizontal" size={21} color={mirrored ? C.bg : C.text} /></Pressable>
          <Pressable style={[styles.roundTool, cameraVisible && styles.activeTool]} onPress={() => { keepYoutubeControlsVisible(true); toggleCamera(); }} accessibilityLabel="開啟或關閉相機"><Ionicons name="camera-outline" size={21} color={cameraVisible ? C.bg : C.text} /></Pressable>
          <Pressable style={styles.roundTool} onPress={toggleFullscreen} accessibilityLabel="切換全螢幕"><Ionicons name={fullscreenLayout ? 'contract-outline' : 'expand-outline'} size={21} color={C.text} /></Pressable>
        </View>}
        {controlsShown && <View style={styles.timeline}><Text style={styles.clock}>{time(position)}</Text><Slider style={styles.slider} minimumValue={trimStart} maximumValue={timelineMaximum} value={timelineValue} onSlidingStart={() => keepYoutubeControlsVisible(false)} onSlidingComplete={(value) => { seek(value); keepYoutubeControlsVisible(true); }} minimumTrackTintColor={C.lime} maximumTrackTintColor="#56565A" thumbTintColor={C.text} /><Text style={styles.clock}>{time(total)}</Text></View>}
        {controlsShown && <View style={styles.bottomBar}>
          <Pressable style={styles.barButton} onPress={openAbPanel} accessibilityLabel="開啟AB書籤"><Ionicons name="bookmark-outline" size={21} color={playMode === 'ab-loop' ? C.lime : C.text} /><Text style={styles.barLabel}>AB 書籤</Text></Pressable>
          <Pressable style={[styles.barButton, styles.recordButton, recording && styles.recordButtonActive]} onPress={toggleRecording} accessibilityLabel={recording ? '停止錄影' : '開始錄影'}><Ionicons name={recording ? 'stop-circle' : 'radio-button-on'} size={25} color={recording ? C.danger : C.lime} /><Text style={[styles.barLabel, styles.recordLabel]}>{recording ? '停止' : '錄影'}</Text></Pressable>
          <Pressable style={styles.play} accessibilityLabel={playing ? "暫停影片" : "播放影片"} onPress={togglePlayback} disabled={source?.type === 'youtube' && !youtubeReady}><Ionicons name={playing ? 'pause' : 'play'} size={28} color={C.bg} /></Pressable>
          <Pressable style={styles.speedButton} accessibilityLabel="調整播放速度" onPress={() => { setSpeedOpen(true); keepYoutubeControlsVisible(false); }}><Text style={styles.speedText}>{speedLabel(speed)}</Text></Pressable>
          <Pressable style={styles.barButton} accessibilityLabel="剪輯影片長度" onPress={openTrim}><Ionicons name="cut-outline" size={23} color={C.text} /><Text style={styles.barLabel}>剪輯</Text></Pressable>
        </View>}

      </View>
      {!!(storageError || notice || syncStatus) && <View style={styles.notice} accessibilityLiveRegion="polite"><Text style={styles.noticeText}>{storageError || notice || syncStatus}</Text>{!!storageError && <Pressable onPress={retrySync}><Text style={styles.noticeText}>重新同步</Text></Pressable>}</View>}

      <Modal visible={Boolean(recordingResult)} transparent animationType="fade" onRequestClose={() => setRecordingResult(null)}>
        <View style={styles.recordingModalBackdrop}><View style={styles.recordingModal}>
          <Text style={styles.recordingModalTitle}>{recordingResult?.content === 'camera' ? '我的相機錄製完成' : '練習影片錄製完成'}</Text>
          <Text style={styles.recordingModalText}>{recordingResult?.content === 'camera' ? '輸出只包含你的相機畫面' : '已排除 App 按鈕與框線'}，共 {time(recordingResult?.duration || 0)}。</Text>
          <View style={styles.recordingModalActions}><Pressable style={styles.secondaryAction} onPress={() => setRecordingResult(null)}><Text style={styles.actionText}>關閉</Text></Pressable><Pressable style={styles.primaryAction} onPress={downloadRecording}><Text style={styles.primaryText}>下載影片</Text></Pressable></View>
        </View></View>
      </Modal>

      <EditorSheet visible={panelOpen && !nameDialog && !managedBookmark} title="AB 書籤" onClose={closeAbPanel}>
        <ScrollView horizontal style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
          {project.bookmarks.map((bookmark) => <View key={bookmark.id} style={styles.savedCard}>
            <Pressable onPress={() => selectBookmark(bookmark)} accessibilityLabel={`播放書籤${bookmark.title}`}><Text style={styles.savedTitle}>{bookmark.title}</Text><Text style={styles.smallText}>{preciseTime(bookmark.start)}–{preciseTime(bookmark.end)}</Text></Pressable>
            <Pressable accessibilityLabel={`管理書籤${bookmark.title}`} onPress={() => setManagedBookmark(bookmark)} style={styles.manageButton}><Ionicons name="ellipsis-horizontal" size={20} color={C.text} /></Pressable>
          </View>)}
          {!project.bookmarks.length && <Text style={styles.smallText}>選好區間後，按下方「儲存書籤」。</Text>}
        </ScrollView>
        {total > 0 && draftA != null && draftB != null ? <RangeEditor min={trimStart} max={timelineMaximum} a={draftA} b={draftB} source={source} player={player} fps={fps} onFpsChange={setFps} onChange={changeAbRange} position={position} /> : <Text style={styles.smallText}>等待影片載入，準備時間軸…</Text>}
        <View style={styles.editorActions}>
          <Pressable style={styles.secondaryAction} onPress={resetAB}><Text style={styles.actionText}>重設</Text></Pressable>
          <Pressable style={styles.secondaryAction} onPress={() => { if (draftB > draftA) { setPlayMode(playMode === 'ab-loop' ? 'full-loop' : 'ab-loop'); if (playMode !== 'ab-loop') seek(draftA); } }}><Text style={styles.actionText}>{playMode === 'ab-loop' ? '循環：開' : '循環：關'}</Text></Pressable>
          <Pressable style={styles.secondaryAction} onPress={() => { if (playing) setPlaying(false); else { setPlayMode('ab-loop'); seek(draftA); setPlaying(true); } }}><Text style={styles.actionText}>{playing ? '暫停' : '試播'}</Text></Pressable>
          <Pressable style={styles.primaryAction} onPress={addBookmark}><Text style={styles.primaryText}>儲存書籤</Text></Pressable>
        </View>
      </EditorSheet>
      <EditorSheet visible={trimOpen} title="剪輯長度" onClose={closeTrim}>
        {total > 0 ? <RangeEditor min={0} max={total} a={trimDraft.a} b={trimDraft.b} source={source} player={player} fps={fps} onFpsChange={setFps} onChange={(range, target) => { setTrimDraft(range); setPlaying(false); seek(target === 'a' ? range.a : range.b, true); }} position={position} /> : <Text style={styles.smallText}>等待影片載入…</Text>}
        <View style={styles.editorActions}><Pressable style={styles.secondaryAction} onPress={closeTrim}><Text style={styles.actionText}>取消</Text></Pressable><Pressable style={styles.secondaryAction} onPress={() => setTrimDraft({ a: 0, b: total })}><Text style={styles.actionText}>恢復全片</Text></Pressable><Pressable style={styles.primaryAction} onPress={applyTrim} disabled={!total}><Text style={styles.primaryText}>套用範圍</Text></Pressable></View>
      </EditorSheet>
      <EditorSheet visible={speedOpen} title="播放速度" onClose={() => setSpeedOpen(false)} compact>
        <Text style={styles.smallText}>目前 {speedLabel(speed)}{isYoutube && requestedSpeed !== speed ? ' · 正在套用…' : ''}</Text>
        <View style={styles.speedGrid}>{(isYoutube ? youtubeRates : [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]).map((rate) => <Pressable key={rate} accessibilityLabel={`速度${rate}倍`} style={[styles.rateOption, speed === rate && styles.rateActive]} onPress={() => changeSpeed(rate)}><Text style={styles.actionText}>{speedLabel(rate)}</Text></Pressable>)}</View>
        {isYoutube && <Text style={styles.smallText}>顯示此影片支援的速度，實際套用後更新。</Text>}
      </EditorSheet>
      <EditorSheet visible={Boolean(nameDialog)} title={nameDialog?.type === 'rename' ? '重新命名書籤' : '儲存書籤'} onClose={() => setNameDialog(null)} compact>
        <Text style={styles.smallText}>書籤名稱</Text>
        <TextInput accessibilityLabel="書籤名稱" style={styles.nameInput} value={bookmarkName} onChangeText={setBookmarkName} placeholder="例如：副歌第一段" placeholderTextColor={C.muted} maxLength={60} autoFocus returnKeyType="done" onSubmitEditing={saveBookmark} />
        <View style={styles.editorActions}><Pressable style={styles.secondaryAction} onPress={() => setNameDialog(null)}><Text style={styles.actionText}>取消</Text></Pressable><Pressable accessibilityLabel="確認儲存書籤" style={[styles.primaryAction, !bookmarkName.trim() && { opacity: 0.4 }]} onPress={saveBookmark} disabled={!bookmarkName.trim()}><Text style={styles.primaryText}>儲存</Text></Pressable></View>
      </EditorSheet>
      <EditorSheet visible={Boolean(managedBookmark)} title={managedBookmark?.title || '管理書籤'} onClose={() => setManagedBookmark(null)} compact>
        {managedBookmark && <>
          <ChoiceRow label="重新命名" onPress={() => renameBookmark(managedBookmark)} />
          <ChoiceRow label="更新為目前 AB 與速度" onPress={() => { updateProject(project.id, { bookmarks: project.bookmarks.map((item) => item.id === managedBookmark.id ? { ...item, start: draftA, end: draftB, speed } : item) }); setManagedBookmark(null); }} />
          <ChoiceRow label="向前移" onPress={() => moveBookmark(managedBookmark, -1)} /><ChoiceRow label="向後移" onPress={() => moveBookmark(managedBookmark, 1)} />
          <ChoiceRow label="複製" onPress={() => { updateProject(project.id, { bookmarks: [...project.bookmarks, { ...managedBookmark, id: `${Date.now()}`, title: `${managedBookmark.title} 副本` }] }); setManagedBookmark(null); }} />
          <ChoiceRow label="刪除書籤" onPress={() => { updateProject(project.id, { bookmarks: project.bookmarks.filter((item) => item.id !== managedBookmark.id) }); setManagedBookmark(null); }} />
        </>}
      </EditorSheet>
      <SettingsModal visible={settingsOpen} onClose={() => { setSettingsOpen(false); keepYoutubeControlsVisible(true); }} project={project} playMode={playMode} setPlayMode={setPlayMode} onTrim={() => { setSettingsOpen(false); openTrim(); }} position={position} total={total} cameraMode={cameraMode} setCameraMode={(value) => { setCameraMode(value); updateProject(project.id, { cameraMode: value }); }} recordingContent={recordingContent} setRecordingContent={(value) => { setRecordingContent(value); updateProject(project.id, { recordingContent: value }); }} update={(patch) => updateProject(project.id, patch)} />
    </View>
  );
}

function EditorSheet({ visible, title, onClose, compact = false, children }) {
  const { height } = useWindowDimensions();
  const [viewport, setViewport] = useState(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || !window.visualViewport) return undefined;
    const visual = window.visualViewport;
    const update = () => setViewport({ height: visual.height, top: visual.offsetTop });
    update(); visual.addEventListener('resize', update); visual.addEventListener('scroll', update);
    return () => { visual.removeEventListener('resize', update); visual.removeEventListener('scroll', update); };
  }, [visible]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.sheetBackdrop, Platform.OS === 'web' && viewport && { position: 'absolute', left: 0, right: 0, top: viewport.top, height: viewport.height }]}>
      <Pressable style={StyleSheet.absoluteFillObject} accessibilityLabel="關閉彈出框" onPress={onClose} />
      <View style={[styles.editorSheet, { maxHeight: compact ? (viewport?.height || height) * 0.85 : height * 0.59 }]}>
        <View style={styles.sheetHeading}><Text style={styles.sheetTitle}>{title}</Text><Pressable style={styles.close} accessibilityLabel={`關閉${title}`} onPress={onClose}><Ionicons name="close" size={23} color={C.text} /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function SettingsModal({ visible, onClose, onTrim, project, playMode, setPlayMode, position, total, cameraMode, setCameraMode, recordingContent, setRecordingContent, update }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.settingsSheet}><View style={styles.settingsHeader}><Text style={styles.settingsTitle}>練舞設定</Text><Pressable style={styles.close} onPress={onClose}><Ionicons name="close" size={23} color={C.text} /></Pressable></View><ScrollView showsVerticalScrollIndicator={false}>
    <Text style={styles.groupTitle}>播放模式</Text><ChoiceRow label="整支影片循環" selected={playMode === 'full-loop'} onPress={() => setPlayMode('full-loop')} /><ChoiceRow label="AB 區間循環" selected={playMode === 'ab-loop'} onPress={() => setPlayMode('ab-loop')} />
    <ChoiceRow label="剪輯影片長度" value="使用影格時間軸選取播放範圍" onPress={onTrim} />
    <Text style={styles.groupTitle}>裁切畫面</Text>{[['完整顯示', 'contain', 'auto'], ['填滿畫面', 'cover', 'auto'], ['9:16', 'contain', '9:16'], ['16:9', 'contain', '16:9'], ['1:1', 'contain', '1:1']].map(([label, crop, ratio]) => <ChoiceRow key={label} label={label} selected={project.crop === crop && project.aspectRatio === ratio} onPress={() => update({ crop, aspectRatio: ratio })} />)}
    <Text style={styles.groupTitle}>相機畫面模式</Text>{[['前鏡頭小窗', 'pip'], ['半透明全身疊加', 'overlay'], ['影片與相機左右分割', 'split']].map(([label, value]) => <ChoiceRow key={value} label={label} selected={cameraMode === value} onPress={() => setCameraMode(value)} />)}
    <Text style={styles.groupTitle}>錄影輸出內容</Text>{[['只錄我的相機', 'camera'], ['影片＋我的相機', 'composite']].map(([label, value]) => <ChoiceRow key={value} label={label} selected={recordingContent === value} onPress={() => setRecordingContent(value)} />)}
    <Text style={styles.groupTitle}>快進／後退秒數</Text><View style={styles.pills}>{[5, 10, 15].map((value) => <Pressable key={value} onPress={() => update({ skipSeconds: value })} style={[styles.settingPill, project.skipSeconds === value && styles.settingPillActive]}><Text style={[styles.settingPillText, project.skipSeconds === value && { color: C.bg }]}>{value} 秒</Text></Pressable>)}</View>
  </ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg }, fullscreen: { backgroundColor: '#000', ...(Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 } : {}) }, header: { height: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 }, iconButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#292929' }, headerTitle: { flex: 1, color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 17 }, stage: { marginHorizontal: 12, overflow: 'hidden', backgroundColor: '#050505', borderWidth: 1, borderColor: '#292929' }, youtubeStage: { flex: 1 }, stageFullscreen: { marginHorizontal: 0 }, fill: { width: '100%', height: '100%' }, videoLayer: { flex: 1 }, youtubeVideoLayer: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', justifyContent: 'center' }, youtubeTapTarget: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 2 }, sideTools: { position: 'absolute', right: 12, top: 13, gap: 9, zIndex: 8 }, roundTool: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(20,20,20,.84)', borderWidth: 1, borderColor: '#434343', alignItems: 'center', justifyContent: 'center' }, activeTool: { backgroundColor: C.lime, borderColor: C.lime }, camera: { position: 'absolute', overflow: 'hidden', borderWidth: 2, borderColor: C.lime, backgroundColor: '#111', zIndex: 4 }, cameraPip: { width: 118, height: 172, left: 13, bottom: 126, borderRadius: 19 }, cameraOverlay: { left: 0, top: 0, right: 0, bottom: 112, opacity: 0.46, borderWidth: 0 }, cameraSplit: { width: '50%', top: 0, right: 0, bottom: 112, borderRadius: 0 }, liveBadge: { position: 'absolute', left: 8, top: 8, borderRadius: 8, backgroundColor: C.lime, paddingHorizontal: 7, paddingVertical: 4 }, liveText: { color: C.bg, fontFamily: 'JetBrainsMono', fontSize: 9 }, countdown: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.55)', alignItems: 'center', justifyContent: 'center', zIndex: 12 }, countdownText: { color: C.lime, fontFamily: 'JetBrainsMono', fontSize: 84 }, timeline: { position: 'absolute', left: 14, right: 14, bottom: 86, height: 38, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 8 }, slider: { flex: 1, height: 36 }, clock: { color: C.text, fontFamily: 'JetBrainsMono', fontSize: 10 }, bottomBar: { position: 'absolute', left: 9, right: 9, bottom: 9, height: 72, borderRadius: 22, backgroundColor: 'rgba(25,25,25,.94)', borderWidth: 1, borderColor: '#414141', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 5, zIndex: 8 }, barButton: { width: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3 }, barLabel: { color: C.muted, fontSize: 9 }, play: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }, speedButton: { minWidth: 58, height: 48, borderRadius: 15, backgroundColor: '#292929', alignItems: 'center', justifyContent: 'center' }, speedText: { color: C.text, fontFamily: 'JetBrainsMono', fontSize: 15 }, dismissArea: { ...StyleSheet.absoluteFillObject, bottom: '51%', zIndex: 15 }, floatingPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '53%', minHeight: 350, backgroundColor: '#1B1B1B', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: '#3A3A3A', paddingTop: 14, zIndex: 16 }, panelHeader: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }, panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, panelTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 18 }, fold: { marginLeft: 'auto', width: 42, height: 42, borderRadius: 21, backgroundColor: '#303030', alignItems: 'center', justifyContent: 'center' }, foldLabel: { color: C.muted, marginLeft: 8 }, bookmarkList: { paddingHorizontal: 14, gap: 10, paddingVertical: 8 }, bookmark: { width: 122, height: 106, borderRadius: 16, backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#303030', padding: 9 }, bookmarkActive: { backgroundColor: C.lime, borderColor: C.lime }, bookmarkNumber: { color: C.muted, fontFamily: 'JetBrainsMono', fontSize: 10 }, bookmarkThumb: { flex: 1, alignItems: 'center', justifyContent: 'center' }, bookmarkTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 10 }, bookmarkTime: { color: C.muted, fontFamily: 'JetBrainsMono', fontSize: 8, marginTop: 2 }, addBookmark: { width: 105, height: 106, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#4A4A4A', alignItems: 'center', justifyContent: 'center' }, addBookmarkText: { color: C.muted, fontSize: 10, marginTop: 4 }, abEditor: { paddingHorizontal: 18, paddingTop: 3 }, abLabels: { flexDirection: 'row', gap: 10 }, abPoint: { flex: 1, borderRadius: 12, backgroundColor: '#262626', padding: 9 }, abName: { color: C.muted, fontSize: 9 }, abValue: { color: C.text, fontFamily: 'JetBrainsMono', fontSize: 11, marginTop: 2 }, panelFooter: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10, borderTopWidth: 1, borderColor: '#2D2D2D' }, panelAction: { minWidth: 58, alignItems: 'center', gap: 4 }, panelActionText: { color: C.muted, fontSize: 9 }, panelPlay: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }, speedStep: { width: 42, height: 50, alignItems: 'center', justifyContent: 'center' }, speedBox: { minWidth: 66, height: 54, borderRadius: 16, backgroundColor: '#292929', alignItems: 'center', justifyContent: 'center' }, speedBig: { color: C.text, fontFamily: 'JetBrainsMono', fontSize: 17 }, hintCard: { margin: 16, padding: 16, borderRadius: 20, backgroundColor: C.panel, borderWidth: 1, borderColor: '#282828' }, hintTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 13 }, hintText: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 5 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end' }, settingsSheet: { maxHeight: '88%', backgroundColor: '#181818', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, borderWidth: 1, borderColor: '#363636' }, settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, settingsTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 21 }, close: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#292929', alignItems: 'center', justifyContent: 'center' }, groupTitle: { color: C.lime, fontFamily: 'ZenGothic-Bold', fontSize: 11, letterSpacing: 1, marginTop: 19, marginBottom: 6 }, choice: { minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#2C2C2C' }, choiceLabel: { color: C.text, fontSize: 14 }, choiceValue: { color: C.muted, fontSize: 10, marginTop: 2 }, trimRow: { flexDirection: 'row', gap: 10 }, trimButton: { flex: 1, borderRadius: 15, backgroundColor: '#242424', padding: 13 }, trimLabel: { color: C.muted, fontSize: 10 }, trimValue: { color: C.text, fontFamily: 'JetBrainsMono', fontSize: 16, marginTop: 4 }, pills: { flexDirection: 'row', gap: 9 }, settingPill: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#292929', alignItems: 'center', justifyContent: 'center' }, settingPillActive: { backgroundColor: C.lime }, settingPillText: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 12 },
  invalidVideo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, invalidVideoTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 17, marginTop: 10 }, invalidVideoText: { color: C.muted, fontSize: 11, marginTop: 6, textAlign: 'center' },
});

Object.assign(styles, {
  recordButton: { width: 62, borderRadius: 14, backgroundColor: 'rgba(200,255,53,.10)' },
  recordButtonActive: { backgroundColor: 'rgba(255,104,104,.14)' },
  recordLabel: { color: C.lime, fontFamily: 'ZenGothic-Bold', fontSize: 10 },
  recordingModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.78)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  recordingModal: { width: '100%', maxWidth: 460, borderRadius: 22, backgroundColor: '#1B1B1B', borderWidth: 1, borderColor: '#434343', padding: 20 },
  recordingModalTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 19 },
  recordingModalText: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 9 },
  recordingModalActions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.15)' },
  editorSheet: { backgroundColor: '#191B17', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#44483B', paddingHorizontal: 18, paddingBottom: 8, width: '100%', maxWidth: 700, alignSelf: 'center' },
  sheetHeading: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: C.text, fontSize: 19, fontWeight: '700' },
  editorActions: { flexDirection: 'row', gap: 7, marginTop: 14 },
  primaryAction: { flex: 1.3, minHeight: 46, borderRadius: 12, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  primaryText: { color: C.bg, fontSize: 13, fontWeight: '700' },
  secondaryAction: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: '#30332B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  actionText: { color: C.text, fontSize: 13 }, smallText: { color: '#B6BAAE', fontSize: 12, lineHeight: 19 },
  savedCard: { backgroundColor: '#292D23', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, savedTitle: { color: C.lime, fontSize: 13, marginBottom: 3 }, manageButton: { minWidth: 40, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  speedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 }, rateOption: { minWidth: 68, minHeight: 48, borderWidth: 1, borderColor: '#4B5041', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, rateActive: { borderColor: C.lime, backgroundColor: '#35431D' },
  nameInput: { color: C.text, backgroundColor: '#292D23', minHeight: 50, fontSize: 16, padding: 12, marginTop: 8, borderWidth: 1, borderColor: C.lime, borderRadius: 12 },
  notice: { position: 'absolute', top: 66, left: 20, right: 20, borderRadius: 12, padding: 12, backgroundColor: '#34411F', zIndex: 70 }, noticeText: { color: C.text, fontSize: 13 },
  abPointActive: { borderWidth: 1, borderColor: C.lime },
  abHint: { color: C.muted, fontSize: 8, marginTop: 4 },
  abTimeline: { height: 86, marginTop: 9, justifyContent: 'center', touchAction: 'none' },
  abTimelineTouch: { ...StyleSheet.absoluteFillObject, zIndex: 1, touchAction: 'none' },
  abFilmstrip: { position: 'absolute', left: 0, right: 0, top: 15, height: 56, flexDirection: 'row', overflow: 'hidden', borderRadius: 9, backgroundColor: '#292929', borderWidth: 1, borderColor: '#494949' },
  abFrame: { flex: 1, height: '100%', minWidth: 1, opacity: 0.86 },
  abFramePlaceholder: { backgroundColor: '#3A3A3A', borderRightWidth: 1, borderRightColor: '#505050' },
  abTrack: { position: 'absolute', left: 0, right: 0, top: 15, height: 56, borderRadius: 9, backgroundColor: 'transparent', borderWidth: 2, borderColor: '#FFFFFF' },
  abRange: { position: 'absolute', top: 15, height: 56, borderRadius: 8, backgroundColor: 'rgba(200,255,53,.28)', borderWidth: 3, borderColor: C.lime },
  abHandle: { position: 'absolute', top: 7, width: 32, height: 72, borderRadius: 9, alignItems: 'center', justifyContent: 'center', zIndex: 3, borderWidth: 2, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4, touchAction: 'none' },
  abHandleA: { backgroundColor: C.lime, borderColor: C.lime },
  abHandleB: { backgroundColor: C.text, borderColor: C.text },
  abHandleUnset: { opacity: 0.65 },
  abHandleText: { color: C.bg, fontFamily: 'JetBrainsMono', fontSize: 9 },
  abQuickActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  abInstruction: { color: C.muted, fontSize: 9, flex: 1 },
  abReset: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 5 },
  abResetText: { color: C.muted, fontSize: 9 },
});
