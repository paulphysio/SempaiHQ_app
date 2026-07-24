import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const NpcModal = ({ selectedNPC, player, addQuest, toggleModal }) => (
  <View style={npcModalStyles.container}>
    <Text style={npcModalStyles.dialogue}>{selectedNPC?.dialogue}</Text>
    {selectedNPC?.quest && !player.quests.some(q => q.id === selectedNPC.quest.id) && (
      <TouchableOpacity style={npcModalStyles.acceptButton} onPress={() => addQuest(selectedNPC.quest)}>
        <Text style={npcModalStyles.acceptButtonText}>Accept Quest</Text>
      </TouchableOpacity>
    )}
    <TouchableOpacity style={npcModalStyles.closeButton} onPress={() => toggleModal('npc')}>
      <Text style={npcModalStyles.closeButtonText}>Close</Text>
    </TouchableOpacity>
  </View>
);

const npcModalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dialogue: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    lineHeight: 22,
    marginBottom: 16,
  },
  acceptButton: {
    paddingVertical: 12,
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
    alignItems: 'center',
    marginBottom: 16,
  },
  acceptButtonText: {
    fontSize: 14,
    
    color: KA_COLORS.ivory,
  },
  closeButton: {
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

export default NpcModal;
