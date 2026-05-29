import React from 'react';
import { View, Text, Image, StyleSheet, Modal } from 'react-native';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const TravelModal = ({ show, travelDestination }) => (
  <Modal
    visible={show}
    transparent={true}
    animationType="fade"
  >
    <View style={travelModalStyles.overlay}>
      <View style={travelModalStyles.content}>
        <Image
          source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/kaito-adventure/travel-chibi.jpg' }}
          style={travelModalStyles.chibi}
          defaultSource={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/kaito-adventure/avatars/default.jpg' }}
        />
        <Text style={travelModalStyles.text}>Traveling to {travelDestination}...</Text>
      </View>
    </View>
  </Modal>
);

const travelModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: KA_COLORS.bgCard,
    padding: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  chibi: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    color: KA_COLORS.ivory,
  },
});

export default TravelModal;
