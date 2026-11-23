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
    color: '#F36316',
    fontSize: 20,
    fontFamily: 'Yoruka',
    
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
    borderColor: '#FFC857',
  },
  campaignTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  campaignTitleText: {
    color: '#FFC857',
    fontSize: 24,
    fontFamily: 'Yoruka',
    
    marginHorizontal: 12,
  },
  campaignSubtitle: {
    color: '#aaa',
    fontSize: 16,
    fontFamily: 'Yoruka',
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
    fontFamily: 'Yoruka',
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
    backgroundColor: '#F36316',
  },
  timeFrameButtonText: {
    color: '#aaa',
    fontSize: 14,
    fontFamily: 'Yoruka',
  },
  timeFrameButtonTextActive: {
    color: '#fff',
    
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
    backgroundColor: '#F36316',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Yoruka',
  },
  leaderboardContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F36316',
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
    color: '#FFC857',
    fontSize: 12,
    fontFamily: 'Yoruka',
    
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
    fontFamily: 'Yoruka',
    
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
    backgroundColor: '#F36316',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  playerAvatarText: {
    color: '#fff',
    fontSize: 16,
    
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Yoruka',
    
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
    color: '#FFC857',
    fontSize: 14,
    
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
    color: '#FFC857',
    fontSize: 12,
  },
  shareCell: {
    width: 50,
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: 'rgba(255, 200, 87, 0.2)',
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
    borderColor: '#F36316',
  },
  closeModalButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  shareModalTitle: {
    color: '#FFC857',
    fontSize: 20,
    fontFamily: 'Yoruka',
    
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
    borderColor: '#FFC857',
  },
  shareCardTitle: {
    color: '#F36316',
    fontSize: 14,
    fontFamily: 'Yoruka',
    marginBottom: 8,
  },
  shareCardName: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Yoruka',
    
    marginBottom: 4,
  },
  shareCardRank: {
    color: '#FFC857',
    fontSize: 32,
    fontFamily: 'Yoruka',
    
    marginBottom: 4,
  },
  shareCardPoints: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Yoruka',
    marginBottom: 8,
  },
  shareCardTimeFrame: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'Yoruka',
  },
  shareToXButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F36316',
    borderRadius: 12,
    paddingVertical: 16,
  },
  shareToXButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Yoruka',
    
    marginLeft: 8,
  },
});

export default styles;
