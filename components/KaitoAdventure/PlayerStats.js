import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../styles/KaitoAdventureStyles';

const PlayerStats = ({ player, xpProgress }) => (
  <View style={playerStatsStyles.statsPanel}>
    <View style={playerStatsStyles.statsContent}>
      <View style={playerStatsStyles.avatarFrame}>
        <Image
          source={{ uri: `https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/kaito-adventure/avatars/${player.avatar}.jpg` }}
          style={playerStatsStyles.avatar}
          defaultSource={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/kaito-adventure/avatars/default.jpg' }}
        />
      </View>

      <View style={playerStatsStyles.statsInfo}>
        <View style={playerStatsStyles.nameRow}>
          <Text style={playerStatsStyles.name}>{player.name}</Text>
          <Text style={playerStatsStyles.level}>Lv {player.level}</Text>
        </View>

        <View style={playerStatsStyles.statsRow}>
          <View style={playerStatsStyles.statItem}>
            <Icon name="shield-alt" size={14} color={KA_COLORS.orangeSoft} style={playerStatsStyles.statIcon} />
            <Text style={playerStatsStyles.statLabel}>HP</Text>
            <Text style={playerStatsStyles.statValue}>{player.health}/{player.max_health}</Text>
          </View>
          <View style={playerStatsStyles.statItem}>
            <Icon name="coins" size={14} color={KA_COLORS.orangeSoft} style={playerStatsStyles.statIcon} />
            <Text style={playerStatsStyles.statLabel}>Gold</Text>
            <Text style={playerStatsStyles.statValue}>{player.gold}</Text>
          </View>
          <View style={playerStatsStyles.statItem}>
            <Icon name="star" size={14} color={KA_COLORS.orangeSoft} style={playerStatsStyles.statIcon} />
            <Text style={playerStatsStyles.statLabel}>XP</Text>
            <Text style={playerStatsStyles.statValue}>{player.xp}</Text>
          </View>
        </View>

        <View style={playerStatsStyles.xpContainer}>
          <View style={playerStatsStyles.xpTrack}>
            <View style={[playerStatsStyles.xpFill, { width: `${Math.max(0, Math.min(100, xpProgress))}%` }]} />
          </View>
          <Text style={playerStatsStyles.xpText}>{Math.round(xpProgress)}% to next level</Text>
        </View>
      </View>
    </View>
  </View>
);

const playerStatsStyles = StyleSheet.create({
  statsPanel: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: KA_COLORS.orangePrimary,
    padding: 16,
    position: 'relative',
  },
  statsContent: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  avatarFrame: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: KA_COLORS.orangeDim,
    padding: 3,
    backgroundColor: KA_COLORS.bgCard,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  statsInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    fontSize: 20,
    
    color: KA_COLORS.ivory,
    letterSpacing: 2,
  },
  level: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
    letterSpacing: 1,
    marginLeft: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
    marginTop: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    marginRight: 4,
  },
  statLabel: {
    fontSize: 12,
    color: KA_COLORS.textMuted,
  },
  statValue: {
    fontSize: 14,
    color: KA_COLORS.ivory,
    
  },
  xpContainer: {
    marginTop: 10,
  },
  xpTrack: {
    height: 6,
    backgroundColor: KA_COLORS.ink,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 3,
  },
  xpText: {
    fontSize: 12,
    color: KA_COLORS.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
});

export default PlayerStats;
