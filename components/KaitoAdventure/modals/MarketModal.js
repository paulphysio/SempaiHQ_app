import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

/* ══════════════════════════════════════════════════════════
   Icons per item — purely cosmetic, falls back to a box icon
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
  'Herbal Tea': 'mug-hot',
  'Spicy Sake': 'wine-bottle',
  'Mist Potion': 'flask',
  'Golden Elixir': 'flask',
  'Weak Healing Potion': 'heart',
  'Medium Healing Potion': 'heart',
  'Strong Healing Potion': 'heart',
};
const getItemIcon = (name) => ITEM_ICONS[name] || 'box';

// Base vendor prices for ingredients that previously had NO way to be
// bought unless a town's (tiny, 2-3 item) npcOffers list happened to
// include them. This is what actually caused "I can only buy water and
// pepper" — most towns' npcOffers arrays are that short by design, and
// nothing else was ever purchasable. Rare gather-only materials (Golden
// Herb, Iron Shard, Mist Crystal) are intentionally left out — those stay
// drop-only so gathering still matters.
const COMMON_INGREDIENT_PRICES = {
  Water: 3,
  Herbs: 4,
  Pepper: 5,
  Sugar: 4,
  'Mist Essence': 7,
  'Shadow Root': 8,
  'Iron Ore': 6,
  Wood: 3,
};

// Ingredients sell back to the vendor for less than they cost to buy.
const VENDOR_SELL_RATE = 0.4;

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
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start()}
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

const GoldPopup = ({ amount }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 1100, useNativeDriver: true }).start();
  }, []);
  const positive = amount >= 0;
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        marketModalStyles.goldPopup,
        {
          color: positive ? KA_COLORS.successBright : KA_COLORS.danger,
          opacity: anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -26] }) }],
        },
      ]}
    >
      {positive ? `+${amount}` : amount} Gold
    </Animated.Text>
  );
};

/* ══════════════════════════════════════════════════════════
   Segmented tab bar with a sliding indicator
══════════════════════════════════════════════════════════ */
const SegmentedTabs = ({ tabs, active, onChange }) => {
  const [barWidth, setBarWidth] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const activeIndex = tabs.findIndex((t) => t.key === active);

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
    <View
      style={marketModalStyles.tabBar}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {barWidth > 0 && (
        <Animated.View
          style={[
            marketModalStyles.tabIndicator,
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
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={marketModalStyles.tabButton}
          onPress={() => onChange(tab.key)}
          activeOpacity={0.8}
        >
          <Icon
            name={tab.icon}
            size={13}
            color={active === tab.key ? KA_COLORS.orangeBright : KA_COLORS.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[marketModalStyles.tabLabel, active === tab.key && marketModalStyles.tabLabelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

/* ══════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════ */
const MarketModal = ({
  currentTown,
  towns,
  player,
  sellDrink,
  buyIngredient,
  sellIngredient, // optional — enables the "Raw Ingredients" sell section
  townLevels,
  currentEvent,
  weather,
  setSelectedNPC,
  toggleModal,
}) => {
  const townData = towns.find((t) => t.name === currentTown);
  const [tab, setTab] = useState('sell');
  const [popups, setPopups] = useState([]);
  const popupId = useRef(0);

  const flashGold = (amount) => {
    const id = ++popupId.current;
    setPopups((p) => [...p, { id, amount }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1150);
  };

  const townLevel = townLevels[currentTown] || 1;

  // Full buy catalog: common ingredients (always purchasable) merged with
  // this town's special NPC deals (which may undercut the base price).
  const buyCatalog = useMemo(() => {
    const map = {};
    Object.entries(COMMON_INGREDIENT_PRICES).forEach(([name, price]) => {
      map[name] = { ingredient: name, price, isDeal: false };
    });
    (townData.npcOffers || []).forEach((offer) => {
      map[offer.ingredient] = { ingredient: offer.ingredient, price: offer.price, isDeal: true };
    });
    return Object.values(map).sort((a, b) => a.ingredient.localeCompare(b.ingredient));
  }, [townData]);

  const sellableGoods = player.inventory.filter((item) =>
    player.recipes.some((r) => r.name === item.name && (r.sellValue || r.baseGold))
  );

  const sellableIngredients = sellIngredient
    ? player.inventory.filter(
        (item) =>
          item.quantity > 0 &&
          !player.recipes.some((r) => r.name === item.name && (r.sellValue || r.baseGold))
      )
    : [];

  const demandBadges = [];
  if (currentEvent?.type === 'festival') demandBadges.push({ label: 'Festival +50% demand', color: KA_COLORS.goldBright });
  const weatherKeys = Object.keys(weather.demandBonus || {});
  if (weatherKeys.length) demandBadges.push({ label: `${weather.type} weather bonus`, color: KA_COLORS.orangeBright });

  const handleSellOne = (name, price) => {
    sellDrink(name);
    flashGold(price);
  };

  const handleSellAll = (name, price, qty) => {
    for (let i = 0; i < qty; i++) sellDrink(name);
    flashGold(price * qty);
  };

  const handleBuyOne = (name, price) => {
    const cost = Math.floor(price / townLevel);
    buyIngredient(name, price);
    flashGold(-cost);
  };

  const handleBuyFive = (name, price) => {
    const cost = Math.floor(price / townLevel);
    if (player.gold < cost * 5) return;
    for (let i = 0; i < 5; i++) buyIngredient(name, price);
    flashGold(-cost * 5);
  };

  const handleSellIngredientOne = (name) => {
    const reward = Math.max(1, Math.floor((COMMON_INGREDIENT_PRICES[name] || 2) * VENDOR_SELL_RATE));
    sellIngredient(name);
    flashGold(reward);
  };

  const handleSellIngredientAll = (name, qty) => {
    const reward = Math.max(1, Math.floor((COMMON_INGREDIENT_PRICES[name] || 2) * VENDOR_SELL_RATE));
    for (let i = 0; i < qty; i++) sellIngredient(name);
    flashGold(reward * qty);
  };

  return (
    <View style={marketModalStyles.wrapper}>
      {/* Header */}
      <View style={marketModalStyles.header}>
        <View>
          <Text style={marketModalStyles.townName}>{currentTown}</Text>
          <Text style={marketModalStyles.townSub}>Market Level {townLevel}</Text>
        </View>
        <View style={marketModalStyles.goldBadge}>
          <Icon name="coins" size={14} color={KA_COLORS.goldBright} />
          <Text style={marketModalStyles.goldText}>{player.gold}</Text>
          {popups.map((p) => (
            <GoldPopup key={p.id} amount={p.amount} />
          ))}
        </View>
      </View>

      {demandBadges.length > 0 && (
        <View style={marketModalStyles.badgeRow}>
          {demandBadges.map((b, i) => (
            <View key={i} style={[marketModalStyles.badge, { borderColor: b.color }]}>
              <Text style={[marketModalStyles.badgeText, { color: b.color }]}>{b.label}</Text>
            </View>
          ))}
        </View>
      )}

      <SegmentedTabs
        tabs={[
          { key: 'sell', label: 'Sell', icon: 'hand-holding-usd' },
          { key: 'buy', label: 'Buy', icon: 'shopping-basket' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <ScrollView style={marketModalStyles.container} showsVerticalScrollIndicator={false}>
        {tab === 'sell' && (
          <View key="sell-panel">
            <Text style={marketModalStyles.sectionTitle}>Crafted Goods</Text>
            {sellableGoods.length === 0 ? (
              <View style={marketModalStyles.emptyState}>
                <Icon name="wine-bottle" size={20} color={KA_COLORS.textMuted} />
                <Text style={marketModalStyles.emptyText}>
                  Nothing to sell yet — craft a potion or drink first.
                </Text>
              </View>
            ) : (
              sellableGoods.map((item, idx) => {
                const recipe = player.recipes.find((r) => r.name === item.name);
                const demandMultiplier =
                  (townData.demand[item.name] || 1.0) *
                  (currentEvent?.type === 'festival' ? 1.5 : 1) *
                  (weather.demandBonus[item.name] || 1);
                const price = Math.floor(
                  (recipe.sellValue || recipe.baseGold) * townData.rewardMultiplier * demandMultiplier
                );
                return (
                  <FadeInRow key={item.name} index={idx} style={marketModalStyles.listItem}>
                    <View style={marketModalStyles.itemIconWrap}>
                      <Icon name={getItemIcon(item.name)} size={16} color={KA_COLORS.gold} />
                    </View>
                    <View style={marketModalStyles.itemInfo}>
                      <Text style={marketModalStyles.itemName}>{item.name}</Text>
                      <Text style={marketModalStyles.itemMeta}>
                        x{item.quantity} · {price}g each
                      </Text>
                    </View>
                    <View style={marketModalStyles.actionCol}>
                      <PressableScale
                        style={[marketModalStyles.sellButton, item.quantity === 0 && marketModalStyles.buttonDisabled]}
                        onPress={() => handleSellOne(item.name, price)}
                        disabled={item.quantity === 0}
                      >
                        <Text style={marketModalStyles.sellButtonText}>Sell 1</Text>
                      </PressableScale>
                      <PressableScale
                        style={[marketModalStyles.sellAllButton, item.quantity === 0 && marketModalStyles.buttonDisabled]}
                        onPress={() => handleSellAll(item.name, price, item.quantity)}
                        disabled={item.quantity === 0}
                      >
                        <Text style={marketModalStyles.sellAllButtonText}>All</Text>
                      </PressableScale>
                    </View>
                  </FadeInRow>
                );
              })
            )}

            {sellIngredient && (
              <>
                <Text style={[marketModalStyles.sectionTitle, marketModalStyles.sectionTitleMargin]}>
                  Raw Ingredients
                </Text>
                {sellableIngredients.length === 0 ? (
                  <View style={marketModalStyles.emptyState}>
                    <Icon name="seedling" size={20} color={KA_COLORS.textMuted} />
                    <Text style={marketModalStyles.emptyText}>No spare ingredients to offload right now.</Text>
                  </View>
                ) : (
                  sellableIngredients.map((item, idx) => {
                    const unitReward = Math.max(1, Math.floor((COMMON_INGREDIENT_PRICES[item.name] || 2) * VENDOR_SELL_RATE));
                    return (
                      <FadeInRow key={item.name} index={idx} style={marketModalStyles.listItem}>
                        <View style={marketModalStyles.itemIconWrap}>
                          <Icon name={getItemIcon(item.name)} size={16} color={KA_COLORS.ivoryDim} />
                        </View>
                        <View style={marketModalStyles.itemInfo}>
                          <Text style={marketModalStyles.itemName}>{item.name}</Text>
                          <Text style={marketModalStyles.itemMeta}>
                            x{item.quantity} · {unitReward}g each
                          </Text>
                        </View>
                        <View style={marketModalStyles.actionCol}>
                          <PressableScale
                            style={marketModalStyles.sellButton}
                            onPress={() => handleSellIngredientOne(item.name)}
                          >
                            <Text style={marketModalStyles.sellButtonText}>Sell 1</Text>
                          </PressableScale>
                          <PressableScale
                            style={marketModalStyles.sellAllButton}
                            onPress={() => handleSellIngredientAll(item.name, item.quantity)}
                          >
                            <Text style={marketModalStyles.sellAllButtonText}>All</Text>
                          </PressableScale>
                        </View>
                      </FadeInRow>
                    );
                  })
                )}
              </>
            )}
          </View>
        )}

        {tab === 'buy' && (
          <View key="buy-panel">
            <Text style={marketModalStyles.sectionTitle}>Ingredients For Sale</Text>
            {buyCatalog.map((offer, idx) => {
              const cost = Math.floor(offer.price / townLevel);
              const cost5 = cost * 5;
              return (
                <FadeInRow key={offer.ingredient} index={idx} style={marketModalStyles.listItem}>
                  <View style={marketModalStyles.itemIconWrap}>
                    <Icon name={getItemIcon(offer.ingredient)} size={16} color={KA_COLORS.orangeSoft} />
                  </View>
                  <View style={marketModalStyles.itemInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={marketModalStyles.itemName}>{offer.ingredient}</Text>
                      {offer.isDeal && (
                        <View style={marketModalStyles.dealTag}>
                          <Text style={marketModalStyles.dealTagText}>Local Deal</Text>
                        </View>
                      )}
                    </View>
                    <Text style={marketModalStyles.itemMeta}>{cost}g each</Text>
                  </View>
                  <View style={marketModalStyles.actionCol}>
                    <PressableScale
                      style={[marketModalStyles.buyButton, player.gold < cost && marketModalStyles.buttonDisabled]}
                      onPress={() => handleBuyOne(offer.ingredient, offer.price)}
                      disabled={player.gold < cost}
                    >
                      <Text style={marketModalStyles.buyButtonText}>Buy 1</Text>
                    </PressableScale>
                    <PressableScale
                      style={[marketModalStyles.buyFiveButton, player.gold < cost5 && marketModalStyles.buttonDisabled]}
                      onPress={() => handleBuyFive(offer.ingredient, offer.price)}
                      disabled={player.gold < cost5}
                    >
                      <Text style={marketModalStyles.buyFiveButtonText}>Buy 5</Text>
                    </PressableScale>
                  </View>
                </FadeInRow>
              );
            })}
            <Text style={marketModalStyles.hintText}>
              Rare materials (Golden Herb, Iron Shard, Mist Crystal) aren't sold here — you'll need to gather those.
            </Text>
          </View>
        )}

        <PressableScale
          style={marketModalStyles.talkButton}
          onPress={() => {
            setSelectedNPC(townData.npcs[0]);
            toggleModal('npc');
          }}
        >
          <Icon name="comment-dots" size={14} color={KA_COLORS.orangeBright} style={{ marginRight: 8 }} />
          <Text style={marketModalStyles.talkButtonText}>Talk to {townData.npcs[0]?.name || 'NPC'}</Text>
        </PressableScale>

        <PressableScale style={marketModalStyles.closeButton} onPress={() => toggleModal('market')}>
          <Text style={marketModalStyles.closeButtonText}>Close</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
};

const marketModalStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  townName: {
    fontSize: 18,
    
    color: KA_COLORS.ivory,
  },
  townSub: {
    fontSize: 11,
    color: KA_COLORS.textSecondary,
    marginTop: 1,
  },
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 20,
    position: 'relative',
  },
  goldText: {
    fontSize: 13,
    
    color: KA_COLORS.goldBright,
  },
  goldPopup: {
    position: 'absolute',
    right: 4,
    top: -4,
    fontSize: 11,
    
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: KA_COLORS.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    marginBottom: 14,
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
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tabLabel: {
    fontSize: 13,
    
    color: KA_COLORS.textSecondary,
  },
  tabLabelActive: {
    color: KA_COLORS.orangeBright,
  },
  sectionTitle: {
    fontSize: 14,
    
    color: KA_COLORS.ivory,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitleMargin: {
    marginTop: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 12,
    color: KA_COLORS.textMuted,
    textAlign: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 6,
    marginBottom: 8,
    gap: 10,
  },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: KA_COLORS.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    
    color: KA_COLORS.ivoryDim,
  },
  itemMeta: {
    fontSize: 11,
    color: KA_COLORS.textSecondary,
    marginTop: 2,
  },
  actionCol: {
    flexDirection: 'row',
    gap: 6,
  },
  sellButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    borderWidth: 1,
    borderColor: KA_COLORS.success,
    borderRadius: 4,
  },
  sellButtonText: {
    fontSize: 11,
    
    color: KA_COLORS.successBright,
  },
  sellAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(74, 124, 89, 0.05)',
    borderWidth: 1,
    borderColor: KA_COLORS.success,
    borderRadius: 4,
  },
  sellAllButtonText: {
    fontSize: 11,
    
    color: KA_COLORS.success,
  },
  buyButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(204, 85, 0, 0.15)',
    borderWidth: 1,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 4,
  },
  buyButtonText: {
    fontSize: 11,
    
    color: KA_COLORS.orangeBright,
  },
  buyFiveButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(204, 85, 0, 0.05)',
    borderWidth: 1,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 4,
  },
  buyFiveButtonText: {
    fontSize: 11,
    
    color: KA_COLORS.orangeSoft,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  dealTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: KA_COLORS.gold,
  },
  dealTagText: {
    fontSize: 8,
    
    color: KA_COLORS.gold,
  },
  hintText: {
    fontSize: 10,
    color: KA_COLORS.textMuted,
    marginTop: 6,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  talkButton: {
    marginTop: 18,
    paddingVertical: 12,
    backgroundColor: 'rgba(204, 85, 0, 0.1)',
    borderWidth: 1,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkButtonText: {
    fontSize: 14,
    color: KA_COLORS.orangeBright,
    
  },
  closeButton: {
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
  },
});

export default MarketModal;
