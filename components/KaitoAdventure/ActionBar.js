import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../styles/KaitoAdventureStyles';

const ActionBar = ({ toggleModal, startCombat, travel, currentTown, towns, player, countdown, queuedCountdown, formatCountdown }) => (
  <View style={actionBarStyles.commandBar}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={actionBarStyles.commandGrid}>
      <TouchableOpacity style={[actionBarStyles.btn, actionBarStyles.btnPrimary]} onPress={() => toggleModal('craft')}>
        <Icon name="flask" size={16} color={KA_COLORS.orangeBright} style={actionBarStyles.btnIcon} />
        <Text style={actionBarStyles.btnText}>Craft</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[actionBarStyles.btn, actionBarStyles.btnDanger]} onPress={startCombat}>
        <Icon name="gavel" size={16} color="#e08a96" style={actionBarStyles.btnIcon} />
        <Text style={actionBarStyles.btnText}>Combat</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[actionBarStyles.btn, actionBarStyles.btnSuccess]} onPress={() => toggleModal('market')}>
        <Icon name="map" size={16} color={KA_COLORS.successBright} style={actionBarStyles.btnIcon} />
        <Text style={actionBarStyles.btnText}>Market</Text>
      </TouchableOpacity>

      <TouchableOpacity style={actionBarStyles.btn} onPress={() => toggleModal('gather')}>
        <Icon name="map" size={16} color={KA_COLORS.ivoryDim} style={actionBarStyles.btnIcon} />
        <Text style={actionBarStyles.btnText}>Gather</Text>
      </TouchableOpacity>

      <TouchableOpacity style={actionBarStyles.btn} onPress={() => toggleModal('quests')}>
        <Icon name="book" size={16} color={KA_COLORS.ivoryDim} style={actionBarStyles.btnIcon} />
        <Text style={actionBarStyles.btnText}>Quests ({player.quests.length})</Text>
      </TouchableOpacity>

      <TouchableOpacity style={actionBarStyles.btn} onPress={() => toggleModal('stats')}>
        <Icon name="star" size={16} color={KA_COLORS.ivoryDim} style={actionBarStyles.btnIcon} />
        <Text style={actionBarStyles.btnText}>Stats</Text>
      </TouchableOpacity>

      <TouchableOpacity style={actionBarStyles.btn} onPress={() => toggleModal('community')}>
        <Icon name="users" size={16} color={KA_COLORS.ivoryDim} style={actionBarStyles.btnIcon} />
        <Text style={actionBarStyles.btnText}>More</Text>
      </TouchableOpacity>
    </ScrollView>

    <View style={actionBarStyles.countdownContainer}>
      {countdown !== null && countdown > 0 ? (
        <View style={actionBarStyles.countdown}>
          <Text style={actionBarStyles.countdownText}>Gather: {formatCountdown(countdown)}</Text>
        </View>
      ) : null}
      {queuedCountdown !== null && queuedCountdown > 0 ? (
        <View style={actionBarStyles.countdown}>
          <Text style={actionBarStyles.countdownText}>Queued: {formatCountdown(queuedCountdown)}</Text>
        </View>
      ) : null}
    </View>
  </View>
);

const actionBarStyles = StyleSheet.create({
  commandBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: KA_COLORS.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: KA_COLORS.border,
    padding: 4,
    paddingBottom: 4,
  },
  commandGrid: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
  },
  btn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
    backgroundColor: KA_COLORS.bgCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  btnPrimary: {
    borderColor: KA_COLORS.orangePrimary,
    backgroundColor: 'rgba(204, 85, 0, 0.15)',
  },
  btnDanger: {
    borderColor: KA_COLORS.redAccent,
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
  },
  btnSuccess: {
    borderColor: KA_COLORS.success,
    backgroundColor: 'rgba(74, 124, 89, 0.12)',
  },
  btnText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: KA_COLORS.ivoryDim,
  },
  btnIcon: {
    fontSize: 12,
  },
  countdownContainer: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  countdownText: {
    fontSize: 8,
    color: KA_COLORS.orangeSoft,
  },
});

export default ActionBar;
