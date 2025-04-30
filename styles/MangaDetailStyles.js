import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
  },
  backButton: {
    backgroundColor: '#FF5733',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navbar: {
    backgroundColor: '#0F0F1B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#FF5733',
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
    borderTopColor: '#FF5733',
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
  header: {
    padding: 20,
    alignItems: 'center',
  },
  coverImage: {
    width: width - 40,
    height: (width - 40) * 1.5, // Aspect ratio 2:3
    borderRadius: 10,
    marginBottom: 20,
  },
  info: {
    width: '100%',
  },
  title: {
    color: '#fff',
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
    marginBottom: 15,
  },
  artistText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 5,
  },
  summary: {
    marginBottom: 20,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  summaryText: {
    color: '#ccc',
    fontSize: 16,
    lineHeight: 24,
  },
  chapters: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  chapterTitle: {
    color: '#fff',
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
    backgroundColor: '#2A2A3E',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  chapterIcon: {
    marginRight: 10,
  },
  chapterText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  premiumIcon: {
    marginLeft: 10,
  },
  noChapters: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  comments: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  commentsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  commentPlaceholder: {
    backgroundColor: '#2A2A3E',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  commentPlaceholderText: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  commentButton: {
    backgroundColor: '#FF5733',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    width: '50%',
  },
  commentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  walletPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F0F1B',
    borderTopWidth: 1,
    borderTopColor: '#FF5733',
    padding: 10,
    zIndex: 1000,
  },
  walletPanelOpen: {
    minHeight: 150,
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
  walletContent: {
    padding: 10,
  },
  walletInfo: {
    marginBottom: 10,
  },
  walletInfoText: {
    color: '#fff',
    fontSize: 14,
    marginVertical: 5,
  },
  bold: {
    fontWeight: 'bold',
  },
  withdrawButton: {
    backgroundColor: '#FF5733',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#0F0F1B',
  },
  footerText: {
    color: '#fff',
    fontSize: 14,
  },
});