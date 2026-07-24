import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const DailyModal = ({ player, formatCountdown, toggleModal }) => (
  <ScrollView style={dailyModalStyles.container}>
    <Text style={dailyModalStyles.bonusText}>Daily Login Bonus: 20 Gold (Claimed today)</Text>

    <Text style={dailyModalStyles.sectionTitle}>Daily Challenges:</Text>
    {player.daily_tasks.map(task => (
      <View key={task.id} style={dailyModalStyles.taskItem}>
        <Text style={dailyModalStyles.taskText}>{task.description} - {task.progress}/{task.target}</Text>
        <Text style={dailyModalStyles.taskReward}>
          Reward: {task.reward.gold ? `${task.reward.gold} Gold` : ''} {task.reward.xp ? `${task.reward.xp} XP` : ''}
        </Text>
        <Text style={dailyModalStyles.taskTime}>
          Time Left: {formatCountdown(Math.max(0, Math.floor((task.expires - Date.now()) / 1000)))}
        </Text>
        {task.completed && <Text style={dailyModalStyles.taskCompleted}> (Completed)</Text>}
      </View>
    ))}

    <Text style={[dailyModalStyles.sectionTitle, dailyModalStyles.sectionTitleMargin]}>Weekly Challenges:</Text>
    {player.weekly_tasks.map(task => (
      <View key={task.id} style={dailyModalStyles.taskItem}>
        <Text style={dailyModalStyles.taskText}>{task.description} - {task.progress}/{task.target}</Text>
        <Text style={dailyModalStyles.taskReward}>
          Reward: {task.reward.gold ? `${task.reward.gold} Gold` : ''} {task.reward.xp ? `${task.reward.xp} XP` : ''}
        </Text>
        <Text style={dailyModalStyles.taskTime}>
          Time Left: {formatCountdown(Math.max(0, Math.floor((task.expires - Date.now()) / 1000)))}
        </Text>
        {task.completed && <Text style={dailyModalStyles.taskCompleted}> (Completed)</Text>}
      </View>
    ))}

    <TouchableOpacity style={dailyModalStyles.closeButton} onPress={() => toggleModal('daily')}>
      <Text style={dailyModalStyles.closeButtonText}>Close</Text>
    </TouchableOpacity>
  </ScrollView>
);

const dailyModalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bonusText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    
    color: KA_COLORS.ivory,
    marginBottom: 12,
  },
  sectionTitleMargin: {
    marginTop: 16,
  },
  taskItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    marginBottom: 8,
  },
  taskText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    marginBottom: 4,
  },
  taskReward: {
    fontSize: 12,
    color: KA_COLORS.textSecondary,
    marginBottom: 2,
  },
  taskTime: {
    fontSize: 12,
    color: KA_COLORS.orangeSoft,
  },
  taskCompleted: {
    fontSize: 12,
    color: KA_COLORS.successBright,
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
  },
});

export default DailyModal;
