import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    color: '#ff6200',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  campaignHeader: {
    marginBottom: 20,
  },
  campaignBanner: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  campaignTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  campaignTitleText: {
    color: '#ffd700',
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 12,
  },
  campaignSubtitle: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  campaignBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  campaignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  campaignBadgeText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
  },
  timeFrameSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 4,
  },
  timeFrameButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  timeFrameButtonActive: {
    backgroundColor: '#ff6200',
  },
  timeFrameButtonText: {
    color: '#aaa',
    fontSize: 14,
  },
  timeFrameButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#ff6200',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  leaderboardContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ff6200',
    overflow: 'hidden',
  },
  leaderboardHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerText: {
    flex: 1,
    color: '#ffd700',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  readerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  rankCell: {
    width: 50,
    alignItems: 'center',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
  },
  rankNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  playerCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ff6200',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  playerAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  playerAddress: {
    color: '#aaa',
    fontSize: 12,
  },
  scoreCell: {
    width: 70,
    alignItems: 'center',
  },
  scoreValue: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  levelCell: {
    width: 60,
    alignItems: 'center',
  },
  levelValue: {
    color: '#ccc',
    fontSize: 12,
  },
  tierCell: {
    width: 60,
    alignItems: 'center',
  },
  tierBadge: {
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tierText: {
    color: '#ffd700',
    fontSize: 12,
  },
  shareCell: {
    width: 50,
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 8,
    padding: 8,
  },
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModal: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    width: width * 0.9,
    borderWidth: 1,
    borderColor: '#ff6200',
  },
  closeModalButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  shareModalTitle: {
    color: '#ffd700',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  shareCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  shareCardTitle: {
    color: '#ff6200',
    fontSize: 14,
    marginBottom: 8,
  },
  shareCardName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  shareCardRank: {
    color: '#ffd700',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  shareCardPoints: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 8,
  },
  shareCardTimeFrame: {
    color: '#ccc',
    fontSize: 14,
  },
  shareToXButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff6200',
    borderRadius: 12,
    paddingVertical: 16,
  },
  shareToXButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default styles;
