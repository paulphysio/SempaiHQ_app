import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../styles/KaitoAdventureStyles';

const ModalWrapper = ({ show, onHide, title, children, centered, fullscreen }) => (
  <Modal
    visible={show}
    onRequestClose={onHide}
    animationType="slide"
    transparent={!fullscreen}
  >
    <View style={[modalWrapperStyles.overlay, fullscreen ? modalWrapperStyles.fullscreen : null]}>
      <View style={[modalWrapperStyles.modalContent, fullscreen ? modalWrapperStyles.modalContentFullscreen : null]}>
        <View style={modalWrapperStyles.modalHeader}>
          <Text style={modalWrapperStyles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onHide} style={modalWrapperStyles.closeButton}>
            <Icon name="times" size={20} color={KA_COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={modalWrapperStyles.modalBody} contentContainerStyle={modalWrapperStyles.modalBodyContent}>
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

const modalWrapperStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullscreen: {
    backgroundColor: KA_COLORS.bgPrimary,
  },
  modalContent: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 64,
    elevation: 16,
  },
  modalContentFullscreen: {
    backgroundColor: KA_COLORS.bgPrimary,
    borderWidth: 0,
    borderRadius: 0,
    maxHeight: '100%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
    padding: 16,
    backgroundColor: 'rgba(204, 85, 0, 0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: KA_COLORS.gold,
    letterSpacing: 2,
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    maxHeight: '70%',
  },
  modalBodyContent: {
    padding: 20,
  },
});

export default ModalWrapper;
