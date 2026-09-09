import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = { bg: '#171717', line: '#343434', text: '#F4F4F2', muted: '#A0A09B', lime: '#C8FF35' };

export default function ProjectMenu({ visible, project, onClose, onPin, onRename, onDuplicate, onDelete }) {
  if (!project) return null;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <View style={styles.menu} onStartShouldSetResponder={() => true}>
        <Text numberOfLines={1} style={styles.heading}>{project.title}</Text>
        <MenuRow icon={project.pinned ? 'pin' : 'pin-outline'} label={project.pinned ? '取消置頂' : '置頂專案'} onPress={onPin} />
        <MenuRow icon="create-outline" label="重新命名" onPress={onRename} />
        <MenuRow icon="copy-outline" label="複製專案" onPress={onDuplicate} />
        <MenuRow icon="trash-outline" label="刪除專案" danger onPress={onDelete} />
        <Pressable style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>取消</Text></Pressable>
      </View>
    </Pressable>
  </Modal>;
}

function MenuRow({ icon, label, onPress, danger }) {
  return <Pressable style={styles.row} onPress={onPress}><Ionicons name={icon} size={20} color={danger ? '#FF6B6B' : C.lime} /><Text style={[styles.label, danger && styles.danger]}>{label}</Text><Ionicons name="chevron-forward" size={16} color={C.muted} /></Pressable>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end', padding: 16 }, menu: { backgroundColor: C.bg, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: C.line }, heading: { color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 8 }, row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: '#262626' }, label: { flex: 1, color: C.text, fontSize: 14 }, danger: { color: '#FF6B6B' }, cancel: { minHeight: 48, borderRadius: 14, backgroundColor: '#252525', alignItems: 'center', justifyContent: 'center', marginTop: 14 }, cancelText: { color: C.text, fontWeight: '700' } });
