import { StyleSheet } from 'react-native';

export const getDownloadStyles = (c) => StyleSheet.create({
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
    padding: 8,
    marginRight: 12,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: c.textPrimary,
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: c.danger,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  downloadList: {
    gap: 16,
  },
  downloadCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  versionInfo: {
    flex: 1,
  },
  versionTitle: {
    color: c.textPrimary,
    fontSize: 18,
    
    fontFamily: 'Yoruka',
  },
  releaseDate: {
    color: c.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6600',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  downloadButtonText: {
    color: '#FFF',
    fontSize: 16,
    
    marginLeft: 8,
    fontFamily: 'Yoruka',
  },
  installNote: {
    color: c.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  noDownloads: {
    color: c.textMuted,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Yoruka',
  },
});

