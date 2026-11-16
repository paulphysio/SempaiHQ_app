import { StyleSheet } from 'react-native';

export const getTermsStyles = (c) => StyleSheet.create({
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
  },
  lastUpdated: {
    color: c.accent,
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 20,
    fontFamily: 'Yoruka',
  },
  termsContent: {
    gap: 20,
  },
  paragraph: {
    color: c.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Yoruka',
  },
  heading: {
    color: c.accent,
    fontSize: 18,
    
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
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Yoruka',
  },
  bold: {
    
    color: c.textPrimary,
  },
  contactInfo: {
    color: c.accent,
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'Yoruka',
  },
});

