// ./screens/SwapStyles.js
import { StyleSheet } from 'react-native';

export const getSwapStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bgCard,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: c.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: c.border,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Yoruka',
    
    color: c.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  main: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapCard: {
    backgroundColor: c.bgCard,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  connectPrompt: {
    alignItems: 'center',
  },
  walletIcon: {
    marginBottom: 20,
  },
  connectPromptText: {
    color: c.textPrimary,
    fontSize: 16,
    fontFamily: 'Yoruka',
    textAlign: 'center',
    marginBottom: 20,
  },
  connectButton: {
    backgroundColor: c.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Yoruka',
    
  },
  swapForm: {
    alignItems: 'center',
  },
  formTitle: {
    fontSize: 24,
    fontFamily: 'Yoruka',
    
    color: c.textPrimary,
    marginBottom: 20,
  },
  balanceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.border,
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  balanceText: {
    color: c.textPrimary,
    fontSize: 16,
    fontFamily: 'Yoruka',
    marginLeft: 10,
    flex: 1,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: c.accent,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    color: c.textPrimary,
    fontSize: 16,
    fontFamily: 'Yoruka',
    
    marginBottom: 8,
  },
  input: {
    backgroundColor: c.border,
    color: c.textPrimary,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    fontFamily: 'Yoruka',
    borderWidth: 1,
    borderColor: '#E94560',
  },
  swapButton: {
    flexDirection: 'row',
    backgroundColor: c.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  swapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Yoruka',
    
    marginLeft: 10,
  },
  buttonIcon: {
    marginRight: 10,
  },
  disabledButton: {
    backgroundColor: c.textMuted,
    opacity: 0.7,
  },
  messageContainer: {
    padding: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  successMessage: {
    backgroundColor: '#28A745',
  },
  errorMessage: {
    backgroundColor: '#FF5252',
  },
  messageText: {
    color: c.textPrimary,
    fontSize: 14,
    fontFamily: 'Yoruka',
    textAlign: 'center',
  },
  footer: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: c.bgCard,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  footerText: {
    color: c.textMuted,
    fontSize: 12,
    fontFamily: 'Yoruka',
  },
  modalContainer: {
    backgroundColor: c.textPrimary,
    padding: 20,
    borderRadius: 8,
    width: '80%',
    alignSelf: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  closeButtonText: {
    fontSize: 18,
    fontFamily: 'Yoruka',
    color: c.textPrimary,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Yoruka',
    
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: c.textSecondary,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    fontFamily: 'Yoruka',
  },
  submitButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Yoruka',
    
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Yoruka',
    
  },
  tokenList: {
    maxHeight: 300,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.textSecondary,
  },
  tokenLogo: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  tokenName: {
    fontSize: 16,
    fontFamily: 'Yoruka',
    color: c.textPrimary,
  },
  selectedToken: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.border,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E94560',
  },
  dropdownArrow: {
    marginLeft: 'auto',
  },
  portfolioSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  portfolioTitle: {
    color: c.textPrimary,
    fontSize: 16,
    fontFamily: 'Yoruka',
    
    marginBottom: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  portfolioButton: {
    flex: 1,
    backgroundColor: c.border,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  portfolioButtonText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Yoruka',
    marginTop: 4,
  },
});
