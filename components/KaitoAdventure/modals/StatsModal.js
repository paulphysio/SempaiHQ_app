import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const StatsModal = ({ player, toggleModal }) => (
  <View style={statsModalStyles.container}>
    <View style={statsModalStyles.statItem}>
      <Text style={statsModalStyles.statLabel}>Enemies Defeated:</Text>
      <Text style={statsModalStyles.statValue}>{player.stats.enemiesDefeated}</Text>
    </View>
    <View style={statsModalStyles.statItem}>
      <Text style={statsModalStyles.statLabel}>Potions Crafted:</Text>
      <Text style={statsModalStyles.statValue}>{player.stats.potionsCrafted}</Text>
    </View>
    <View style={statsModalStyles.statItem}>
      <Text style={statsModalStyles.statLabel}>Items Sold:</Text>
      <Text style={statsModalStyles.statValue}>{player.stats.itemsSold}</Text>
    </View>
    <View style={statsModalStyles.statItem}>
      <Text style={statsModalStyles.statLabel}>Gathers Performed:</Text>
      <Text style={statsModalStyles.statValue}>{player.stats.gathers}</Text>
    </View>

    <TouchableOpacity style={statsModalStyles.closeButton} onPress={() => toggleModal('stats')}>
      <Icon name="star" size={16} color={KA_COLORS.textSecondary} style={statsModalStyles.buttonIcon} />
      <Text style={statsModalStyles.closeButtonText}>Close</Text>
    </TouchableOpacity>
  </View>
);

const statsModalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
  },
  statValue: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonIcon: {
    fontSize: 16,
  },
  closeButtonText: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
  },
});

export default StatsModal;
