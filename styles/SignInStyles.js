import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111', // Slightly lighter than pure black for better visual contrast
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
    color: '#FF9900',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 153, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  authButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default styles;
