import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const cardWidth = (width - 40) / 2; // Two columns with 20px padding

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navbar: {
    backgroundColor: '#0F0F1B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F36316',
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuToggle: {
    marginLeft: 15,
    padding: 10,
  },
  navMenu: {
    backgroundColor: '#0F0F1B',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#F36316',
  },
  navMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  navMenuText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  rewardsBelt: {
    backgroundColor: '#F36316',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  beltContent: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  rewardItem: {
    color: '#fff',
    fontSize: 14,
    marginVertical: 5,
    textAlign: 'center',
  },
  bold: {
    fontWeight: 'bold',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerTagline: {
    color: '#ccc',
    fontSize: 16,
    marginVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A3E',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginVertical: 10,
    width: '100%',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 10,
  },
  tagSelectContainer: {
    width: '100%',
    marginVertical: 10,
  },
  tagSelectLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 5,
  },
  tagList: {
    paddingVertical: 5,
  },
  tagOption: {
    backgroundColor: '#2A2A3E',
    borderRadius: 15,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  tagOptionSelected: {
    backgroundColor: '#F36316',
  },
  tagOptionText: {
    color: '#fff',
    fontSize: 14,
  },
  tagOptionTextSelected: {
    fontWeight: 'bold',
  },
  mangaGrid: {
    padding: 20,
  },
  mangaCard: {
    width: cardWidth,
    margin: 5,
    backgroundColor: '#2A2A3E',
    borderRadius: 10,
    overflow: 'hidden',
  },
  mangaLink: {
    flex: 1,
  },
  mangaCover: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  mangaInfo: {
    padding: 10,
  },
  mangaTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mangaSummary: {
    color: '#ccc',
    fontSize: 14,
    marginVertical: 5,
  },
  mangaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#F36316',
  },
  artistLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 5,
  },
  viewers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewersText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 5,
  },
  adultTag: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noManga: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  walletPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F0F1B',
    borderTopWidth: 1,
    borderTopColor: '#F36316',
    padding: 10,
    zIndex: 1000,
  },
  walletPanelOpen: {
    minHeight: 170,
  },
  walletToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#2A2A3E',
    borderRadius: 10,
  },
  walletSummary: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  walletCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  countdownText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 5,
  },
  walletContent: {
    padding: 1,
  },
  walletInfo: {
    marginBottom: 8,
  },
  walletInfoText: {
    color: '#fff',
    fontSize: 14,
    marginVertical: 3,
  },
  withdrawSection: {
    backgroundColor: '#2A2A3E',
    borderRadius: 10,
    padding: 6,
  },
  withdrawInput: {
    backgroundColor: '#1A1A2E',
    color: '#fff',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  withdrawActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  withdrawButton: {
    backgroundColor: '#FF5733',
    borderRadius: 8,
    padding: 15,
    flex: 1,
    alignItems: 'center',
    marginRight: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  refreshButton: {
    backgroundColor: '#888',
    borderRadius: 8,
    padding: 15,
    flex: 1,
    alignItems: 'center',
    marginLeft: 5,
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
});