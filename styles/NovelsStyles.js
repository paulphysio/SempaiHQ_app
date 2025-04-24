import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  libraryContainer: {
    flex: 1,
    backgroundColor: '#000',
    paddingBottom: 0,
  },
  // Navbar
  libraryNavbar: {
    position: 'absolute',
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(243, 99, 22, 0.8)',
    padding: 15,
    zIndex: 1000,
  },
  navbarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1200,
    marginHorizontal: 'auto',
  },
  libraryLogo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#F36316',
  },
  logoText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#F36316',
    fontWeight: 'bold',
    ...(Platform.OS === 'web' && {
      textShadow: '2px 2px 4px rgba(243, 99, 22, 0.3)',
    }),
  },
  menuButton: {
    padding: 10,
    zIndex: 1002,
  },
  navItems: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 280,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 20,
    zIndex: 1001,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
  },
  navItemText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  connectBtn: {
    backgroundColor: '#F36316',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  // Header
  libraryHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 32,
    color: '#F36316',
    fontWeight: 'bold',
    ...(Platform.OS === 'web' && {
      textShadow: '2px 2px 4px rgba(243, 99, 22, 0.3)',
    }),
  },
  headerTagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.5)',
    width: '90%',
    maxWidth: 600,
    marginVertical: 10,
  },
  searchIcon: {
    marginHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 5,
  },
  tagSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  tagButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    margin: 5,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.5)',
  },
  tagButtonSelected: {
    backgroundColor: '#F36316',
    borderColor: '#F36316',
  },
  tagButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  tagButtonTextSelected: {
    color: '#000',
    fontWeight: 'bold',
  },
  // Novels Grid
  gridContainer: {
    paddingHorizontal: 10,
    paddingBottom: 100, // Increased for wallet bar + footer
  },
  bookCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 10,
    overflow: 'hidden',
    margin: 10,
    width: (width - 40) / 2,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.3)',
  },
  bookLink: {
    width: '100%',
  },
  bookCover: {
    width: '100%',
    height: 200,
  },
  bookInfo: {
    padding: 10,
  },
  bookTitle: {
    fontSize: 16,
    color: '#F36316',
    fontWeight: 'bold',
    marginBottom: 5,
    ...(Platform.OS === 'web' && {
      textShadow: '1px 1px 2px rgba(243, 99, 22, 0.3)',
    }),
  },
  bookSummary: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 5,
  },
  bookMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    flexWrap: 'wrap',
  },
  authorLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
  },
  viewersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewersText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
  },
  adultTag: {
    backgroundColor: '#FFD700',
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    textTransform: 'uppercase',
  },
  noBooks: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
 
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderTopWidth: 1,
    borderTopColor: '#F36316',
  },
  footerText: {
    fontSize: 14,
    color: '#F36316',
    fontWeight: 'bold',
    ...(Platform.OS === 'web' && {
      textShadow: '1px 1px 2px rgba(243, 99, 22, 0.3)',
    }),
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#F36316',
    fontSize: 16,
    marginTop: 10,
  },
});