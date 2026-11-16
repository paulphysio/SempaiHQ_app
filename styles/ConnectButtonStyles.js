import { StyleSheet, Platform, Dimensions } from 'react-native';

export const getConnectButtonStyles = (c) => StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 999,
  },
  connectButtonWrapper: {
    height: 38, // Reduced from 42
    borderRadius: 19,
    overflow: 'hidden',
    minWidth: 100, // Reduced from 110
    maxWidth: 150,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
    marginVertical: 6, // Reduced from 8
  },
  // Compact variant for header usage
  connectButtonWrapperCompact: {
    height: 32,
    borderRadius: 16,
    minWidth: 84,
    maxWidth: 120,
    marginVertical: 2,
  },
  connectButtonGradient: {
    flex: 1,
    paddingHorizontal: 10, // Reduced from 12
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectButtonGradientCompact: {
    paddingHorizontal: 8,
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  walletAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIcon: {
    marginRight: 4, // Reduced from 6
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 13, // Reduced from 14
    fontFamily: 'Yoruka',
    
  },
  connectButtonTextCompact: {
    fontSize: 11,
    fontFamily: 'Yoruka',
  },

  dropdownIcon: {
    marginLeft: 4, // Reduced from 6
  },
  
  // Dropdown menu styles
  dropdown: {
    position: 'absolute',
    top: 52, // Position right below the button
    right: 0,
    left: 0,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1002,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  dropdownText: {
    fontSize: 13,
    fontFamily: 'Yoruka',
    color: c.textPrimary,
    marginLeft: 8,
    
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 4,
  },
  disconnectText: {
    color: '#f44336',
  },
  successIcon: {
    marginLeft: 6,
  },
  
  // Disconnect modal styles
  disconnectModal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  disconnectModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  warningIcon: {
    marginBottom: 16,
  },
  disconnectModalTitle: {
    fontSize: 17,
    fontFamily: 'Yoruka',
    
    color: c.textPrimary,
    marginBottom: 12,
  },
  disconnectModalText: {
    fontSize: 13,
    fontFamily: 'Yoruka',
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  disconnectModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: c.bgCard,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: c.textPrimary,
    
    fontSize: 13,
    fontFamily: 'Yoruka',
  },
  confirmButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: c.accent,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    
    fontSize: 13,
    fontFamily: 'Yoruka',
  },

  // Connect wallet modal styles
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Yoruka',
    
    marginBottom: 16,
    color: c.textPrimary,
  },
  modalText: {
    fontSize: 13,
    fontFamily: 'Yoruka',
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: c.bgCard,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    width: '100%',
    fontSize: 14,
    fontFamily: 'Yoruka',
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: c.accent,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: c.accent,
  },
  checkboxText: {
    color: 'white',
    
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: 'Yoruka',
    color: '#666',
  },
  actionButton: {
    backgroundColor: c.accent,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Yoruka',
    
  },
  secondaryButton: {
    paddingVertical: 11,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: c.accent,
    fontSize: 14,
    fontFamily: 'Yoruka',
    
  },
  errorText: {
    color: '#f44336',
    marginBottom: 16,
    textAlign: 'center',
  },

  // Wallet selection modal styles
  modalScrollView: {
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  modalSubtitle: {
    fontSize: 12,
    fontFamily: 'Yoruka',
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  walletOption: {
    backgroundColor: c.bgCard,
    borderRadius: 16,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  walletOptionGradient: {
    padding: 12,
  },
  walletOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 87, 51, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  walletOptionTextContainer: {
    flex: 1,
  },
  walletOptionTitle: {
    fontSize: 14,
    fontFamily: 'Yoruka',
    
    color: c.accent,
    marginBottom: 4,
  },
  walletOptionDescription: {
    fontSize: 12,
    fontFamily: 'Yoruka',
    color: '#666',
    lineHeight: 16,
  },
  walletOptionFeatures: {
    gap: 4,
  },
  walletOptionFeature: {
    fontSize: 11,
    fontFamily: 'Yoruka',
    color: '#28a745',
    
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: 'Yoruka',
    
    color: c.accent,
    marginLeft: 8,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  formIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 87, 51, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  inputContainer: {
    marginBottom: 16,
    width: '100%',
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Yoruka',
    
    color: c.textPrimary,
    marginBottom: 8,
  },
  actionButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: c.bgCard,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#666',
    
    fontSize: 14,
    fontFamily: 'Yoruka',
  },

  // Enhanced dropdown styles
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 8,
  },
  dropdownTitle: {
    fontSize: 16,
    fontFamily: 'Yoruka',
    
    color: c.textPrimary,
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: 'Yoruka',
    color: '#666',
    flex: 1,
  },
  dropdownAction: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 4,
  },
  dropdownActionText: {
    fontSize: 14,
    fontFamily: 'Yoruka',
    color: c.textPrimary,
    
  },
  disconnectAction: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fed7d7',
  },
  disconnectActionText: {
    color: '#e53e3e',
  },
});
