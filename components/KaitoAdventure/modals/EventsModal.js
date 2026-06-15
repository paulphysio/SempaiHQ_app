import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const EventsModal = ({ currentEvent, eventTimer, formatCountdown, toggleModal }) => (
  <View style={eventsModalStyles.container}>
    {currentEvent ? (
      <Text style={eventsModalStyles.eventText}>
        {currentEvent.description} (Time Left: {formatCountdown(Math.max(0, Math.floor((eventTimer - Date.now()) / 1000)))})
      </Text>
    ) : (
      <Text style={eventsModalStyles.eventText}>No active events right now.</Text>
    )}
    <TouchableOpacity style={eventsModalStyles.closeButton} onPress={() => toggleModal('events')}>
      <Text style={eventsModalStyles.closeButtonText}>Close</Text>
    </TouchableOpacity>
  </View>
);

const eventsModalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  eventText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    lineHeight: 22,
    marginBottom: 16,
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

export default EventsModal;
