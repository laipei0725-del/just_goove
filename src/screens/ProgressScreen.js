import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

export default function ProgressScreen() {
  const weeklyStats = [
    { day: '一', minutes: 30 },
    { day: '二', minutes: 45 },
    { day: '三', minutes: 0 },
    { day: '四', minutes: 60 },
    { day: '五', minutes: 20 },
    { day: '六', minutes: 90 },
    { day: '日', minutes: 50 }
  ];

  const totalHours = 12.5;
  const averageMinutes = 42;

  const achievements = [
    { id: '1', icon: '🌱', name: '初試身手', desc: '完成第 1 次舞蹈練習', unlocked: true },
    { id: '2', icon: '🔥', name: '連續舞王', desc: '連續 5 天打卡練習', unlocked: true },
    { id: '3', icon: '👑', name: '練舞大師', desc: '累計練習時間達 10 小時', unlocked: false },
    { id: '4', icon: '🪞', name: '鏡像大師', desc: '累計切換鏡面模式 100 次', unlocked: false }
  ];

  const maxMinutes = Math.max(...weeklyStats.map(d => d.minutes));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overview Stats Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>📈 本月練習概覽</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>累計時間</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{totalHours}</Text>
              <Text style={styles.statUnit}>小時</Text>
            </View>
          </View>
          
          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>日均練習</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{averageMinutes}</Text>
              <Text style={styles.statUnit}>分鐘</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Custom Bar Chart Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>📊 本週練習趨勢 (分鐘)</Text>
        <View style={styles.chartContainer}>
          {weeklyStats.map((item, index) => {
            // Calculate height percentage (cap at 100%, min 2% if minutes > 0 for visibility)
            const heightPct = item.minutes > 0 
              ? Math.max(8, (item.minutes / maxMinutes) * 100) 
              : 0;

            return (
              <View key={index} style={styles.chartCol}>
                <View style={styles.barWrapper}>
                  {item.minutes > 0 && (
                    <Text style={styles.barLabel}>{item.minutes}</Text>
                  )}
                  <View style={[styles.bar, { height: `${heightPct}%` }, item.minutes === maxMinutes && styles.barHighlight]} />
                </View>
                <Text style={styles.chartDayText}>{item.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Achievement Milestones Grid */}
      <Text style={styles.sectionTitle}>🏆 成就徽章</Text>
      <View style={styles.badgeGrid}>
        {achievements.map((badge) => (
          <View 
            key={badge.id} 
            style={[
              styles.badgeCard, 
              badge.unlocked ? styles.badgeCardUnlocked : styles.badgeCardLocked
            ]}
          >
            <Text style={[styles.badgeIcon, !badge.unlocked && styles.textMuted]}>
              {badge.icon}
            </Text>
            <Text style={[styles.badgeName, !badge.unlocked && styles.textMuted]}>
              {badge.name}
            </Text>
            <Text style={styles.badgeDesc}>{badge.desc}</Text>
            
            <View style={[
              styles.badgeStatusTextContainer, 
              badge.unlocked ? styles.statusUnlockedBg : styles.statusLockedBg
            ]}>
              <Text style={[
                styles.badgeStatusText, 
                badge.unlocked ? styles.statusUnlockedText : styles.statusLockedText
              ]}>
                {badge.unlocked ? '已解鎖' : '未解鎖'}
              </Text>
            </View>
          </View>
        ))}
      </View>
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
    marginBottom: 20,
  },
  cardHeader: {
    fontFamily: 'ZenGothic-Bold',
    fontSize: 12,
    color: '#9A9A96',
    marginBottom: 16,
    letterSpacing: 1.0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#9A9A96',
    marginBottom: 6,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontFamily: 'JetBrainsMono',
    fontSize: 28,
    fontWeight: 'bold',
    color: '#C8FF35',
  },
  statUnit: {
    fontSize: 12,
    color: '#F4F4F2',
    marginLeft: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#262626',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    paddingHorizontal: 8,
    paddingTop: 24,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    height: 110,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  barLabel: {
    fontFamily: 'JetBrainsMono',
    fontSize: 10,
    color: '#9A9A96',
    marginBottom: 4,
    position: 'absolute',
    top: -18,
  },
  bar: {
    width: 18,
    backgroundColor: '#8B5CF6', // Purple base
    borderRadius: 6,
  },
  barHighlight: {
    backgroundColor: '#C8FF35', // Highlight Lime Green
  },
  chartDayText: {
    fontSize: 11,
    color: '#9A9A96',
    marginTop: 10,
  },
  sectionTitle: {
    fontFamily: 'ZenGothic-Bold',
    fontSize: 14,
    color: '#9A9A96',
    marginBottom: 12,
    letterSpacing: 1.0,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '48%', // 2 columns
    backgroundColor: '#1B1B1B',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  badgeCardUnlocked: {
    borderColor: '#262626',
  },
  badgeCardLocked: {
    borderColor: '#201A2B', // Dark purple-tinted border for locked items
    opacity: 0.6,
  },
  badgeIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  badgeName: {
    fontFamily: 'ZenGothic-Bold',
    fontSize: 13,
    color: '#F4F4F2',
    marginBottom: 6,
  },
  badgeDesc: {
    fontSize: 10,
    color: '#9A9A96',
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 12,
  },
  badgeStatusTextContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  statusUnlockedBg: {
    backgroundColor: 'rgba(200, 255, 53, 0.1)',
  },
  statusLockedBg: {
    backgroundColor: '#262626',
  },
  badgeStatusText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  statusUnlockedText: {
    color: '#C8FF35',
  },
  statusLockedText: {
    color: '#9A9A96',
  },
  textMuted: {
    color: '#9A9A96',
  },
});
