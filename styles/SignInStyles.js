import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const getSignInStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg, // Dark theme background
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
    color: c.accent, // Orange accent color
    fontSize: 24,
    fontFamily: 'Yoruka',
    
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
    color: c.border,
    fontSize: 14,
    fontFamily: 'Yoruka',
    marginBottom: 12,
    textAlign: 'center',
    
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
    backgroundColor: c.border,
  },
  
  dividerText: {
    color: '#888888',
    marginHorizontal: 10,
    fontSize: 14,
    fontFamily: 'Yoruka',
    
  },
  
  // Subtitle style
  subtitle: {
    color: c.border,
    fontSize: 15,
    fontFamily: 'Yoruka',
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
    fontFamily: 'Yoruka',
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
    borderColor: c.border,
  },
  googleButton: {
    backgroundColor: '#DB4437',
  },
  twitterButton: {
    backgroundColor: '#1DA1F2',
  },
  buttonText: {
    color: c.bgCard,
    fontSize: 15,
    fontFamily: 'Yoruka',
    
    marginLeft: 12,
  },
  skipButton: {
    marginTop: 20,
    padding: 10,
  },
  skipButtonText: {
    color: c.textMuted,
    fontSize: 13,
    fontFamily: 'Yoruka',
    
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
    fontFamily: 'Yoruka',
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: '#FF9900',
    textDecorationLine: 'underline',
    
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
    color: c.border,
    marginTop: 15,
    fontSize: 16,
    fontFamily: 'Yoruka',
    
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
    backgroundColor: c.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  profileInitial: {
    color: c.textPrimary,
    fontSize: 40,
    fontFamily: 'Yoruka',
    
  },
  
  userName: {
    color: c.textPrimary,
    fontSize: 24,
    fontFamily: 'Yoruka',
    
    marginBottom: 5,
    textAlign: 'center',
  },
  
  userEmail: {
    color: '#BBBBBB',
    fontSize: 16,
    fontFamily: 'Yoruka',
    marginBottom: 20,
    textAlign: 'center',
  },
  
  // Sign out button
  signOutButton: {
    backgroundColor: c.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  
  signOutButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontFamily: 'Yoruka',
    
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
    fontFamily: 'Yoruka',
    
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
    fontFamily: 'Yoruka',
    color: c.border,
    marginBottom: 10,
    
  },
});

