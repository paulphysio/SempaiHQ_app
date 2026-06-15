import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const QuestsModal = ({ player, currentTown, towns, addQuest, toggleModal }) => {
  const townNPC = towns.find(t => t.name === currentTown).npcs[0];

  return (
    <ScrollView style={questsModalStyles.container}>
      {player.quests.map((quest, index) => (
        <View key={`${quest.id}-${index}`} style={questsModalStyles.questItem}>
          <Text style={questsModalStyles.questText}>{quest.description} - {quest.progress}/{quest.target}</Text>
          <Text style={questsModalStyles.questReward}>
            Reward: {quest.reward.gold ? `${quest.reward.gold} Gold` : ''} {quest.reward.xp ? `${quest.reward.xp} XP` : ''}
          </Text>
        </View>
      ))}

      <TouchableOpacity
        style={[questsModalStyles.acceptButton, player.quests.length >= 3 ? questsModalStyles.buttonDisabled : null]}
        onPress={() => addQuest(townNPC.quest)}
        disabled={player.quests.length >= 3}
      >
        <Icon name="book" size={16} color={KA_COLORS.ivory} style={questsModalStyles.buttonIcon} />
        <Text style={questsModalStyles.acceptButtonText}>Accept New Quest</Text>
      </TouchableOpacity>

      <TouchableOpacity style={questsModalStyles.closeButton} onPress={() => toggleModal('quests')}>
        <Text style={questsModalStyles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const questsModalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  questItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    marginBottom: 8,
  },
  questText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    marginBottom: 4,
  },
  questReward: {
    fontSize: 12,
    color: KA_COLORS.textSecondary,
  },
  acceptButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    fontSize: 16,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
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

export default QuestsModal;
