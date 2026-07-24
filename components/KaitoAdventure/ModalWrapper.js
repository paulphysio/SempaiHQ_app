import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../styles/KaitoAdventureStyles';

const ModalWrapper = ({ show, onHide, title, children, centered, fullscreen }) => (
  <Modal
    visible={show}
    onRequestClose={onHide}
    animationType="slide"
    transparent={!fullscreen}
    statusBarTranslucent
  >
    <View style={[modalWrapperStyles.overlay, fullscreen ? modalWrapperStyles.fullscreenOverlay : null]}>
      <SafeAreaView
        style={fullscreen ? modalWrapperStyles.fullscreenSafeArea : modalWrapperStyles.modalContent}
      >
        {fullscreen ? (
          <>
            <TouchableOpacity
              onPress={onHide}
              style={modalWrapperStyles.fullscreenCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="times" size={18} color={KA_COLORS.textSecondary} />
            </TouchableOpacity>
            <ScrollView
              style={modalWrapperStyles.modalBodyFullscreen}
              contentContainerStyle={modalWrapperStyles.modalBodyContentFullscreen}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={modalWrapperStyles.modalHeader}>
              <Text style={modalWrapperStyles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onHide} style={modalWrapperStyles.closeButton}>
                <Icon name="times" size={20} color={KA_COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={modalWrapperStyles.modalBody}
              contentContainerStyle={modalWrapperStyles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
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
  fullscreenOverlay: {
    backgroundColor: KA_COLORS.bgPrimary,
    padding: 0,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  modalContent: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    width: '100%',
    // Leave room so the card never touches the very top/bottom of the
    // screen, and always leaves space for the close button + a scroll hint.
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 64,
    elevation: 16,
  },
  fullscreenSafeArea: {
    flex: 1,
    backgroundColor: KA_COLORS.bgPrimary,
    // SafeAreaView only insets automatically on iOS; Android needs the
    // status bar height added manually or content sits under the notch.
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 8,
    right: 12,
    zIndex: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
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
    
    color: KA_COLORS.gold,
    letterSpacing: 2,
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    // flexShrink lets the ScrollView give up space to the header instead
    // of overflowing the card's maxHeight.
    flexShrink: 1,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 28,
  },
  modalBodyFullscreen: {
    flex: 1,
  },
  modalBodyContentFullscreen: {
    padding: 16,
    paddingTop: 44, // clears the floating close button
    paddingBottom: 40,
    flexGrow: 1,
  },
});

export default ModalWrapper;
