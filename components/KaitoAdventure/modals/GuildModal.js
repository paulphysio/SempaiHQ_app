import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const GuildModal = ({ player, joinGuild, contributeToGuild, toggleModal }) => (
  <View style={guildModalStyles.container}>
    {player.guild ? (
      <View style={guildModalStyles.guildInfo}>
        <Text style={guildModalStyles.guildText}>Member of: {player.guild.name}</Text>
        <Text style={guildModalStyles.guildText}>Goal Progress: {player.guild.progress}/{player.guild.target} Gold</Text>
        <TouchableOpacity style={guildModalStyles.contributeButton} onPress={contributeToGuild}>
          <Text style={guildModalStyles.contributeButtonText}>Contribute 10 Gold</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={guildModalStyles.noGuild}>
        <Text style={guildModalStyles.noGuildText}>Join a guild to contribute to collective goals!</Text>
        <View style={guildModalStyles.guildButtons}>
          <TouchableOpacity style={guildModalStyles.joinButton} onPress={() => joinGuild('Dragon Clan')}>
            <Text style={guildModalStyles.joinButtonText}>Join Dragon Clan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={guildModalStyles.joinButton} onPress={() => joinGuild('Mist Guardians')}>
            <Text style={guildModalStyles.joinButtonText}>Join Mist Guardians</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
    <TouchableOpacity style={guildModalStyles.closeButton} onPress={() => toggleModal('guild')}>
      <Icon name="users" size={16} color={KA_COLORS.textSecondary} style={guildModalStyles.buttonIcon} />
      <Text style={guildModalStyles.closeButtonText}>Close</Text>
    </TouchableOpacity>
  </View>
);

const guildModalStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  guildInfo: {
    marginBottom: 16,
  },
  guildText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    marginBottom: 8,
  },
  contributeButton: {
    paddingVertical: 12,
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
    alignItems: 'center',
  },
  contributeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
  },
  noGuild: {
    marginBottom: 16,
  },
  noGuildText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    marginBottom: 12,
  },
  guildButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  joinButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: 'rgba(204, 85, 0, 0.1)',
    borderWidth: 1,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
    alignItems: 'center',
  },
  joinButtonText: {
    fontSize: 14,
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

export default GuildModal;
