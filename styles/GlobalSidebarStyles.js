import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 280,
    height: '100%',
    backgroundColor: '#111218',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(243,99,22,0.3)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    zIndex: 1001,
  },
  sidebarContent: {
    flex: 1,
    paddingTop: 10,
  },
  sidebarProfileSection: {
    padding: 8,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 87, 51, 0.1)',
  },
  sidebarButtons: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 87, 51, 0.2)',
    marginVertical: 8,
    marginHorizontal: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 1000,
  },
  navLinksContainer: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  navGroup: {
    marginBottom: 4,
  },
  navGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 87, 51, 0.1)',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  navGroupText: {
    color: '#FFFFFF',
    fontSize: 15,
    
    fontFamily: 'Yoruka',
    marginLeft: 12,
  },
  dropdownIcon: {
    marginLeft: 8,
  },
  walletAddressText: {
    color: '#FF5733',
    fontSize: 11,
    
    fontFamily: 'Yoruka',
    marginLeft: 8,
  },
  walletButtonConnected: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  walletConnectedText: {
    color: '#4CAF50',
  },
  dropdown: {
    backgroundColor: 'rgba(15, 15, 24, 0.9)',
    borderRadius: 8,
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 87, 51, 0.1)',
  },
  dropdownItemText: {
    color: '#FF5733',
    fontSize: 13,
    
    fontFamily: 'Yoruka',
    marginLeft: 12,
  },
  navIcon: {
    width: 20,
  },
});

export default styles;
