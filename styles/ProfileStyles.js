import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Yoruka',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    
    fontFamily: 'Yoruka',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  connectPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  promptText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'Yoruka',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Yoruka',
  },
  content: {
    gap: 20,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#9B59B6',
  },
  profileName: {
    color: '#FFF',
    fontSize: 24,
    
    fontFamily: 'Yoruka',
  },
  bio: {
    color: '#CCC',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
    fontFamily: 'Yoruka',
  },
  socials: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  socialLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  socialText: {
    color: '#FFF',
    fontSize: 14,
    marginLeft: 8,
    fontFamily: 'Yoruka',
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(155, 89, 182, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  walletText: {
    color: '#9B59B6',
    fontSize: 14,
    marginLeft: 8,
    fontFamily: 'Yoruka',
  },
  novelsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    
    marginLeft: 12,
    fontFamily: 'Yoruka',
  },
  novelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  novelCard: {
    width: (width - 48) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  novelImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  novelTitle: {
    color: '#FFF',
    fontSize: 16,
    
    padding: 12,
    fontFamily: 'Yoruka',
  },
  novelSummary: {
    color: '#CCC',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingBottom: 12,
    fontFamily: 'Yoruka',
  },
  placeholder: {
    color: '#AAA',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Yoruka',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    
    marginLeft: 8,
    fontFamily: 'Yoruka',
  },
});

export default styles;
