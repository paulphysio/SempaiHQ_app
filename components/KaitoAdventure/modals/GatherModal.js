import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const GatherModal = ({ currentTown, towns, player, gatherSingle, queueGathers, weather, countdown, queuedCountdown, toggleModal }) => {
  const town = towns.find(t => t.name === currentTown);

  return (
    <View style={gatherModalStyles.container}>
      <View style={gatherModalStyles.card}>
        <Text style={gatherModalStyles.cardTitle}>Normal Gather</Text>
        <Text style={gatherModalStyles.cardText}>
          Gather one ingredient for free (cooldown varies by town). {weather.gatherBonus ? `Bonus: ${weather.gatherBonus.chance * 100}% chance for ${weather.gatherBonus.ingredient}` : ''}
        </Text>
        <TouchableOpacity
          style={[gatherModalStyles.gatherButton, countdown > 0 ? gatherModalStyles.buttonDisabled : null]}
          onPress={gatherSingle}
          disabled={countdown > 0}
        >
          <Icon name="map" size={16} color={KA_COLORS.ivory} style={gatherModalStyles.buttonIcon} />
          <Text style={gatherModalStyles.buttonText}>Gather Now</Text>
        </TouchableOpacity>
      </View>

      <View style={gatherModalStyles.card}>
        <Text style={gatherModalStyles.cardTitle}>Queue Gathers for Gold</Text>
        <Text style={gatherModalStyles.cardText}>Pay 1 gold per gather, up to 5 (3-minute global cooldown).</Text>
        <View style={gatherModalStyles.queueButtons}>
          {[1, 2, 3, 4, 5].map(count => (
            <TouchableOpacity
              key={count}
              style={[gatherModalStyles.queueButton, player.gold < count || queuedCountdown > 0 ? gatherModalStyles.buttonDisabled : null]}
              onPress={() => queueGathers(count)}
              disabled={player.gold < count || queuedCountdown > 0}
            >
              <Text style={gatherModalStyles.queueButtonText}>{count} ({count} gold)</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={gatherModalStyles.closeButton} onPress={() => toggleModal('gather')}>
        <Text style={gatherModalStyles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

const gatherModalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    
    color: KA_COLORS.ivory,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    lineHeight: 20,
    marginBottom: 12,
  },
  gatherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    fontSize: 16,
  },
  buttonText: {
    fontSize: 14,
    
    color: KA_COLORS.ivory,
  },
  queueButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  queueButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
  },
  queueButtonText: {
    fontSize: 13,
    color: KA_COLORS.orangeBright,
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

export default GatherModal;
