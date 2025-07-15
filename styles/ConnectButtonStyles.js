import { StyleSheet, Platform, Dimensions } from 'react-native';

export const styles = StyleSheet.create({
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
  connectButtonGradient: {
    flex: 1,
    paddingHorizontal: 10, // Reduced from 12
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600',
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
    zIndex: 1000,
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
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
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
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 320,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  disconnectModalText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  disconnectModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 15,
  },
  confirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#FF5733',
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },

  // Connect wallet modal styles
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  modalText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    fontSize: 16,
    color: '#333',
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
    borderColor: '#FF5733',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#FF5733',
  },
  checkboxText: {
    color: 'white',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    backgroundColor: '#FF5733',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FF5733',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#f44336',
    marginBottom: 16,
    textAlign: 'center',
  },
});