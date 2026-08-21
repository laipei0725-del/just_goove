import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function LibraryScreen({ navigation }) {
  // Video database state
  const [videos, setVideos] = useState([
    {
      id: '1',
      title: 'NewJeans - How Sweet (Choreography)',
      uri: 'https://www.youtube.com/watch?v=A7n0O4T9tOk',
      type: 'youtube',
      tag: 'K-Pop',
      playCount: 12,
      notes: '注意副歌部分腳步滑動動作要輕盈，膝蓋微雙重下沉。',
    },
    {
      id: '2',
      title: 'Hip Hop Bounce & Basics Tutorial',
      uri: 'https://www.youtube.com/watch?v=EP_S5_2bAew',
      type: 'youtube',
      tag: 'Hip Hop',
      playCount: 8,
      notes: '注意身體律動 (Bounce) 與拍子重音的咬合，Up & Down 切換要自然。',
    },
  ]);

  // Categories list
  const categories = ['全部', 'K-Pop', 'Hip Hop', 'Choreography', 'House'];
  const [selectedCategory, setSelectedCategory] = useState('全部');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('playCount'); // 'playCount' | 'title'

  // Add Video Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUri, setNewUri] = useState('');
  const [newType, setNewType] = useState('youtube'); // 'youtube' | 'local'
  const [newTag, setNewTag] = useState('K-Pop');
  const [newNotes, setNewNotes] = useState('');

  // Handle Pick Local Video for New Library Item
  const handlePickLocalVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('需要相簿權限才能匯入影片！');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setNewUri(asset.uri);
      setNewType('local');
      if (!newTitle) {
        setNewTitle(asset.fileName || '本機影片 ' + new Date().toLocaleDateString());
      }
    }
  };

  const handleAddVideo = () => {
    if (!newTitle || !newUri) {
      alert('請填寫影片名稱與連結／選取本機檔案！');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      title: newTitle,
      uri: newUri,
      type: newType,
      tag: newTag,
      playCount: 0,
      notes: newNotes,
    };

    setVideos([newItem, ...videos]);
    setAddModalVisible(false);

    // Reset input fields
    setNewTitle('');
    setNewUri('');
    setNewType('youtube');
    setNewTag('K-Pop');
    setNewNotes('');
  };

  // Filter & Sort Videos
  const filteredVideos = videos
    .filter((v) => {
      const matchQuery = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === '全部' || v.tag === selectedCategory;
      return matchQuery && matchCat;
    })
    .sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return b.playCount - a.playCount; // default sort by playcount
    });

  // Select video item -> navigate to Practice Screen and trigger play
  const handleSelectVideo = (item) => {
    // Increment play count
    setVideos(
      videos.map((v) => (v.id === item.id ? { ...v, playCount: v.playCount + 1 } : v))
    );
    // Navigate to Practice tab passing parameters
    navigation.navigate('Practice', {
      videoUri: item.uri,
      videoType: item.type,
    });
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#9A9A96" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜尋影片名稱..."
            placeholderTextColor="#9A9A96"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add" size={24} color="#0D0D0D" />
        </TouchableOpacity>
      </View>

      {/* Categories Horizontal Scroll */}
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryTab, selectedCategory === cat && styles.categoryTabActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Sorting panel */}
      <View style={styles.sortRow}>
        <Text style={styles.resultCount}>共 {filteredVideos.length} 個影片</Text>
        <View style={styles.sortOptions}>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'playCount' && styles.sortBtnActive]}
            onPress={() => setSortBy('playCount')}
          >
            <Text style={styles.sortBtnText}>練習次數</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'title' && styles.sortBtnActive]}
            onPress={() => setSortBy('title')}
          >
            <Text style={styles.sortBtnText}>字母排序</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Videos List */}
      <FlatList
        data={filteredVideos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>📂</Text>
            <Text style={styles.emptyText}>沒有符合搜尋條件的影片</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.videoCard} onPress={() => handleSelectVideo(item)}>
            <View style={styles.cardTop}>
              <View style={styles.thumbnailPlaceholder}>
                <Text style={{ fontSize: 20 }}>{item.type === 'youtube' ? '📺' : '📱'}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.tagRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.tag}</Text>
                  </View>
                  <Text style={styles.playCountLabel}>練習 {item.playCount} 次</Text>
                </View>
              </View>
            </View>

            {item.notes !== '' && (
              <View style={styles.noteBox}>
                <Text style={styles.noteTitle}>✍️ 練習筆記：</Text>
                <Text style={styles.noteBody} numberOfLines={2}>
                  {item.notes}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Add Video Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeader}>📥 匯入新練舞教材</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color="#F4F4F2" />
              </TouchableOpacity>
            </View>

            {/* Type selector */}
            <Text style={styles.label}>影片來源</Text>
            <View style={styles.sourceSelector}>
              <TouchableOpacity
                style={[styles.sourceTab, newType === 'youtube' && styles.sourceTabActive]}
                onPress={() => {
                  setNewType('youtube');
                  setNewUri('');
                }}
              >
                <Text style={[styles.sourceTabText, newType === 'youtube' && styles.sourceTabTextActive]}>
                  YouTube 連結
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sourceTab, newType === 'local' && styles.sourceTabActive]}
                onPress={handlePickLocalVideo}
              >
                <Text style={[styles.sourceTabText, newType === 'local' && styles.sourceTabTextActive]}>
                  手機相簿檔案
                </Text>
              </TouchableOpacity>
            </View>

            {/* Fields inputs */}
            <Text style={styles.label}>影片名稱</Text>
            <TextInput
              style={styles.textInput}
              placeholder="輸入影片名稱..."
              placeholderTextColor="#9A9A96"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            {newType === 'youtube' ? (
              <>
                <Text style={styles.label}>YouTube 影片網址</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://www.youtube.com/watch?v=..."
                  placeholderTextColor="#9A9A96"
                  value={newUri}
                  onChangeText={setNewUri}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>選取的相片庫路徑</Text>
                <View style={styles.selectedLocalPathContainer}>
                  <Text style={styles.selectedLocalPathText} numberOfLines={1}>
                    {newUri ? newUri : '尚未選取任何影片檔案'}
                  </Text>
                  <TouchableOpacity style={styles.repickBtn} onPress={handlePickLocalVideo}>
                    <Text style={styles.repickBtnText}>重選</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={styles.label}>舞蹈分類 (Tag)</Text>
            <View style={styles.tagGrid}>
              {['K-Pop', 'Hip Hop', 'Choreography', 'House'].map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagSelectTab, newTag === tag && styles.tagSelectTabActive]}
                  onPress={() => setNewTag(tag)}
                >
                  <Text style={[styles.tagSelectText, newTag === tag && styles.tagSelectTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>練習筆記 (選填)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="寫下您需要特別練習或注意的舞步動作細節..."
              placeholderTextColor="#9A9A96"
              value={newNotes}
              onChangeText={setNewNotes}
              multiline={true}
              numberOfLines={4}
            />

            {/* Confirm Submit */}
            <TouchableOpacity style={styles.confirmAddBtn} onPress={handleAddVideo}>
              <Text style={styles.confirmAddBtnText}>匯入至影片庫</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B1B1B',
    borderColor: '#262626',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#F4F4F2',
    fontSize: 14,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#C8FF35', // Lime Green
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    paddingVertical: 12,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    backgroundColor: '#1B1B1B',
    borderColor: '#262626',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  categoryTabActive: {
    backgroundColor: 'rgba(200, 255, 53, 0.1)',
    borderColor: '#C8FF35',
  },
  categoryText: {
    color: '#9A9A96',
    fontSize: 12,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#C8FF35',
    fontWeight: 'bold',
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  resultCount: {
    fontSize: 11,
    color: '#9A9A96',
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sortBtnActive: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#8B5CF6',
  },
  sortBtnText: {
    color: '#9A9A96',
    fontSize: 11,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    gap: 12,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9A9A96',
    fontSize: 13,
  },
  videoCard: {
    backgroundColor: '#1B1B1B',
    borderRadius: 20,
    padding: 14,
    borderColor: '#262626',
    borderWidth: 1,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbnailPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#262626',
    borderWidth: 1,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  videoTitle: {
    fontFamily: 'ZenGothic-Bold',
    fontSize: 14,
    color: '#F4F4F2',
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  badge: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  badgeText: {
    color: '#8B5CF6',
    fontSize: 9,
    fontFamily: 'JetBrainsMono',
  },
  playCountLabel: {
    fontSize: 10,
    color: '#9A9A96',
  },
  noteBox: {
    backgroundColor: '#0D0D0D',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  noteTitle: {
    fontSize: 10,
    color: '#8B5CF6',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noteBody: {
    fontSize: 11,
    color: '#9A9A96',
    lineHeight: 1.6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1B1B1B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderColor: '#262626',
    borderWidth: 1,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalHeader: {
    fontFamily: 'ZenGothic-Bold',
    fontSize: 16,
    color: '#F4F4F2',
  },
  label: {
    fontSize: 11,
    color: '#9A9A96',
    marginBottom: 8,
    marginTop: 12,
  },
  sourceSelector: {
    flexDirection: 'row',
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  sourceTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  sourceTabActive: {
    backgroundColor: '#1B1B1B',
    borderColor: '#262626',
    borderWidth: 1,
  },
  sourceTabText: {
    color: '#9A9A96',
    fontSize: 12,
  },
  sourceTabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  textInput: {
    borderColor: '#262626',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F4F4F2',
    fontSize: 14,
    backgroundColor: '#0D0D0D',
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectedLocalPathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderColor: '#262626',
    borderWidth: 1.5,
    justifyContent: 'space-between',
  },
  selectedLocalPathText: {
    color: '#9A9A96',
    fontSize: 12,
    flex: 0.8,
  },
  repickBtn: {
    backgroundColor: '#262626',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  repickBtnText: {
    color: '#F4F4F2',
    fontSize: 11,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagSelectTab: {
    backgroundColor: '#0D0D0D',
    borderColor: '#262626',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tagSelectTabActive: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
  },
  tagSelectText: {
    color: '#9A9A96',
    fontSize: 11,
  },
  tagSelectTextActive: {
    color: '#8B5CF6',
    fontWeight: 'bold',
  },
  confirmAddBtn: {
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  confirmAddBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
