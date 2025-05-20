import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  containerArtist: {
    backgroundColor: '#1A0B2E',
  },
  containerBoth: {
    backgroundColor: '#1C1400',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
  },
  navbar: {
    padding: 16,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  navbarArtist: {
    borderBottomColor: 'rgba(147, 51, 234, 0.6)',
  },
  navbarBoth: {
    borderBottomColor: 'rgba(255, 215, 0, 0.6)',
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoText: {
    fontSize: 18,
    color: '#F36316',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  logoTextArtist: {
    color: '#9333EA',
  },
  logoTextBoth: {
    color: '#FFD700',
  },
  menuToggle: {
    padding: 8,
  },
  menuToggleIcon: {
    color: '#F36316',
  },
  menuToggleIconArtist: {
    color: '#9333EA',
  },
  menuToggleIconBoth: {
    color: '#FFD700',
  },
  navMenu: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  navMenuArtist: {
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
  },
  navMenuBoth: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  navText: {
    fontSize: 16,
    color: '#FFF',
    marginLeft: 8,
    fontWeight: '600',
  },
  main: {
    padding: 16,
  },
  header: {
    padding: 16,
    backgroundColor: '#F36316',
    borderRadius: 8,
    marginBottom: 16,
  },
  headerArtist: {
    backgroundColor: '#9333EA',
  },
  headerBoth: {
    backgroundColor: '#FFD700',
  },
  title: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 69, 69, 0.1)',
    borderRadius: 8,
  },
  error: {
    fontSize: 18,
    color: '#FF4545',
    textAlign: 'center',
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  profileCardArtist: {
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
  },
  profileCardBoth: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 12,
  },
  editProfileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#FFF',
    fontWeight: 'bold',
  },
  bio: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 12,
  },
  socials: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  socialLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  socialText: {
    fontSize: 16,
    color: '#FFF',
    marginLeft: 8,
  },
  walletInfo: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.7,
  },
  novelsSection: {
    marginBottom: 16,
  },
  novelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  novelCard: {
    width: width < 360 ? '100%' : (width - 48) / 2,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  novelImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  novelTitle: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  novelSummary: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.7,
    marginBottom: 8,
  },
  novelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F36316',
    padding: 10,
    borderRadius: 8,
  },
  novelButtonText: {
    fontSize: 16,
    color: '#FFF',
    marginLeft: 8,
    fontWeight: '600',
  },
  placeholder: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.7,
    textAlign: 'center',
  },
  profileActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F36316',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  navButtonText: {
    fontSize: 16,
    color: '#FFF',
    marginLeft: 8,
    fontWeight: '600',
  },
  modal: {
    justifyContent: 'center',
    margin: 0,
  },
  creatorChoicePopup: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
  },
  creatorChoicePopupArtist: {
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
  },
  creatorChoicePopupBoth: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  closePopupButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  popupTitle: {
    fontSize: 20,
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  popupMessage: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 16,
  },
  choiceButton: {
    backgroundColor: '#F36316',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  choiceButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});