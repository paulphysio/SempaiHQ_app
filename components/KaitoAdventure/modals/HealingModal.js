import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const HealingModal = ({ toggleModal }) => (
  <View style={healingModalStyles.container}>
    <Text style={healingModalStyles.text}>
      You can craft healing potions for sale in the market in Craft Items, but battle healing potions can only be crafted in combat.
    </Text>
    <TouchableOpacity style={healingModalStyles.closeButton} onPress={() => toggleModal('healing')}>
      <Text style={healingModalStyles.closeButtonText}>Close</Text>
    </TouchableOpacity>
  </View>
);

const healingModalStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  text: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    lineHeight: 22,
    marginBottom: 16,
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

export default HealingModal;
