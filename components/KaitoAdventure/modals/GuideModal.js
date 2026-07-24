import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const GuideModal = ({ toggleModal }) => (
  <ScrollView style={guideModalStyles.container}>
    <Text style={guideModalStyles.sectionTitle}>Overview</Text>
    <Text style={guideModalStyles.text}>
      Welcome to Kaito's Adventure, a browser-based RPG where you play as Kaito Brewmaster. Start with 5 gold, 100 health, and a small inventory (Water x2, Herbs x1) in Sakura Village. Explore, craft, fight, and rise to the top!
    </Text>

    <Text style={[guideModalStyles.sectionTitle, guideModalStyles.sectionTitleMargin]}>Core Mechanics</Text>
    <View style={guideModalStyles.list}>
      <Text style={guideModalStyles.listItem}>1. Towns & Travel: Explore Sakura Village, Iron Port, Mist Hollow. Travel via "Town" dropdown (+2 XP).</Text>
      <Text style={guideModalStyles.listItem}>2. Gathering: Single (free, cooldown) or Queue (1 gold each, 3-min cooldown). Weather boosts: Rainy (Water), Foggy (Mist Essence).</Text>
      <Text style={guideModalStyles.listItem}>3. Crafting: Make sellable items (e.g., Herbal Tea), weapons, armor (level 10+), healing potions. 80% success (+10% Craftsman trait).</Text>
      <Text style={guideModalStyles.listItem}>4. Combat: Fight Bandits, Ninjas, Golems. Craft potions in-combat to heal (even at 0 health!). Earn gold, XP, drops.</Text>
      <Text style={guideModalStyles.listItem}>5. Market: Sell items/potions, buy ingredients. Prices vary by town demand.</Text>
      <Text style={guideModalStyles.listItem}>6. Quests & Tasks: NPC quests (max 3), daily (e.g., 2 enemies), weekly (e.g., 10 Sakes).</Text>
      <Text style={guideModalStyles.listItem}>7. Progression: 150 XP/level (+10 HP), unlock skills, upgrade inventory (+5 slots, 50 gold).</Text>
      <Text style={guideModalStyles.listItem}>8. Guilds: Join, contribute 10 gold to 100-gold goals (+50 gold).</Text>
      <Text style={guideModalStyles.listItem}>9. Events: Festivals (boost demand), raids (combat), storms (reduce gathering).</Text>
    </View>

    <Text style={[guideModalStyles.sectionTitle, guideModalStyles.sectionTitleMargin]}>Objectives</Text>
    <Text style={guideModalStyles.text}>
      Short-Term: Gather, craft, sell, complete quests. Long-Term: Level up, unlock skills/armor, top the leaderboard.
    </Text>

    <Text style={[guideModalStyles.sectionTitle, guideModalStyles.sectionTitleMargin]}>Tips</Text>
    <View style={guideModalStyles.list}>
      <Text style={guideModalStyles.listItem}>• Start in Sakura: Craft Herbal Tea, sell for gold.</Text>
      <Text style={guideModalStyles.listItem}>• 0 Health? Enter combat, craft a potion fast (keep Water/Herbs).</Text>
      <Text style={guideModalStyles.listItem}>• Get "Efficient Brewing" (cheaper crafts), "Quick Gather" (faster gathers).</Text>
      <Text style={guideModalStyles.listItem}>• Upgrade inventory early (50 gold).</Text>
      <Text style={guideModalStyles.listItem}>• Sell Strong Healing Potions in Mist Hollow (1.2x demand).</Text>
    </View>

    <TouchableOpacity style={guideModalStyles.closeButton} onPress={() => toggleModal('guide')}>
      <Text style={guideModalStyles.closeButtonText}>Got it!</Text>
    </TouchableOpacity>
  </ScrollView>
);

const guideModalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    
    color: KA_COLORS.ivory,
    marginBottom: 12,
  },
  sectionTitleMargin: {
    marginTop: 16,
  },
  text: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    lineHeight: 22,
    marginBottom: 16,
  },
  list: {
    marginBottom: 16,
  },
  listItem: {
    fontSize: 13,
    color: KA_COLORS.ivoryDim,
    lineHeight: 20,
    marginBottom: 8,
  },
  closeButton: {
    paddingVertical: 12,
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    
    color: KA_COLORS.ivory,
  },
});

export default GuideModal;
