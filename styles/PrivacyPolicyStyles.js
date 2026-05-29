import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginRight: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 8,
    fontFamily: 'AnimeAce',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'AnimeAce',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  lastUpdated: {
    color: '#9B59B6',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 20,
    fontFamily: 'AnimeAce',
  },
  policyContent: {
    gap: 20,
  },
  paragraph: {
    color: '#CCC',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'AnimeAce',
  },
  heading: {
    color: '#9B59B6',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 8,
    fontFamily: 'AnimeAce',
  },
  list: {
    gap: 8,
    marginLeft: 16,
    marginBottom: 16,
  },
  listItem: {
    color: '#CCC',
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'AnimeAce',
  },
  bold: {
    fontWeight: 'bold',
    color: '#FFF',
  },
  contactInfo: {
    color: '#9B59B6',
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'AnimeAce',
  },
});

export default styles;
