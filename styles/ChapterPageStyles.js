// ./styles/NovelPageStyles.js
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  novelTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  novelIntro: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
  },
  chapterContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a2e',
  },
  errorText: {
    color: '#ff5555',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorMessage: {
    color: '#ff5555',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  successMessage: {
    color: '#55ff55',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#333344',
    color: '#ffffff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    width: '80%',
    fontSize: 16,
  },
  fetchButton: {
    backgroundColor: '#55aaff',
    padding: 15,
    borderRadius: 5,
    marginBottom: 20,
  },
  fetchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  backHomeText: {
    color: '#55aaff',
    fontSize: 16,
    textAlign: 'center',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  navButton: {
    padding: 10,
  },
  navButtonText: {
    color: '#55aaff',
    fontSize: 16,
  },
  balanceFloat: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#333344',
    padding: 10,
    borderRadius: 5,
    zIndex: 1000,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  balanceText: {
    color: '#ffffff',
    fontSize: 14,
  },
  lockedContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  message: {
    color: '#ff5555',
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  subMessage: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  paymentOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  unlockButton: {
    backgroundColor: '#55aaff',
    padding: 15,
    borderRadius: 5,
    margin: 10,
    width: 150,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  price: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 5,
  },
  readingOptions: {
    alignItems: 'center',
    marginBottom: 20,
  },
  readWithSmpButton: {
    backgroundColor: '#55aaff',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
  },
  readingModeText: {
    color: '#ffffff',
    fontSize: 14,
  },
  transactionPopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionPopup: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  closePopupButton: {
    alignSelf: 'flex-end',
  },
  closePopupText: {
    color: '#ffffff',
    fontSize: 20,
  },
  popupTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  popupMessage: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  transactionDetails: {
    marginBottom: 20,
  },
  popupButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmButton: {
    backgroundColor: '#55aaff',
    padding: 15,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ff5555',
    padding: 15,
    borderRadius: 5,
    flex: 1,
    alignItems: 'center',
  },
  popupNote: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
});