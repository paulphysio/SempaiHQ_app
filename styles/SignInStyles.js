import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A18', // Dark theme background
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  title: {
    color: '#E67E22', // Orange accent color
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(230, 126, 34, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  
  // Wallet section styles
  walletSection: {
    width: '100%',
    marginBottom: 20,
  },
  
  sectionTitle: {
    color: '#E0E0E0',
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // Divider styles
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  
  dividerText: {
    color: '#888888',
    marginHorizontal: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Subtitle style
  subtitle: {
    color: '#E0E0E0',
    fontSize: 18,
    marginBottom: 30,
    textAlign: 'center',
  },
  
  // Connected wallet info
  connectedWallet: {
    width: '100%',
    backgroundColor: 'rgba(46, 125, 50, 0.2)', // Green tint for success
    padding: 15,
    borderRadius: 12,
    marginTop: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  
  connectedText: {
    color: '#81C784', // Light green text
    textAlign: 'center',
    fontSize: 14,
  },
  
  // Wallet connection container
  walletConnectionContainer: {
    width: '100%',
    marginTop: 20,
  },
  authButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  googleButton: {
    backgroundColor: '#DB4437',
  },
  twitterButton: {
    backgroundColor: '#1DA1F2',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  skipButton: {
    marginTop: 30,
    padding: 15,
  },
  skipButtonText: {
    color: '#999999',
    fontSize: 16,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  termsContainer: {
    marginTop: 40,
    width: '100%',
    alignItems: 'center',
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 20,
  },
  termsText: {
    color: '#BBBBBB',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: '#FF9900',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  icon: {
    width: 24,
    height: 24,
    marginRight: 4,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 24, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 12,
  },
  loadingText: {
    color: '#E0E0E0',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Profile section
  profileContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  
  profilePlaceholder: {
    backgroundColor: '#E67E22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  profileInitial: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: 'bold',
  },
  
  userName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  
  userEmail: {
    color: '#BBBBBB',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  
  // Sign out button
  signOutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  
  signOutButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Skip button
  skipButton: {
    marginTop: 15,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    width: '100%',
    alignItems: 'center',
  },
  
  skipButtonText: {
    color: '#BBBBBB',
    fontSize: 15,
    fontWeight: '500',
  },
  
  // Auth button container
  authButtonContainer: {
    width: '100%',
    marginTop: 20,
  },
  
  // Welcome back container
  welcomeBackContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  
  // User greeting
  userGreeting: {
    fontSize: 20,
    color: '#E0E0E0',
    marginBottom: 10,
    fontWeight: '600',
  },
});

export default styles;
