import { StyleSheet } from 'react-native';

export const getExternalWalletStyles = (c) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 2,
    borderColor: c.accent,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  closeButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    
    color: c.textPrimary,
    fontFamily: 'Yoruka',
  },
  placeholder: {
    width: 35,
  },
  content: {
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Yoruka',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: c.textSecondary,
    marginTop: 15,
    fontFamily: 'Yoruka',
  },
  walletList: {
    gap: 12,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.3)',
  },
  walletIcon: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletInfo: {
    flex: 1,
    marginLeft: 15,
  },
  walletName: {
    fontSize: 18,
    
    color: c.textPrimary,
    fontFamily: 'Yoruka',
  },
  walletStatus: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Yoruka',
  },
  installed: {
    color: '#4CAF50',
  },
  notInstalled: {
    color: c.textMuted,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(155, 89, 182, 0.1)',
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  infoText: {
    fontSize: 13,
    color: c.textSecondary,
    marginLeft: 12,
    flex: 1,
    fontFamily: 'Yoruka',
    lineHeight: 18,
  },
});
