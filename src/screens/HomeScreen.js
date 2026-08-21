import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { createVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProjects } from '../store/ProjectContext';

const C = { bg: '#0D0D0D', card: '#1B1B1B', line: '#2B2B2B', lime: '#C8FF35', text: '#F4F4F2', muted: '#9A9A96' };
const youtubeId = (value) => value.trim().match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/i)?.[1];
const BRAND_LOGO = require('../../assets/icon.png');
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

function ProjectCover({ project, onThumbnailReady }) {
  const localUri = project.source?.type === 'local' ? project.source.uri : null;
  const [thumbnail, setThumbnail] = useState(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setThumbnail(null);

    if (!localUri) return undefined;

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
            if (active && project.thumbnailKey !== cacheKey) onThumbnailReady?.(cacheKey);
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
  const { projects, hydrated, addProject, updateProject, deleteProject, duplicateProject } = useProjects();
  const [addOpen, setAddOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const openProject = (project) => navigation.navigate('Practice', { projectId: project.id });

  const importLocal = async () => {
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
    const id = youtubeId(youtubeUrl);
    if (!id) return Alert.alert('無法辨識連結', '請貼上有效的 YouTube 影片或 Shorts 連結。');
    const project = addProject({ title: 'YouTube 練習', source: { type: 'youtube', id, uri: youtubeUrl.trim() }, coverUri: `https://img.youtube.com/vi/${id}/hqdefault.jpg` });
    setYoutubeUrl(''); setYoutubeOpen(false); openProject(project);
  };

  const rename = (project) => Alert.prompt('重新命名', '輸入新的練舞專案名稱', (title) => title?.trim() && updateProject(project.id, { title: title.trim() }), 'plain-text', project.title);
  const remove = (project) => Alert.alert('刪除練舞專案？', '只會刪除 APP 內的專案資料，不會刪除手機相簿原始影片。', [{ text: '取消', style: 'cancel' }, { text: '刪除', style: 'destructive', onPress: () => deleteProject(project.id) }]);
  const manage = (project) => Alert.alert(project.title, '選擇專案操作', [{ text: '重新命名', onPress: () => rename(project) }, { text: '複製', onPress: () => duplicateProject(project.id) }, { text: '刪除', style: 'destructive', onPress: () => remove(project) }, { text: '取消', style: 'cancel' }]);

  const renderProject = ({ item }) => (
    <Pressable onPress={() => openProject(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`開始練習 ${item.title}`}>
      <View style={styles.cover}>
        <ProjectCover project={item} onThumbnailReady={(thumbnailKey) => updateProject(item.id, { thumbnailKey })} />
        <Pressable onPress={() => manage(item)} hitSlop={10} style={styles.more} accessibilityLabel={`${item.title} 更多選項`}><Ionicons name="ellipsis-vertical" size={20} color={C.text} /></Pressable>
        <View style={styles.sourceBadge}><Ionicons name={item.source?.type === 'youtube' ? 'logo-youtube' : 'phone-portrait-outline'} size={12} color={C.bg} /><Text style={styles.sourceText}>{item.source?.type === 'youtube' ? 'YouTube' : '相簿'}</Text></View>
      </View>
      <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMeta}>{formatDuration(item.durationMs)} · {formatDate(item.createdAt)}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}><View><Text style={styles.brand}>JUST GROOVE</Text><Text style={styles.subtitle}>選一段，開始練。</Text></View><Pressable style={styles.headerButton} onPress={() => Alert.alert('APP 設定', '練舞相關設定會保存在每個專案中。')} accessibilityLabel="APP 設定"><Ionicons name="settings-outline" size={23} color={C.text} /></Pressable></View>
      <Pressable style={styles.primary} onPress={() => setAddOpen(true)}><Ionicons name="add" size={24} color={C.bg} /><Text style={styles.primaryText}>新增練舞專案</Text></Pressable>
      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>我的練舞專案</Text><Text style={styles.count}>{projects.length}</Text></View>
      {!hydrated ? <ActivityIndicator color={C.lime} style={{ marginTop: 60 }} /> : (
        <FlatList data={projects} keyExtractor={(item) => item.id} renderItem={renderProject} numColumns={2} columnWrapperStyle={styles.columns} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.empty}><Ionicons name="albums-outline" size={38} color={C.muted} /><Text style={styles.emptyTitle}>還沒有練舞專案</Text><Text style={styles.emptyText}>從手機相簿或 YouTube 加入第一支影片。</Text></View>} />
      )}

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}><Pressable style={styles.backdrop} onPress={() => setAddOpen(false)}><View style={styles.sheet}><Text style={styles.sheetTitle}>新增練舞專案</Text><Pressable style={styles.option} onPress={importLocal}><Ionicons name="images-outline" size={22} color={C.lime} /><View><Text style={styles.optionTitle}>從手機相簿選擇</Text><Text style={styles.optionText}>使用你已保存的練舞影片</Text></View></Pressable><Pressable style={styles.option} onPress={() => { setAddOpen(false); setYoutubeOpen(true); }}><Ionicons name="logo-youtube" size={22} color="#FF5D5D" /><View><Text style={styles.optionTitle}>加入 YouTube</Text><Text style={styles.optionText}>貼上影片或 Shorts 連結</Text></View></Pressable></View></Pressable></Modal>
      <Modal visible={youtubeOpen} transparent animationType="fade" onRequestClose={() => setYoutubeOpen(false)}><View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>YouTube 練舞專案</Text><TextInput value={youtubeUrl} onChangeText={setYoutubeUrl} placeholder="貼上 YouTube 連結" placeholderTextColor="#69696D" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} /><View style={styles.actions}><Pressable style={styles.cancel} onPress={() => setYoutubeOpen(false)}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable style={styles.confirm} onPress={importYoutube}><Text style={styles.confirmText}>建立專案</Text></Pressable></View></View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 18 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }, brand: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 23, letterSpacing: 1.5 }, subtitle: { color: C.muted, marginTop: 3 }, headerButton: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }, primary: { minHeight: 56, borderRadius: 19, backgroundColor: C.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 25 }, primaryText: { color: C.bg, fontFamily: 'ZenGothic-Bold', fontSize: 16 }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 17 }, count: { color: C.lime, fontFamily: 'JetBrainsMono' }, list: { paddingBottom: 30 }, columns: { gap: 12 }, card: { flex: 1, marginBottom: 18, maxWidth: '49%' }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] }, cover: { aspectRatio: 0.84, borderRadius: 22, overflow: 'hidden', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }, coverImage: { width: '100%', height: '100%' }, more: { position: 'absolute', top: 10, right: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(10,10,10,.8)', alignItems: 'center', justifyContent: 'center' }, sourceBadge: { position: 'absolute', left: 10, bottom: 10, borderRadius: 10, backgroundColor: C.lime, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', gap: 4, alignItems: 'center' }, sourceText: { color: C.bg, fontSize: 9, fontFamily: 'ZenGothic-Bold' }, cardTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 14, lineHeight: 19, marginTop: 9 }, cardMeta: { color: C.muted, fontSize: 10, marginTop: 4 }, empty: { alignItems: 'center', paddingTop: 75 }, emptyTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 18, marginTop: 15 }, emptyText: { color: C.muted, marginTop: 7, textAlign: 'center' }, backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end', padding: 16 }, sheet: { backgroundColor: '#1D1D1D', borderRadius: 26, padding: 20, paddingBottom: 28, borderWidth: 1, borderColor: '#343434' }, sheetTitle: { color: C.text, fontFamily: 'ZenGothic-Bold', fontSize: 19, marginBottom: 16 }, option: { minHeight: 68, borderRadius: 18, backgroundColor: '#121212', borderWidth: 1, borderColor: C.line, flexDirection: 'row', gap: 13, alignItems: 'center', paddingHorizontal: 16, marginTop: 10 }, optionTitle: { color: C.text, fontFamily: 'ZenGothic-Bold' }, optionText: { color: C.muted, fontSize: 11, marginTop: 3 }, input: { minHeight: 52, borderRadius: 16, backgroundColor: '#111', borderWidth: 1, borderColor: '#383838', color: C.text, paddingHorizontal: 15 }, actions: { flexDirection: 'row', gap: 10, marginTop: 16 }, cancel: { flex: 1, minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: '#414141', alignItems: 'center', justifyContent: 'center' }, confirm: { flex: 1, minHeight: 50, borderRadius: 16, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: C.text }, confirmText: { color: C.bg, fontFamily: 'ZenGothic-Bold' },
});

Object.assign(styles, {
  cover: { aspectRatio: 1 },
  logoFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  logoImage: { width: '42%', height: '42%' },
});
