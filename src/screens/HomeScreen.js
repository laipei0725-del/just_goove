import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { createVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProjects } from '../store/ProjectContext';
import { captureVideoFrameAsync } from '../utils/captureVideoFrame';
import ProjectMenu from '../components/ProjectMenu';
import OnboardingOverlay from '../components/OnboardingOverlay';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import AppErrorBoundary from '../components/AppErrorBoundary';
const { extractYouTubeId } = require('../utils/youtubeUrl.cjs');

const C = { bg: '#0D0D0D', card: '#1B1B1B', line: '#2B2B2B', lime: '#C8FF35', text: '#F4F4F2', muted: '#9A9A96' };
const BRAND_LOGO = require('../../assets/icon.png');
const AUTH_INTENT_KEY = 'just-groove:auth-intent';
const thumbnailKeyFor = (project) => project.thumbnailKey || `justgroove-thumbnail-${project.id}`;
const formatDuration = (durationMs) => {
  if (!Number.isFinite(durationMs) || durationMs < 0) return '--:--';
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const formatDate = (value) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '----/--/--';
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
};

function ProjectCover({ project, onCoverReady }) {
  const localUri = project.source?.type === 'local' ? project.source.uri : null;
  const [thumbnail, setThumbnail] = useState(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setThumbnail(null);

    if (!localUri) return undefined;
    if (project.coverUri) {
      setThumbnail(project.coverUri);
      return undefined;
    }

    if (Platform.OS === 'web') {
      // expo-video cannot extract frames on web, so capture one with a <video> element instead.
      captureVideoFrameAsync(localUri, { time: 0, maxWidth: 480, maxHeight: 640 }).then((frame) => {
        if (active && frame) { setThumbnail(frame); onCoverReady?.(frame); }
        else if (active) setFailed(true);
      });
      return () => { active = false; };
    }

    const player = createVideoPlayer(localUri);
    const cacheKey = thumbnailKeyFor(project);

    const generateThumbnail = async () => {
      try {
        const cached = await Image.readFromCacheAsync(cacheKey);
        if (active && cached) {
          setThumbnail(cached);
          return;
        }
      } catch {}

      // The home grid is rendered before a PHAsset/file player is ready on
      // some iOS versions. Retry after the native player has had time to load
      // instead of permanently falling back to the camera placeholder.
      for (const delay of [0, 250, 800, 1600]) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        if (!active) return;
        try {
          // Pass [0] explicitly so this is the first frame, not one second in.
          const images = await player.generateThumbnailsAsync([0], { maxWidth: 480, maxHeight: 640 });
          if (images?.[0]) {
            let imageRef = images[0];
            try { imageRef = await Image.loadAsync(images[0]); } catch {}
            try { await Image.writeToCacheAsync(imageRef, cacheKey); } catch {}
            if (active) onCoverReady?.(imageRef);
            setThumbnail(imageRef);
            return;
          }
        } catch {}
      }
      if (active) setFailed(true);
    };

    generateThumbnail();

    return () => { active = false; player.release(); };
  }, [localUri, project.id, project.thumbnailKey, retry]);

  const retryThumbnail = () => setRetry((value) => value + 1);
  const source = project.source?.type === 'youtube' ? project.coverUri : thumbnail;
  if (!source || failed) {
    return <Pressable style={styles.logoFallback} onPress={retryThumbnail} accessibilityLabel="重新產生影片縮圖">
      <Image pointerEvents="none" source={BRAND_LOGO} style={styles.logoImage} contentFit="contain" />
    </Pressable>;
  }

  return <Image pointerEvents="none" source={source} style={styles.coverImage} contentFit="cover" transition={180} onError={() => setFailed(true)} accessibilityLabel={`${project.title} 影片縮圖`} />;
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { projects, hydrated, storageError, syncStatus, retrySync, ownerId, addProject, updateProject, deleteProject, duplicateProject } = useProjects();
  const { user, signOut, isGuest, signInWithEmail, signUpWithEmail } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeError, setYoutubeError] = useState('');
  const [menuProject, setMenuProject] = useState(null);
  const [renameProject, setRenameProject] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [onboarding, setOnboarding] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    try { if (!globalThis?.localStorage?.getItem(`hasSeenOnboarding:${ownerId}`)) setOnboarding(true); } catch {}
  }, [hydrated, ownerId]);

  useEffect(() => {
    if (isGuest) return;
    let shouldOpen = pendingAdd;
    try { shouldOpen = shouldOpen || globalThis?.sessionStorage?.getItem(AUTH_INTENT_KEY) === 'add-project'; } catch {}
    if (!shouldOpen) return;
    try { globalThis?.sessionStorage?.removeItem(AUTH_INTENT_KEY); } catch {}
    setPendingAdd(false);
    setAuthOpen(false);
    setAddOpen(true);
  }, [isGuest, pendingAdd]);

  const openProject = (project) => navigation.navigate('Practice', { projectId: project.id });

  const requireAccount = (next) => {
    if (!isGuest) return next();
    setPendingAdd(true);
    try { globalThis?.sessionStorage?.setItem(AUTH_INTENT_KEY, 'add-project'); } catch {}
    setAuthOpen(true);
  };

  const cancelAuthIntent = () => {
    setPendingAdd(false);
    try { globalThis?.sessionStorage?.removeItem(AUTH_INTENT_KEY); } catch {}
    setAuthOpen(false);
  };

  const importLocal = async () => {
    if (isGuest) return requireAccount(() => {});
    setAddOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('需要相簿權限', '請允許 JUST GROOVE 讀取影片，才能建立練舞專案。');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    const project = addProject({ title: (asset.fileName || '我的練舞影片').replace(/\.[^.]+$/, ''), source: { type: 'local', uri: asset.uri, assetId: asset.assetId || null }, durationMs: asset.duration || null });
    openProject(project);
  };

  const importYoutube = () => {
    if (isGuest) return requireAccount(() => {});
    const id = extractYouTubeId(youtubeUrl);
    if (!id) return setYoutubeError('請輸入正確的 YouTube 影片連結');
    try {
      const project = addProject({ title: 'YouTube 練習', source: { type: 'youtube', id, uri: `https://www.youtube.com/watch?v=${id}` }, coverUri: `https://img.youtube.com/vi/${id}/hqdefault.jpg`, durationMs: null });
      setYoutubeUrl(''); setYoutubeError(''); setYoutubeOpen(false); openProject(project);
    } catch {
      setYoutubeError('影片目前無法加入，請稍後再試');
    }
  };

  const sortedProjects = [...projects].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updatedAt || 0) - (a.updatedAt || 0));
  const startRename = (project) => { setMenuProject(null); setRenameProject(project); setRenameValue(project.title); };
  const confirmRename = () => { const title = renameValue.trim(); if (title && renameProject) updateProject(renameProject.id, { title }); setRenameProject(null); };
  const askDelete = (project) => { setMenuProject(null); setDeleteTarget(project); };
  const confirmDelete = async () => {
    if (deleting || !deleteTarget) return;
    setDeleting(true);
    try { await deleteProject(deleteTarget.id); setDeleteTarget(null); }
    catch { /* The shared sync banner shows the failure and retains the project. */ }
    finally { setDeleting(false); }
  };

  const renderProject = ({ item }) => (
    <Pressable onPress={() => openProject(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`開始練習 ${item.title}`}>
      <View style={styles.cover}>
        <AppErrorBoundary resetKey={item.id}><ProjectCover project={item} onCoverReady={(coverUri) => updateProject(item.id, { coverUri })} /></AppErrorBoundary>
        <Pressable onPress={() => setMenuProject(item)} hitSlop={10} style={styles.more} accessibilityLabel={`${item.title} 更多選項`}><Ionicons name="ellipsis-vertical" size={20} color={C.text} /></Pressable>
        {item.pinned ? <View style={styles.pinBadge}><Ionicons name="pin" size={12} color={C.bg} /></View> : null}
        <View style={styles.sourceBadge}><Ionicons name={item.source?.type === 'youtube' ? 'logo-youtube' : 'phone-portrait-outline'} size={12} color={C.bg} /><Text style={styles.sourceText}>{item.source?.type === 'youtube' ? 'YouTube' : '相簿'}</Text></View>
      </View>
      <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMeta}>{formatDuration(item.durationMs)} · {formatDate(item.createdAt)}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}><Pressable style={styles.brandLink} onPress={() => navigation.navigate('Home')} accessibilityLabel="返回 JUST GROOVE 首頁"><Image source={BRAND_LOGO} style={styles.brandIcon} contentFit="contain" /><View><Text style={styles.brand}>JUST GROOVE</Text><Text style={styles.subtitle}>{isGuest ? '訪客模式 · 選一段，開始練。' : `嗨，${user?.email?.split('@')[0] || '舞者'} · 選一段，開始練。`}</Text></View></Pressable><Pressable style={styles.headerButton} onPress={() => isGuest ? setAuthOpen(true) : signOut?.()} accessibilityLabel="帳號設定"><Ionicons name={isGuest ? 'person-outline' : 'person'} size={23} color={C.text} /></Pressable></View>
      <Pressable style={styles.primary} onPress={() => requireAccount(() => setAddOpen(true))}><Ionicons name="add" size={24} color={C.bg} /><Text style={styles.primaryText}>新增練舞專案</Text></Pressable>
      <View style={styles.recordingHint} accessibilityLabel="錄影功能提示"><Ionicons name="radio-button-on" size={18} color={C.lime} /><View style={{ flex: 1 }}><Text style={styles.recordingHintTitle}>錄影在練舞畫面</Text><Text style={styles.recordingHintText}>開啟專案後，底部工具列會看到「錄影」。目前合成錄影需要桌面版 Chrome。</Text></View></View>
      {storageError ? <View style={styles.storageWarning}><Ionicons name="shield-checkmark-outline" size={18} color={C.lime} /><Text style={styles.storageWarningText}>{storageError}</Text></View> : null}
      {!!syncStatus && <Text accessibilityLiveRegion="polite" style={{ color: C.lime, marginBottom: 10 }}>{syncStatus}</Text>}
      {!!storageError && <Pressable onPress={retrySync} style={styles.cancel}><Text style={styles.cancelText}>重新同步</Text></Pressable>}
      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>我的練舞專案</Text><Text style={styles.count}>{projects.length}</Text></View>
      {!hydrated ? <ActivityIndicator color={C.lime} style={{ marginTop: 60 }} /> : (
        <FlatList data={sortedProjects} keyExtractor={(item) => item.id} renderItem={renderProject} numColumns={2} columnWrapperStyle={styles.columns} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.empty}><Ionicons name="albums-outline" size={38} color={C.muted} /><Text style={styles.emptyTitle}>還沒有練舞專案</Text><Text style={styles.emptyText}>從手機相簿或 YouTube 加入第一支影片。</Text></View>} />
      )}

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}><Pressable style={styles.backdrop} onPress={() => setAddOpen(false)}><View style={styles.sheet}><Text style={styles.sheetTitle}>新增練舞專案</Text><Pressable style={styles.option} onPress={importLocal}><Ionicons name="images-outline" size={22} color={C.lime} /><View><Text style={styles.optionTitle}>從手機相簿選擇</Text><Text style={styles.optionText}>使用你已保存的練舞影片</Text></View></Pressable><Pressable style={styles.option} onPress={() => { setAddOpen(false); setYoutubeOpen(true); }}><Ionicons name="logo-youtube" size={22} color="#FF5D5D" /><View><Text style={styles.optionTitle}>加入 YouTube</Text><Text style={styles.optionText}>貼上影片或 Shorts 連結</Text></View></Pressable></View></Pressable></Modal>
      <Modal visible={youtubeOpen} transparent animationType="fade" onRequestClose={() => setYoutubeOpen(false)}>
        <KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.centeredBackdrop} onPress={() => setYoutubeOpen(false)}>
            <View style={[styles.sheet, styles.youtubeSheet]} onStartShouldSetResponder={() => true}>
              <Text style={styles.sheetTitle}>YouTube 練舞專案</Text>
              <TextInput value={youtubeUrl} onChangeText={(value) => { setYoutubeUrl(value); if (youtubeError) setYoutubeError(''); }} placeholder="貼上 YouTube 連結" placeholderTextColor="#69696D" autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="done" style={[styles.input, youtubeError && styles.inputError]} />
              {youtubeError ? <Text accessibilityRole="alert" style={styles.youtubeError}>{youtubeError}</Text> : null}
              <View style={styles.actions}><Pressable style={styles.cancel} onPress={() => setYoutubeOpen(false)}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable style={styles.confirm} onPress={importYoutube}><Text style={styles.confirmText}>建立專案</Text></Pressable></View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      <ProjectMenu visible={Boolean(menuProject)} project={menuProject} onClose={() => setMenuProject(null)} onPin={() => { updateProject(menuProject.id, { pinned: !menuProject.pinned }); setMenuProject(null); }} onRename={() => startRename(menuProject)} onDuplicate={() => { duplicateProject(menuProject.id); setMenuProject(null); }} onDelete={() => askDelete(menuProject)} />
      <Modal visible={Boolean(renameProject)} transparent animationType="fade" onRequestClose={() => setRenameProject(null)}><KeyboardAvoidingView style={styles.centeredBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.dialog}><Text style={styles.sheetTitle}>重新命名專案</Text><TextInput autoFocus value={renameValue} onChangeText={setRenameValue} style={styles.input} placeholder="輸入專案名稱" placeholderTextColor="#69696D" /><View style={styles.actions}><Pressable style={styles.cancel} onPress={() => setRenameProject(null)}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable style={styles.confirm} onPress={confirmRename}><Text style={styles.confirmText}>儲存</Text></Pressable></View></View></KeyboardAvoidingView></Modal>
      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}><View style={styles.centeredBackdrop}><View style={styles.dialog}><Text style={styles.sheetTitle}>刪除這個專案？</Text><Text style={styles.dialogCopy}>「{deleteTarget?.title}」的專案與雲端影片將被刪除，原始相簿影片保留。</Text><View style={styles.actions}><Pressable style={styles.cancel} onPress={() => setDeleteTarget(null)}><Text style={styles.cancelText}>保留</Text></Pressable><Pressable style={styles.dangerConfirm} disabled={deleting} onPress={confirmDelete}><Text style={styles.confirmText}>{deleting ? '刪除中…' : '刪除'}</Text></Pressable></View></View></View></Modal>
      <OnboardingOverlay userId={ownerId} visible={onboarding} onClose={() => setOnboarding(false)} />
      <AuthModal visible={authOpen} contextMessage={pendingAdd ? '請先登入以儲存練舞專案，登入後會接著讓你選擇相簿或 YouTube。' : undefined} onClose={cancelAuthIntent} onAuthenticated={() => setAuthOpen(false)} onContinueGuest={cancelAuthIntent} signInWithEmail={signInWithEmail} signUpWithEmail={signUpWithEmail} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 18 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }, brandLink: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }, brandIcon: { width: 42, height: 42, borderRadius: 12 }, brand: { color: C.lime, fontFamily: 'ZenGothic-Bold', fontSize: 20, letterSpacing: 1.5 }, subtitle: { color: C.muted, marginTop: 3, fontSize: 11 }, headerButton: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }, primary: { minHeight: 56, borderRadius: 19, backgroundColor: C.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 25 }, primaryText: { color: C.bg, fontFamily: 'ZenGothic-Bold', fontSize: 16 }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 17 }, count: { color: C.lime, fontFamily: 'JetBrainsMono' }, list: { paddingBottom: 30 }, columns: { gap: 12 }, card: { flex: 1, marginBottom: 18, maxWidth: '49%' }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] }, cover: { aspectRatio: 0.84, borderRadius: 22, overflow: 'hidden', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }, coverImage: { width: '100%', height: '100%' }, more: { position: 'absolute', top: 10, right: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(10,10,10,.8)', alignItems: 'center', justifyContent: 'center' }, sourceBadge: { position: 'absolute', left: 10, bottom: 10, borderRadius: 10, backgroundColor: C.lime, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', gap: 4, alignItems: 'center' }, sourceText: { color: C.bg, fontSize: 9, fontFamily: 'ZenGothic-Bold' }, cardTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 14, lineHeight: 19, marginTop: 9 }, cardMeta: { color: C.muted, fontSize: 10, marginTop: 4 }, empty: { alignItems: 'center', paddingTop: 75 }, emptyTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 18, marginTop: 15 }, emptyText: { color: C.muted, marginTop: 7, textAlign: 'center' }, backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end', padding: 16 }, sheet: { backgroundColor: '#1D1D1D', borderRadius: 26, padding: 20, paddingBottom: 28, borderWidth: 1, borderColor: '#343434' }, sheetTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 19, marginBottom: 16 }, option: { minHeight: 68, borderRadius: 18, backgroundColor: '#121212', borderWidth: 1, borderColor: C.line, flexDirection: 'row', gap: 13, alignItems: 'center', paddingHorizontal: 16, marginTop: 10 }, optionTitle: { color: C.text, fontFamily: 'ZenGothic-Bold' }, optionText: { color: C.muted, fontSize: 11, marginTop: 3 }, input: { minHeight: 52, borderRadius: 16, backgroundColor: '#111', borderWidth: 1, borderColor: '#383838', color: C.text, paddingHorizontal: 15 }, inputError: { borderColor: '#FF6868' }, youtubeError: { color: '#FF8686', fontSize: 12, marginTop: 8 }, actions: { flexDirection: 'row', gap: 10, marginTop: 16 }, cancel: { flex: 1, minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: '#414141', alignItems: 'center', justifyContent: 'center' }, confirm: { flex: 1, minHeight: 50, borderRadius: 16, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: C.text }, confirmText: { color: C.bg, fontFamily: 'ZenGothic-Bold' },
});

Object.assign(styles, {
  cover: { aspectRatio: 1 },
  logoFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  logoImage: { width: '42%', height: '42%' },
  keyboardAvoider: { flex: 1 },
  centeredBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  youtubeSheet: { width: '100%', maxWidth: 520 },
  storageWarning: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderRadius: 14, backgroundColor: '#20281A', borderWidth: 1, borderColor: '#4B6421', padding: 12, marginBottom: 16 },
  storageWarningText: { flex: 1, color: C.text, fontSize: 12, lineHeight: 18 },
  recordingHint: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 14, backgroundColor: '#20281A', borderWidth: 1, borderColor: '#4B6421', padding: 12, marginBottom: 18 },
  recordingHintTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 12 },
  recordingHintText: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  pinBadge: { position: 'absolute', top: 10, left: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: 520, backgroundColor: '#1D1D1D', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#343434' },
  dialogCopy: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  dangerConfirm: { flex: 1, minHeight: 50, borderRadius: 16, backgroundColor: '#FF6B6B', alignItems: 'center', justifyContent: 'center' },
});
