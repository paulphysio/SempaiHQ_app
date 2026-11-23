import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const getPrivacyPolicyStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bgCard,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
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
    fontFamily: 'Yoruka',
  },
  headerTitle: {
    color: c.textPrimary,
    fontSize: 20,
    
    fontFamily: 'Yoruka',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  lastUpdated: {
    color: c.accent,
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 20,
    fontWeight: '700',
  },
  policyContent: {
    gap: 16,
    padding: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgCard,
  },
  paragraph: {
    color: c.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    
  },
  heading: {
    color: c.accent,
    fontSize: 20,
    
    marginTop: 10,
    marginBottom: 8,
    fontFamily: 'Yoruka',
  },
  list: {
    gap: 8,
    marginLeft: 16,
    marginBottom: 16,
  },
  listItem: {
    color: c.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    
  },
  bold: {
    
    color: c.textPrimary,
  },
  contactInfo: {
    color: c.accent,
    fontSize: 16,
    marginBottom: 8,
  },
});

