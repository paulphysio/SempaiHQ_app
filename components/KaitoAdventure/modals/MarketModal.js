import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const MarketModal = ({ currentTown, towns, player, sellDrink, buyIngredient, townLevels, currentEvent, weather, setSelectedNPC, toggleModal }) => {
  const townData = towns.find(t => t.name === currentTown);

  return (
    <ScrollView style={marketModalStyles.container}>
      <Text style={marketModalStyles.sectionTitle}>Sell Your Items:</Text>
      {player.inventory
        .filter(item => player.recipes.some(r => r.name === item.name && (r.sellValue || r.baseGold)))
        .map(item => {
          const recipe = player.recipes.find(r => r.name === item.name);
          const demandMultiplier = (townData.demand[item.name] || 1.0) *
            (currentEvent?.type === 'festival' ? 1.5 : 1) *
            (weather.demandBonus[item.name] || 1);
          const price = Math.floor((recipe.sellValue || recipe.baseGold) *
            townData.rewardMultiplier * demandMultiplier);
          return (
            <View key={item.name} style={marketModalStyles.listItem}>
              <Text style={marketModalStyles.listItemText}>{item.name}: {item.quantity} (Sells for {price} gold each)</Text>
              <TouchableOpacity
                style={[marketModalStyles.sellButton, item.quantity === 0 ? marketModalStyles.buttonDisabled : null]}
                onPress={() => sellDrink(item.name)}
                disabled={item.quantity === 0}
              >
                <Text style={marketModalStyles.sellButtonText}>Sell One</Text>
              </TouchableOpacity>
            </View>
          );
        })}

      <Text style={[marketModalStyles.sectionTitle, marketModalStyles.sectionTitleMargin]}>NPC Buyers:</Text>
      {townData.npcOffers.map((offer, idx) => (
        <View key={idx} style={marketModalStyles.listItem}>
          <Text style={marketModalStyles.listItemText}>{offer.ingredient} (Buy for {Math.floor(offer.price / townLevels[currentTown])} gold)</Text>
          <TouchableOpacity
            style={[marketModalStyles.buyButton, player.gold < Math.floor(offer.price / townLevels[currentTown]) ? marketModalStyles.buttonDisabled : null]}
            onPress={() => buyIngredient(offer.ingredient, offer.price)}
            disabled={player.gold < Math.floor(offer.price / townLevels[currentTown])}
          >
            <Text style={marketModalStyles.buyButtonText}>Buy One</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={marketModalStyles.talkButton}
        onPress={() => { setSelectedNPC(townData.npcs[0]); toggleModal('npc'); }}
      >
        <Text style={marketModalStyles.talkButtonText}>Talk to NPC</Text>
      </TouchableOpacity>

      <TouchableOpacity style={marketModalStyles.closeButton} onPress={() => toggleModal('market')}>
        <Text style={marketModalStyles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const marketModalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: KA_COLORS.ivory,
    marginBottom: 12,
  },
  sectionTitleMargin: {
    marginTop: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    marginBottom: 8,
  },
  listItemText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    flex: 1,
  },
  sellButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(74, 124, 89, 0.1)',
    borderWidth: 1,
    borderColor: KA_COLORS.success,
    borderRadius: 2,
  },
  sellButtonText: {
    fontSize: 12,
    color: KA_COLORS.successBright,
  },
  buyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(204, 85, 0, 0.1)',
    borderWidth: 1,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
  },
  buyButtonText: {
    fontSize: 12,
    color: KA_COLORS.orangeBright,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  talkButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(204, 85, 0, 0.1)',
    borderWidth: 1,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
    alignItems: 'center',
  },
  talkButtonText: {
    fontSize: 14,
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

export default MarketModal;
