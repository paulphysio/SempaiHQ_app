import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const SkillsModal = ({ player, skillTrees, unlockSkill, toggleModal }) => {
  const [activeTree, setActiveTree] = useState('Warrior');

  return (
    <View style={skillsModalStyles.container}>
      <View style={skillsModalStyles.tabsContainer}>
        {Object.keys(skillTrees).map(tree => (
          <TouchableOpacity
            key={tree}
            style={[skillsModalStyles.tab, activeTree === tree ? skillsModalStyles.tabActive : null]}
            onPress={() => setActiveTree(tree)}
          >
            <Text style={[skillsModalStyles.tabText, activeTree === tree ? skillsModalStyles.tabTextActive : null]}>
              {tree}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={skillsModalStyles.skillsList}>
        {skillTrees[activeTree].map(skill => {
          const playerSkill = player.skills.find(s => s.name === skill.name);
          return (
            <View key={skill.name} style={skillsModalStyles.skillItem}>
              <View style={skillsModalStyles.skillInfo}>
                <Text style={skillsModalStyles.skillName}>
                  {skill.name} - Level {playerSkill ? playerSkill.level : 0} (Uses: {playerSkill ? playerSkill.uses : 0})
                </Text>
                {skill.effect.damage && (
                  <Text style={skillsModalStyles.skillEffect}>Damage: {playerSkill ? playerSkill.effect.damage : skill.effect.damage}</Text>
                )}
                {skill.effect.healBonus && (
                  <Text style={skillsModalStyles.skillEffect}>Heal Bonus: {playerSkill ? playerSkill.effect.healBonus : skill.effect.healBonus}</Text>
                )}
                {skill.effect.costReduction && (
                  <Text style={skillsModalStyles.skillEffect}>Cost Reduction: {(playerSkill ? playerSkill.effect.costReduction : skill.effect.costReduction) * 100}%</Text>
                )}
                {skill.effect.cooldownReduction && (
                  <Text style={skillsModalStyles.skillEffect}>Cooldown Reduction: {(playerSkill ? playerSkill.effect.cooldownReduction : skill.effect.cooldownReduction) * 100}%</Text>
                )}
                {skill.effect.rareChance && (
                  <Text style={skillsModalStyles.skillEffect}>Rare Chance: {(playerSkill ? playerSkill.effect.rareChance : skill.effect.rareChance) * 100}%</Text>
                )}
                {skill.effect.stunChance && (
                  <Text style={skillsModalStyles.skillEffect}>Stun Chance: {(playerSkill ? playerSkill.effect.stunChance : skill.effect.stunChance) * 100}%</Text>
                )}
              </View>
              {!playerSkill && (
                <TouchableOpacity
                  style={skillsModalStyles.unlockButton}
                  onPress={() => unlockSkill(skill.name, activeTree)}
                >
                  <Text style={skillsModalStyles.unlockButtonText}>Unlock ({skill.cost.gold} Gold)</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={skillsModalStyles.closeButton} onPress={() => toggleModal('skills')}>
        <Icon name="star" size={16} color={KA_COLORS.textSecondary} style={skillsModalStyles.buttonIcon} />
        <Text style={skillsModalStyles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

const skillsModalStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
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
  skillsList: {
    maxHeight: 400,
    marginBottom: 16,
  },
  skillItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  skillInfo: {
    flex: 1,
  },
  skillName: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
    marginBottom: 4,
  },
  skillEffect: {
    fontSize: 12,
    color: KA_COLORS.textSecondary,
    marginBottom: 2,
  },
  unlockButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(204, 85, 0, 0.1)',
    borderWidth: 1,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
  },
  unlockButtonText: {
    fontSize: 12,
    color: KA_COLORS.orangeBright,
  },
  closeButton: {
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

export default SkillsModal;
