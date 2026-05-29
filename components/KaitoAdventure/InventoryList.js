import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../styles/KaitoAdventureStyles';

const InventoryList = ({ player, setPlayer, equipItem, useGatherPotion, sortInventory, upgradeInventory, rareItems }) => (
  <View style={inventoryListStyles.panel}>
    <View style={inventoryListStyles.inventoryHeader}>
      <View style={inventoryListStyles.inventoryTitle}>
        <Icon name="flask" size={14} color={KA_COLORS.textSecondary} />
        <Text style={inventoryListStyles.inventoryTitleText}>Inventory</Text>
        <Text style={inventoryListStyles.inventorySlots}>Slots {player.inventory.length}/{player.inventory_slots}</Text>
      </View>

      <View style={inventoryListStyles.inventoryActions}>
        <TouchableOpacity style={inventoryListStyles.inventoryActionBtn} onPress={sortInventory}>
          <Text style={inventoryListStyles.inventoryActionBtnText}>Sort</Text>
        </TouchableOpacity>
        <TouchableOpacity style={inventoryListStyles.inventoryActionBtn} onPress={upgradeInventory}>
          <Text style={inventoryListStyles.inventoryActionBtnText}>Upgrade</Text>
          <Icon name="coins" size={12} color={KA_COLORS.textMuted} />
          <Text style={inventoryListStyles.inventoryActionBtnText}>50</Text>
        </TouchableOpacity>
      </View>
    </View>

    <ScrollView style={inventoryListStyles.inventoryGrid} contentContainerStyle={inventoryListStyles.inventoryGridContent}>
      {player.inventory.map((item) => {
        const isRare = rareItems?.includes(item.name);
        const isEquippable = Boolean(player.recipes.find((r) => r.name === item.name && (r.type === "equip" || r.type === "armor")));
        const isGatherPotion = Boolean(player.recipes.find((r) => r.name === item.name && r.type === "gather"));
        const itemSlug = item.name.toLowerCase().replace(/ /g, '-');

        return (
          <View
            key={item.name}
            style={[inventoryListStyles.inventoryItem, isRare ? inventoryListStyles.inventoryItemRare : null]}
          >
            <Image
              source={{ uri: `https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/kaito-adventure/items/${itemSlug}.png` }}
              style={inventoryListStyles.itemIcon}
              defaultSource={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/kaito-adventure/items/default.png' }}
            />
            <Text style={inventoryListStyles.itemName}>{item.name}</Text>
            <Text style={inventoryListStyles.itemQty}>x{item.quantity}</Text>

            {isEquippable ? (
              <TouchableOpacity style={inventoryListStyles.itemEquipBtn} onPress={() => equipItem(item.name)}>
                <Icon name="gavel" size={12} color={KA_COLORS.textMuted} />
                <Text style={inventoryListStyles.itemEquipBtnText}>Equip</Text>
              </TouchableOpacity>
            ) : null}

            {isGatherPotion ? (
              <TouchableOpacity style={inventoryListStyles.itemEquipBtn} onPress={() => useGatherPotion(item.name)}>
                <Icon name="flask" size={12} color={KA_COLORS.textMuted} />
                <Text style={inventoryListStyles.itemEquipBtnText}>Use</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}
    </ScrollView>

    <View style={inventoryListStyles.sectionDivider}>
      <View style={inventoryListStyles.sectionDividerLine} />
      <Text style={inventoryListStyles.sectionDividerText}>EQUIPMENT</Text>
      <View style={inventoryListStyles.sectionDividerLine} />
    </View>

    <View style={inventoryListStyles.equipmentBar}>
      <View style={inventoryListStyles.equipSlot}>
        <Icon name="gavel" size={16} color={KA_COLORS.orangeSoft} />
        <Text style={inventoryListStyles.equipSlotLabel}>Weapon</Text>
        <Text style={[inventoryListStyles.equipSlotValue, player.equipment.weapon ? inventoryListStyles.equipSlotValueFilled : inventoryListStyles.equipSlotValueEmpty]}>
          {player.equipment.weapon || "None"}
        </Text>
      </View>
      <View style={inventoryListStyles.equipSlot}>
        <Icon name="shield-alt" size={16} color={KA_COLORS.orangeSoft} />
        <Text style={inventoryListStyles.equipSlotLabel}>Armor</Text>
        <Text style={[inventoryListStyles.equipSlotValue, player.equipment.armor ? inventoryListStyles.equipSlotValueFilled : inventoryListStyles.equipSlotValueEmpty]}>
          {player.equipment.armor || "None"}
        </Text>
      </View>

      <View style={inventoryListStyles.rareBadge}>
        <Icon name="star" size={12} color={KA_COLORS.gold} />
        <Text style={inventoryListStyles.rareBadgeText}>Rare: {player.rare_items?.length || 0}</Text>
      </View>
    </View>
  </View>
);

const inventoryListStyles = StyleSheet.create({
  panel: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    padding: 16,
    marginTop: 16,
  },
  inventoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inventoryTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inventoryTitleText: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  inventorySlots: {
    fontSize: 12,
    color: KA_COLORS.textMuted,
    marginLeft: 6,
  },
  inventoryActions: {
    flexDirection: 'row',
    gap: 6,
  },
  inventoryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: KA_COLORS.ink,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
  },
  inventoryActionBtnText: {
    fontSize: 11,
    color: KA_COLORS.textMuted,
  },
  inventoryGrid: {
    maxHeight: 200,
  },
  inventoryGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inventoryItem: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    padding: 8,
    alignItems: 'center',
    gap: 4,
    width: 100,
  },
  inventoryItemRare: {
    borderColor: KA_COLORS.gold,
    backgroundColor: '#1a1508',
  },
  itemIcon: {
    width: 32,
    height: 32,
  },
  itemName: {
    fontSize: 11,
    color: KA_COLORS.ivoryDim,
    textAlign: 'center',
  },
  itemQty: {
    fontSize: 11,
    color: KA_COLORS.orangeSoft,
    fontWeight: '600',
    backgroundColor: KA_COLORS.ink,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
  },
  itemEquipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
  },
  itemEquipBtnText: {
    fontSize: 10,
    color: KA_COLORS.textMuted,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: KA_COLORS.border,
  },
  sectionDividerText: {
    color: KA_COLORS.textMuted,
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  equipmentBar: {
    flexDirection: 'row',
    gap: 16,
    padding: 10,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
  },
  equipSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  equipSlotLabel: {
    color: KA_COLORS.textSecondary,
    fontSize: 13,
  },
  equipSlotValue: {
    fontSize: 13,
  },
  equipSlotValueFilled: {
    color: KA_COLORS.gold,
    fontWeight: '600',
  },
  equipSlotValueEmpty: {
    color: KA_COLORS.textMuted,
    fontStyle: 'italic',
  },
  rareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    fontSize: 11,
    color: KA_COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
  },
  rareBadgeText: {
    fontSize: 11,
    color: KA_COLORS.gold,
  },
});

export default InventoryList;
