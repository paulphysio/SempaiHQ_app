import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

/* ══════════════════════════════════════════════════════════
   Icons
══════════════════════════════════════════════════════════ */
const ITEM_ICONS = {
  Water: 'tint',
  Herbs: 'leaf',
  Pepper: 'pepper-hot',
  Sugar: 'cube',
  'Mist Essence': 'smog',
  'Shadow Root': 'skull',
  'Iron Ore': 'gem',
  Wood: 'tree',
  'Golden Herb': 'star',
  'Iron Shard': 'gem',
  'Mist Crystal': 'gem',
};
const getItemIcon = (name) => ITEM_ICONS[name] || 'box';

const TAB_ICONS = {
  drinks: 'mug-hot',
  weapons: 'gavel',
  armor: 'shield-alt',
  potions: 'flask',
};

const TYPE_ICONS = {
  sell: 'mug-hot',
  equip: 'gavel',
  armor: 'shield-alt',
  heal: 'heart',
  gather: 'hourglass-half',
};

/* ══════════════════════════════════════════════════════════
   Small reusable bits
══════════════════════════════════════════════════════════ */
const PressableScale = ({ onPress, disabled, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

const FadeInRow = ({ index = 0, style, children }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index * 45, 300),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

/* ══════════════════════════════════════════════════════════
   Segmented tab bar with a sliding indicator (4 tabs)
══════════════════════════════════════════════════════════ */
const SegmentedTabs = ({ tabs, active, onChange }) => {
  const [barWidth, setBarWidth] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const activeIndex = tabs.indexOf(active);

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();
  }, [activeIndex]);

  const segmentWidth = barWidth / tabs.length;

  return (
    <View style={craftModalStyles.tabsContainer} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
      {barWidth > 0 && (
        <Animated.View
          style={[
            craftModalStyles.tabIndicator,
            {
              width: segmentWidth - 6,
              transform: [
                {
                  translateX: indicatorAnim.interpolate({
                    inputRange: tabs.map((_, i) => i),
                    outputRange: tabs.map((_, i) => i * segmentWidth + 3),
                  }),
                },
              ],
            },
          ]}
        />
      )}
      {tabs.map((t) => (
        <TouchableOpacity key={t} style={craftModalStyles.tab} onPress={() => onChange(t)} activeOpacity={0.8}>
          <Icon
            name={TAB_ICONS[t]}
            size={12}
            color={active === t ? KA_COLORS.orangeBright : KA_COLORS.textSecondary}
            style={{ marginRight: 5 }}
          />
          <Text style={[craftModalStyles.tabText, active === t && craftModalStyles.tabTextActive]}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

/* ══════════════════════════════════════════════════════════
   Ingredient chip — tap to add/remove one instance
══════════════════════════════════════════════════════════ */
const IngredientChip = ({ item, count, onPress }) => {
  const isMaxed = item.owned && count >= item.quantity;
  const disabled = item.owned && item.quantity === 0;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[
        craftModalStyles.chip,
        count > 0 && craftModalStyles.chipSelected,
        disabled && craftModalStyles.chipDisabled,
      ]}
    >
      <Icon name={getItemIcon(item.name)} size={13} color={count > 0 ? KA_COLORS.orangeBright : KA_COLORS.textSecondary} />
      <Text style={[craftModalStyles.chipText, count > 0 && craftModalStyles.chipTextSelected]}>
        {item.name}
      </Text>
      <Text style={craftModalStyles.chipQty}>{item.owned ? item.quantity : '∞'}</Text>
      {count > 0 && (
        <View style={craftModalStyles.chipBadge}>
          <Text style={craftModalStyles.chipBadgeText}>{count}</Text>
        </View>
      )}
    </PressableScale>
  );
};

/* ══════════════════════════════════════════════════════════
   Recipe card — tap (when craftable) to auto-select its ingredients
══════════════════════════════════════════════════════════ */
const RecipeCard = ({ recipe, player, getAvailableIngredients, isSelected, onSelect, index }) => {
  const locked = recipe.unlockLevel && player.level < recipe.unlockLevel;

  const missing = useMemo(() => {
    const uniqueNames = [...new Set(recipe.ingredients)];
    return uniqueNames.filter((name) => {
      const needed = recipe.ingredients.filter((i) => i === name).length;
      const owned = getAvailableIngredients.find((a) => a.name === name);
      return !owned || owned.quantity < needed;
    });
  }, [recipe, getAvailableIngredients]);

  const craftable = !locked && missing.length === 0;

  const detailText =
    recipe.type === 'heal'
      ? `Heal ${Math.round(recipe.healPercent * 100)}% HP · Sell ${recipe.sellValue}g`
      : recipe.type === 'gather'
      ? `${recipe.effect.rareChanceBoost ? `+${recipe.effect.rareChanceBoost * 100}% rare chance` : `-${recipe.effect.cooldownReduction * 100}% cooldown`} · ${recipe.effect.duration / 60000}m`
      : recipe.type === 'equip'
      ? `+${recipe.bonus.damage} Damage`
      : recipe.type === 'armor'
      ? `+${recipe.bonus.defense} Defense`
      : recipe.sellValue
      ? `Sell ${recipe.sellValue}g`
      : recipe.baseGold
      ? `Sell ~${recipe.baseGold}g`
      : '';

  // Tally ingredient counts for compact display, e.g. "Iron Ore x2"
  const ingredientTally = useMemo(() => {
    const counts = {};
    recipe.ingredients.forEach((i) => {
      counts[i] = (counts[i] || 0) + 1;
    });
    return Object.entries(counts);
  }, [recipe]);

  return (
    <FadeInRow index={index} style={{ marginBottom: 10 }}>
      <PressableScale
        onPress={() => craftable && onSelect(recipe)}
        disabled={!craftable}
        style={[
          craftModalStyles.recipeCard,
          isSelected && craftModalStyles.recipeCardSelected,
          !craftable && craftModalStyles.recipeCardLocked,
        ]}
      >
        <View style={craftModalStyles.recipeHeader}>
          <View style={craftModalStyles.recipeIconWrap}>
            <Icon name={TYPE_ICONS[recipe.type] || 'flask'} size={14} color={craftable ? KA_COLORS.gold : KA_COLORS.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={craftModalStyles.recipeName}>{recipe.name}</Text>
            {!!detailText && <Text style={craftModalStyles.recipeDetail}>{detailText}</Text>}
          </View>
          {locked ? (
            <Icon name="lock" size={14} color={KA_COLORS.textMuted} />
          ) : craftable ? (
            <Icon name="check-circle" size={16} color={KA_COLORS.successBright} />
          ) : (
            <Icon name="exclamation-circle" size={16} color={KA_COLORS.dangerSoft} />
          )}
        </View>

        <View style={craftModalStyles.recipeIngredientRow}>
          {ingredientTally.map(([name, qty]) => (
            <View key={name} style={craftModalStyles.recipeIngredientPill}>
              <Icon name={getItemIcon(name)} size={10} color={KA_COLORS.textSecondary} />
              <Text style={craftModalStyles.recipeIngredientText}>
                {name}
                {qty > 1 ? ` x${qty}` : ''}
              </Text>
            </View>
          ))}
        </View>

        {locked && (
          <Text style={craftModalStyles.lockedText}>Unlocks at Level {recipe.unlockLevel}</Text>
        )}
        {!locked && missing.length > 0 && (
          <Text style={craftModalStyles.missingText}>Missing: {missing.join(', ')}</Text>
        )}
        {craftable && !isSelected && (
          <Text style={craftModalStyles.tapHint}>Tap to load ingredients</Text>
        )}
      </PressableScale>
    </FadeInRow>
  );
};

/* ══════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════ */
const CraftModal = ({
  player,
  selectedIngredients,
  setSelectedIngredients,
  toggleIngredient,
  getAvailableIngredients,
  craftItem,
  activeTab,
  setActiveTab,
  toggleModal,
}) => {
  const recipesForTab = useMemo(() => {
    if (activeTab === 'drinks') return player.recipes.filter((r) => r.type === 'sell');
    if (activeTab === 'weapons') return player.recipes.filter((r) => r.type === 'equip');
    if (activeTab === 'armor') return player.recipes.filter((r) => r.type === 'armor');
    if (activeTab === 'potions') return player.recipes.filter((r) => r.type === 'heal' || r.type === 'gather');
    return [];
  }, [activeTab, player.recipes]);

  // The recipe (if any) whose ingredient multiset exactly matches the
  // current selection — used both to highlight the matching card and to
  // know what the Craft button will actually produce.
  const matchedRecipe = useMemo(() => {
    return player.recipes.find(
      (r) =>
        r.ingredients.every(
          (ing) => selectedIngredients.filter((i) => i === ing).length >= r.ingredients.filter((i) => i === ing).length
        ) &&
        r.ingredients.length === selectedIngredients.length &&
        selectedIngredients.length > 0
    );
  }, [player.recipes, selectedIngredients]);

  const selectRecipe = (recipe) => {
    setSelectedIngredients([...recipe.ingredients]);
  };

  const clearSelection = () => setSelectedIngredients([]);

  const successChance = Math.round((0.8 + (player.trait === 'craftsman' ? 0.1 : 0)) * 100);

  // Tally selected ingredients for the summary bar
  const selectionTally = useMemo(() => {
    const counts = {};
    selectedIngredients.forEach((i) => {
      counts[i] = (counts[i] || 0) + 1;
    });
    return Object.entries(counts);
  }, [selectedIngredients]);

  return (
    <View style={craftModalStyles.wrapper}>
      {/* Selection summary */}
      <View style={craftModalStyles.summaryBar}>
        <View style={{ flex: 1 }}>
          <Text style={craftModalStyles.summaryLabel}>
            {selectionTally.length === 0 ? 'No ingredients selected' : 'Selected'}
          </Text>
          {selectionTally.length > 0 && (
            <View style={craftModalStyles.summaryChipsRow}>
              {selectionTally.map(([name, qty]) => (
                <TouchableOpacity
                  key={name}
                  style={craftModalStyles.summaryChip}
                  onPress={() => toggleIngredient(name)}
                  activeOpacity={0.7}
                >
                  <Text style={craftModalStyles.summaryChipText}>
                    {name}
                    {qty > 1 ? ` x${qty}` : ''}
                  </Text>
                  <Icon name="times" size={9} color={KA_COLORS.textSecondary} style={{ marginLeft: 5 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {selectionTally.length > 0 && (
          <TouchableOpacity onPress={clearSelection} style={craftModalStyles.clearButton}>
            <Text style={craftModalStyles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={craftModalStyles.container} showsVerticalScrollIndicator={false}>
        <Text style={craftModalStyles.sectionTitle}>Ingredients</Text>
        <View style={craftModalStyles.chipGrid}>
          {getAvailableIngredients.map((item) => (
            <IngredientChip
              key={item.name}
              item={item}
              count={selectedIngredients.filter((i) => i === item.name).length}
              onPress={() => toggleIngredient(item.name)}
            />
          ))}
        </View>

        <SegmentedTabs tabs={['drinks', 'weapons', 'armor', 'potions']} active={activeTab} onChange={setActiveTab} />

        <Text style={craftModalStyles.sectionTitle}>
          {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Recipes
        </Text>
        {recipesForTab.map((recipe, idx) => (
          <RecipeCard
            key={recipe.name}
            recipe={recipe}
            player={player}
            getAvailableIngredients={getAvailableIngredients}
            isSelected={!!matchedRecipe && matchedRecipe.name === recipe.name}
            onSelect={selectRecipe}
            index={idx}
          />
        ))}

        <View style={craftModalStyles.buttonContainer}>
          <PressableScale style={craftModalStyles.cancelButton} onPress={() => toggleModal('craft')}>
            <Text style={craftModalStyles.cancelButtonText}>Cancel</Text>
          </PressableScale>
          <PressableScale
            style={[craftModalStyles.craftButton, !matchedRecipe && craftModalStyles.craftButtonDisabled]}
            disabled={!matchedRecipe}
            onPress={() => craftItem(matchedRecipe ? matchedRecipe.type : activeTab)}
          >
            <Icon name="flask" size={14} color={KA_COLORS.ivory} style={{ marginRight: 8 }} />
            <Text style={craftModalStyles.craftButtonText}>
              {matchedRecipe ? `Craft ${matchedRecipe.name}` : 'Craft'}
            </Text>
          </PressableScale>
        </View>
        <Text style={craftModalStyles.successText}>Success Chance: {successChance}%</Text>
      </ScrollView>
    </View>
  );
};

const craftModalStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
    minHeight: 44,
  },
  summaryLabel: {
    fontSize: 11,
    color: KA_COLORS.textSecondary,
    marginBottom: 6,
  },
  summaryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(204, 85, 0, 0.12)',
    borderWidth: 1,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 12,
  },
  summaryChipText: {
    fontSize: 11,
    color: KA_COLORS.orangeBright,
    
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    fontSize: 11,
    color: KA_COLORS.textMuted,
    textDecorationLine: 'underline',
  },
  sectionTitle: {
    fontSize: 13,
    
    color: KA_COLORS.ivory,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 16,
    gap: 6,
    position: 'relative',
  },
  chipSelected: {
    borderColor: KA_COLORS.orangePrimary,
    backgroundColor: 'rgba(204, 85, 0, 0.12)',
  },
  chipDisabled: {
    opacity: 0.35,
  },
  chipText: {
    fontSize: 12,
    color: KA_COLORS.ivoryDim,
  },
  chipTextSelected: {
    color: KA_COLORS.orangeBright,
    
  },
  chipQty: {
    fontSize: 10,
    color: KA_COLORS.textMuted,
  },
  chipBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: KA_COLORS.orangePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBadgeText: {
    fontSize: 9,
    
    color: KA_COLORS.ivory,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: KA_COLORS.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    backgroundColor: 'rgba(204, 85, 0, 0.18)',
    borderWidth: 1,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
  },
  tabText: {
    fontSize: 11,
    color: KA_COLORS.textSecondary,
    
  },
  tabTextActive: {
    color: KA_COLORS.orangeBright,
  },
  recipeCard: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 6,
    padding: 10,
  },
  recipeCardSelected: {
    borderColor: KA_COLORS.orangePrimary,
    backgroundColor: 'rgba(204, 85, 0, 0.08)',
  },
  recipeCardLocked: {
    opacity: 0.55,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  recipeIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: KA_COLORS.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeName: {
    fontSize: 13,
    
    color: KA_COLORS.ivory,
  },
  recipeDetail: {
    fontSize: 10,
    color: KA_COLORS.textSecondary,
    marginTop: 1,
  },
  recipeIngredientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 4,
  },
  recipeIngredientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: KA_COLORS.bgInput,
    borderRadius: 8,
  },
  recipeIngredientText: {
    fontSize: 9,
    color: KA_COLORS.textSecondary,
  },
  lockedText: {
    fontSize: 10,
    color: KA_COLORS.textMuted,
    fontStyle: 'italic',
  },
  missingText: {
    fontSize: 10,
    color: KA_COLORS.dangerSoft,
  },
  tapHint: {
    fontSize: 9,
    color: KA_COLORS.successBright,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
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
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  craftButtonDisabled: {
    backgroundColor: KA_COLORS.orangeDim,
    opacity: 0.5,
  },
  craftButtonText: {
    fontSize: 14,
    
    color: KA_COLORS.ivory,
  },
  successText: {
    fontSize: 10,
    color: KA_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
});

export default CraftModal;
