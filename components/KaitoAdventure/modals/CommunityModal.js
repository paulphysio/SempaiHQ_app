import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const CommunityModal = ({ mockCommunityEvent, toggleModal }) => {
  const event = mockCommunityEvent();

  return (
    <View style={communityModalStyles.container}>
      <Text style={communityModalStyles.eventText}>{event.description}</Text>
      <TouchableOpacity style={communityModalStyles.actionButton} onPress={event.action}>
        <Icon name="users" size={16} color={KA_COLORS.ivory} style={communityModalStyles.buttonIcon} />
        <Text style={communityModalStyles.actionButtonText}>Perform Action</Text>
      </TouchableOpacity>
      <TouchableOpacity style={communityModalStyles.closeButton} onPress={() => toggleModal('community')}>
        <Text style={communityModalStyles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

const communityModalStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  eventText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    lineHeight: 22,
    marginBottom: 16,
  },
  actionButton: {
    paddingVertical: 12,
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  buttonIcon: {
    fontSize: 16,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
  },
  closeButton: {
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

export default CommunityModal;
