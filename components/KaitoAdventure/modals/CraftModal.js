import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const CraftModal = ({ player, selectedIngredients, setSelectedIngredients, toggleIngredient, getAvailableIngredients, craftItem, activeTab, setActiveTab, toggleModal }) => (
  <ScrollView style={craftModalStyles.container}>
    <Text style={craftModalStyles.sectionTitle}>Select Ingredients:</Text>
    {getAvailableIngredients.map(item => (
      <TouchableOpacity
        key={item.name}
        style={craftModalStyles.ingredientItem}
        onPress={() => toggleIngredient(item.name)}
        disabled={item.owned && item.quantity === 0}
      >
        <View style={craftModalStyles.checkbox}>
          {selectedIngredients.includes(item.name) ? (
            <Icon name="check-square" size={20} color={KA_COLORS.orangeBright} />
          ) : (
            <Icon name="square" size={20} color={KA_COLORS.textSecondary} />
          )}
        </View>
        <Text style={craftModalStyles.ingredientText}>
          {item.name} ({item.owned ? item.quantity : '∞'}) (Selected: {selectedIngredients.filter(i => i === item.name).length})
        </Text>
      </TouchableOpacity>
    ))}

    <View style={craftModalStyles.tabsContainer}>
      {['drinks', 'weapons', 'armor', 'potions'].map(tab => (
        <TouchableOpacity
          key={tab}
          style={[craftModalStyles.tab, activeTab === tab ? craftModalStyles.tabActive : null]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[craftModalStyles.tabText, activeTab === tab ? craftModalStyles.tabTextActive : null]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    {activeTab === 'drinks' && (
      <View style={craftModalStyles.recipeList}>
        <Text style={craftModalStyles.recipeTitle}>Known Sellable Recipes:</Text>
        {player.recipes.filter(r => r.type === 'sell').map(r => (
          <Text key={r.name} style={craftModalStyles.recipeItem}>{r.name}: {r.ingredients.join(', ')}</Text>
        ))}
      </View>
    )}

    {activeTab === 'weapons' && (
      <View style={craftModalStyles.recipeList}>
        <Text style={craftModalStyles.recipeTitle}>Known Weapon Recipes:</Text>
        {player.recipes.filter(r => r.type === 'equip').map(r => (
          <Text key={r.name} style={craftModalStyles.recipeItem}>{r.name}: {r.ingredients.join(', ')} (Bonus: +{r.bonus.damage} Damage)</Text>
        ))}
      </View>
    )}

    {activeTab === 'armor' && (
      <View style={craftModalStyles.recipeList}>
        <Text style={craftModalStyles.recipeTitle}>Known Armor Recipes (Unlocks at Level 10):</Text>
        {player.recipes.filter(r => r.type === 'armor').map(r => (
          <Text key={r.name} style={craftModalStyles.recipeItem}>
            {r.name}: {r.ingredients.join(', ')} (Defense: {r.bonus.defense}) {r.unlockLevel > player.level ? '(Locked)' : ''}
          </Text>
        ))}
      </View>
    )}

    {activeTab === 'potions' && (
      <View style={craftModalStyles.recipeList}>
        <Text style={craftModalStyles.recipeTitle}>Known Potion Recipes:</Text>
        {player.recipes.filter(r => r.type === 'heal' || r.type === 'gather').map(r => (
          <Text key={r.name} style={craftModalStyles.recipeItem}>
            {r.name}: {r.ingredients.join(', ')}
            {r.type === 'heal' && ` (Heal: ${r.healPercent * 100}% HP, Sell: ${r.sellValue} gold)`}
            {r.type === 'gather' && ` (Effect: ${r.effect.rareChanceBoost ? `+${r.effect.rareChanceBoost * 100}% Rare Chance` : `-${r.effect.cooldownReduction * 100}% Cooldown`}, ${r.effect.duration / 60000} min)`}
          </Text>
        ))}
      </View>
    )}

    <View style={craftModalStyles.buttonContainer}>
      <TouchableOpacity style={craftModalStyles.cancelButton} onPress={() => toggleModal('craft')}>
        <Text style={craftModalStyles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={craftModalStyles.craftButton}
        onPress={() => {
          const selectedRecipe = player.recipes.find(r =>
            r.ingredients.every(ing => selectedIngredients.filter(i => i === ing).length >= r.ingredients.filter(i => i === ing).length) &&
            r.ingredients.length === selectedIngredients.length
          );
          craftItem(selectedRecipe ? selectedRecipe.type : activeTab);
        }}
      >
        <Icon name="flask" size={16} color={KA_COLORS.ivory} style={craftModalStyles.buttonIcon} />
        <Text style={craftModalStyles.craftButtonText}>Craft</Text>
      </TouchableOpacity>
    </View>
  </ScrollView>
);

const craftModalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: KA_COLORS.ivory,
    marginBottom: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
  },
  tabActive: {
    borderColor: KA_COLORS.orangePrimary,
    backgroundColor: 'rgba(204, 85, 0, 0.1)',
  },
  tabText: {
    fontSize: 13,
    color: KA_COLORS.textSecondary,
  },
  tabTextActive: {
    color: KA_COLORS.orangeBright,
  },
  recipeList: {
    marginTop: 16,
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
    marginBottom: 8,
  },
  recipeItem: {
    fontSize: 13,
    color: KA_COLORS.ivoryDim,
    paddingVertical: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
  },
  craftButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  craftButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
  },
  buttonIcon: {
    fontSize: 16,
  },
});

export default CraftModal;
