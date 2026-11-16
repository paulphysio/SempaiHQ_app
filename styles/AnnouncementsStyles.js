import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const getAnnouncementsStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bgCard,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: c.textPrimary,
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Yoruka',
  },
  keyboardContainer: {
    flex: 1,
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
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    color: c.textPrimary,
    fontSize: 20,
    
    marginLeft: 12,
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
    color: c.textPrimary,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'Yoruka',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  deniedText: {
    color: c.danger,
    fontSize: 24,
    
    marginTop: 16,
    fontFamily: 'Yoruka',
  },
  deniedSubtext: {
    color: c.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Yoruka',
  },
  dashboard: {
    flex: 1,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    color: c.textPrimary,
    fontSize: 18,
    
    marginLeft: 12,
    fontFamily: 'Yoruka',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: c.accent,
    fontSize: 14,
    
    fontFamily: 'Yoruka',
  },
  input: {
    backgroundColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: c.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
    fontFamily: 'Yoruka',
  },
  textarea: {
    backgroundColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: c.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: 'Yoruka',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  dateButtonText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 12,
    fontFamily: 'Yoruka',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    backgroundColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  pickerOptionActive: {
    backgroundColor: 'rgba(155, 89, 182, 0.3)',
    borderColor: c.accent,
  },
  pickerOptionText: {
    color: c.textMuted,
    fontSize: 14,
    fontFamily: 'Yoruka',
  },
  pickerOptionTextActive: {
    color: '#FFF',
  },
  submitButton: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    
    marginLeft: 12,
    fontFamily: 'Yoruka',
  },
});

