import { StyleSheet } from 'react-native';

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
    padding: 8,
    marginRight: 12,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'AnimeAce',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'AnimeAce',
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
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'AnimeAce',
  },
  releaseDate: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 4,
    fontFamily: 'AnimeAce',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6600',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  downloadButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    fontFamily: 'AnimeAce',
  },
  installNote: {
    color: '#AAA',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'AnimeAce',
  },
  noDownloads: {
    color: '#AAA',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'AnimeAce',
  },
});

export default styles;
