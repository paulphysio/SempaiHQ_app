import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { styles, KA_COLORS } from '../../styles/KaitoAdventureStyles';

const GameMessage = ({ message }) => (
  <View style={gameMessageStyles.message}>
    <Text style={gameMessageStyles.messageText}>{message}</Text>
  </View>
);

const gameMessageStyles = StyleSheet.create({
  message: {
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: KA_COLORS.gold,
    padding: 12,
  },
  messageText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    lineHeight: 22,
    fontStyle: 'italic',
  },
});

export default GameMessage;
