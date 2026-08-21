import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const [deleteStep, setDeleteStep] = useState(0); // 0: None, 1: Step 1 warning, 2: Step 2 input
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const executeDeleteAccount = () => {
    setDeleteStep(0);
    setDeleteConfirmText('');
    alert('帳號已刪除，感謝您體驗 JUST GROOVE！');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Visual / Style Customization Settings */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>🎨 介面與主題</Text>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>應用程式主題</Text>
          <Text style={styles.settingValue}>日系質感黑 v2 🟢</Text>
        </View>
        <View style={styles.divider} />
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>語言 Settings</Text>
          <Text style={styles.settingValue}>繁體中文</Text>
        </View>
      </View>

      {/* Cloud Backup Settings */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>☁️ 備份與還原</Text>
        
        <TouchableOpacity style={styles.buttonItem} onPress={() => alert('已成功備份至 iCloud / Google Drive')}>
          <View style={styles.buttonItemLeft}>
            <Ionicons name="cloud-upload-outline" size={18} color="#F4F4F2" />
            <Text style={styles.buttonItemLabel}>備份資料至雲端</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9A9A96" />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.buttonItem} onPress={() => alert('已從雲端還原所有 Loop 設定與影片清單')}>
          <View style={styles.buttonItemLeft}>
            <Ionicons name="cloud-download-outline" size={18} color="#F4F4F2" />
            <Text style={styles.buttonItemLabel}>從雲端還原資料</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9A9A96" />
        </TouchableOpacity>
      </View>

      {/* Danger Zone Account deletion */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>⚠️ 危險區域</Text>
        
        <TouchableOpacity 
          style={styles.deleteAccountBtn}
          onPress={() => setDeleteStep(1)}
        >
          <Text style={styles.deleteAccountBtnText}>🗑️ 刪除帳號</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          請注意：刪除帳號將會立即且永久抹除您在此應用程式中所有的練習紀錄、Loop 標記與自訂設定，此動作無法復原。
        </Text>
      </View>

      {/* About App Info */}
      <View style={styles.aboutContainer}>
        <Text style={styles.aboutText}>JUST GROOVE · Version 1.0.0 (Phase 2)</Text>
        <Text style={styles.aboutSubText}>Designed for dancers. Swing your body, keep the groove.</Text>
      </View>

      {/* Delete Account Step 1 Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteStep === 1}
        onRequestClose={() => setDeleteStep(0)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>確定要刪除帳號嗎？</Text>
            <Text style={styles.modalBody}>
              此動作將永久刪除您的練習紀錄、AB 循環標記與匯入的影片偏好，且該動作無法被復原。
            </Text>
            <View style={styles.grid2}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setDeleteStep(0)}>
                <Text style={styles.modalGhostBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalGhostBtn, { borderColor: '#FF8080' }]}
                onPress={() => setDeleteStep(2)}
              >
                <Text style={[styles.modalGhostBtnText, { color: '#FF8080' }]}>繼續</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Step 2 Final Confirm Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteStep === 2}
        onRequestClose={() => setDeleteStep(0)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>最後安全確認</Text>
            <Text style={styles.modalBody}>
              請在下方輸入 “DELETE” 以確認您的帳號刪除行為：
            </Text>
            <TextInput
              style={styles.modalTextInput}
              placeholder="輸入 DELETE"
              placeholderTextColor="#9A9A96"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.grid2}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setDeleteStep(0)}>
                <Text style={styles.modalGhostBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalGhostBtn,
                  { borderColor: '#FF4D4D' },
                  deleteConfirmText !== 'DELETE' && { opacity: 0.3 }
                ]}
                disabled={deleteConfirmText !== 'DELETE'}
                onPress={executeDeleteAccount}
              >
                <Text style={[styles.modalGhostBtnText, { color: '#FF4D4D', fontWeight: 'bold' }]}>永久刪除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#1B1B1B',
    borderRadius: 24,
    padding: 18,
    borderColor: '#262626',
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    fontFamily: 'ZenGothic-Bold',
    fontSize: 13,
    color: '#9A9A96',
    marginBottom: 14,
    letterSpacing: 1.2,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 14,
    color: '#F4F4F2',
  },
  settingValue: {
    fontSize: 13,
    color: '#C8FF35', // Highlight Lime green
    fontFamily: 'ZenGothic-Medium',
  },
  divider: {
    height: 1,
    backgroundColor: '#262626',
    marginVertical: 4,
  },
  buttonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonItemLabel: {
    fontSize: 14,
    color: '#F4F4F2',
  },
  deleteAccountBtn: {
    borderColor: '#5A2020',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 80, 80, 0.03)',
    marginBottom: 12,
  },
  deleteAccountBtnText: {
    color: '#FF8080',
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
    color: '#9A9A96',
    lineHeight: 1.6,
  },
  aboutContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  aboutText: {
    fontFamily: 'JetBrainsMono',
    fontSize: 12,
    color: '#9A9A96',
  },
  aboutSubText: {
    fontSize: 10,
    color: '#9A9A96',
    marginTop: 4,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1B1B1B',
    borderRadius: 24,
    borderColor: '#262626',
    borderWidth: 1,
    padding: 24,
    maxWidth: 340,
    width: '100%',
  },
  modalHeader: {
    fontFamily: 'ZenGothic-Bold',
    fontSize: 16,
    color: '#F4F4F2',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    color: '#9A9A96',
    lineHeight: 1.8,
    marginBottom: 20,
  },
  modalTextInput: {
    borderColor: '#FF8080',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    backgroundColor: '#0D0D0D',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  modalGhostBtn: {
    flex: 1,
    borderColor: '#262626',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalGhostBtnText: {
    color: '#F4F4F2',
    fontSize: 13,
    fontWeight: '600',
  },
  grid2: {
    flexDirection: 'row',
    gap: 12,
  },
});
