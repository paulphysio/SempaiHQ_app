import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1A1A2E',
  },
  errorTitle: {
    color: '#FF5252',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  error: {
    backgroundColor: '#FF5252',
    padding: 10,
    borderRadius: 5,
    margin: 10,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  navbar: {
    backgroundColor: '#0F0F1B',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
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
    width: 30,
    height: 30,
    marginRight: 10,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuToggle: {
    padding: 10,
  },
  navMenu: {
    marginTop: 10,
    backgroundColor: '#1A1A2E',
    borderRadius: 5,
    padding: 10,
  },
  navMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  navMenuText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 10,
  },
  header: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#0F0F1B',
  },
  coverImage: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.6,
    borderRadius: 10,
    marginRight: 20,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    marginRight: 10,
  },
  artistContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  artistText: {
    color: '#F36316',
    fontSize: 16,
    marginLeft: 5,
  },
  genres: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 10,
  },
  summary: {
    marginTop: 10,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  summaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  chapters: {
    padding: 20,
    backgroundColor: '#1A1A2E',
  },
  chapterTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  chapterGrid: {
    paddingBottom: 10,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#0F0F1B',
    borderRadius: 5,
    marginBottom: 10,
  },
  chapterIcon: {
    marginRight: 10,
  },
  chapterText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  premiumIcon: {
    marginLeft: 10,
  },
  noChapters: {
    color: '#B0B0B0',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  comments: {
    padding: 20,
    backgroundColor: '#1A1A2E',
  },
  walletPanel: {
    position: 'absolute',
    bottom: 0,
    right: 20,
    backgroundColor: '#0F0F1B',
    borderRadius: 10,
    padding: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  walletPanelOpen: {
    width: SCREEN_WIDTH * 0.8,
  },
  walletToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  walletSummary: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 10,
  },
  walletContent: {
    padding: 10,
  },
  walletInfo: {
    marginBottom: 10,
  },
  walletInfoText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 5,
  },
  bold: {
    fontWeight: 'bold',
  },
  withdrawButton: {
    backgroundColor: '#F36316',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  withdrawButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    backgroundColor: '#0F0F1B',
    alignItems: 'center',
  },
  footerText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: '#F36316',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});