import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  flatListContent: {
    paddingBottom: 20,
  },
  header: {
    padding: 15,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  weatherText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 5,
  },
  // Navbar Styles
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  navbarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  logoText: {
    color: '#ff6200',
    fontSize: 18,
    fontWeight: '700',
  },
  menuToggle: {
    padding: 10,
  },
  navLinks: {
    position: 'absolute',
    top: 70,
    right: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  navLinkActive: {
    backgroundColor: '#ff6200',
    borderRadius: 5,
  },
  navIcon: {
    marginRight: 10,
  },
  navLinkText: {
    color: '#fff',
    fontSize: 16,
  },
  // Connect Button
  connectButtonContainer: {
    padding: 15,
    alignItems: 'center',
  },
  // Leaderboard Button
  leaderboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#ffd700',
    padding: 8,
    marginHorizontal: 10,
    borderRadius: 6,
    marginVertical: 6,
  },
  iconPulse: {
    marginRight: 8,
  },
  buttonText: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '600',
  },
  // Player Info Card
  card: {
    backgroundColor: '#2a2a2a',
    margin: 8,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardBody: {
    padding: 10,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#ff6200',
  },
  cardTitleText: {
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#aaa',
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#444',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 6,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00ccff',
  },
  traitText: {
    color: '#ff6200',
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Inventory Section
  sectionHeader: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#333',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  button: {
    backgroundColor: '#ff6200',
    padding: 6,
    borderRadius: 6,
    width: (width - 40) / 3,
    alignItems: 'center',
    marginVertical: 3,
  },
  inventoryContainer: {
    paddingHorizontal: 10,
  },
  inventoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    padding: 6,
    marginVertical: 3,
  },
  itemImage: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  itemDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  itemName: {
    color: '#fff',
    fontSize: 12,
    flex: 1,
  },
  itemQuantity: {
    color: '#aaa',
    fontSize: 11,
    marginHorizontal: 6,
  },
  actionButton: {
    backgroundColor: '#444',
    padding: 4,
    borderRadius: 4,
    marginLeft: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 10,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    padding: 6,
  },
  // Rare Items
  rareItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  rareItem: {
    alignItems: 'center',
    width: width / 5,
    marginVertical: 5,
  },
  rareItemImage: {
    width: 32,
    height: 32,
    marginBottom: 3,
  },
  rareItemText: {
    color: '#ff6200',
    fontSize: 10,
    textAlign: 'center',
  },
  // Equipment
  equipmentContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  equipmentSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  equipmentLabel: {
    color: '#fff',
    fontSize: 12,
    width: 60,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentImage: {
    width: 24,
    height: 24,
    marginRight: 6,
  },
  equipmentText: {
    color: '#fff',
    fontSize: 11,
  },
  // Ingredients
  ingredientsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  ingredientItem: {
    width: (width - 40) / 4,
    alignItems: 'center',
    marginVertical: 5,
  },
  ingredientImage: {
    width: 32,
    height: 32,
    marginBottom: 3,
  },
  ingredientText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
  },
  // Countdown
  countdownContainer: {
    padding: 8,
    alignItems: 'center',
  },
  countdownText: {
    color: '#ff6200',
    fontSize: 12,
    marginVertical: 3,
  },
  // Modal Styles
  modal: {
    justifyContent: 'center',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 12,
    maxHeight: height * 0.7,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalButtonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  modalButton: {
    backgroundColor: '#ff6200',
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 3,
    width: '48%',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalItemImage: {
    width: 24,
    height: 24,
    marginRight: 6,
  },
  // Craft Modal
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    padding: 6,
    alignItems: 'center',
    backgroundColor: '#444',
    borderRadius: 4,
    marginHorizontal: 3,
  },
  activeTab: {
    backgroundColor: '#ff6200',
  },
  tabText: {
    color: '#fff',
    fontSize: 11,
  },
  ingredientSelection: {
    maxHeight: 200, // Limit height to enable scrolling
    marginBottom: 8,
  },
  ingredientSelectionContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center', // Center items for a cleaner look
    paddingBottom: 12, // Add padding to avoid cutting off last row
  },
  ingredientButton: {
    width: (width - 60) / 4,
    alignItems: 'center',
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#444',
    marginVertical: 3,
  },
  selectedIngredient: {
    borderWidth: 2,
    borderColor: '#ff6200',
  },
  disabledIngredient: {
    opacity: 0.5,
  },
  ingredientButtonText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 3,
  },
  // Combat Modal
  combatContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  combatant: {
    alignItems: 'center',
    width: '45%',
  },
  combatantImage: {
    width: 60,
    height: 60,
    marginBottom: 6,
  },
  combatantText: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
  },
  versusText: {
    color: '#ff6200',
    fontSize: 18,
    fontWeight: '700',
  },
  combatLog: {
    backgroundColor: '#333',
    padding: 6,
    borderRadius: 6,
    maxHeight: 80,
    marginVertical: 6,
  },
  combatLogText: {
    color: '#fff',
    fontSize: 10,
    marginVertical: 1,
  },
  combatLoading: {
    marginVertical: 12,
  },
  combatActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  combatResult: {
    alignItems: 'center',
    marginVertical: 12,
  },
  combatResultText: {
    color: '#ff6200',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  // Leaderboard
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  leaderboardRank: {
    color: '#ff6200',
    fontSize: 12,
    width: 40,
  },
  leaderboardName: {
    color: '#fff',
    fontSize: 12,
    flex: 1,
  },
  leaderboardStats: {
    color: '#aaa',
    fontSize: 11,
  },
  leaderboardDescription: {
    color: '#ccc',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 6,
  },
  leaderboardList: {
    marginTop: 3,
    marginBottom: 6,
  },
  rankContainer: {
    width: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  goldMedal: {
    backgroundColor: '#3a2b00',
    borderColor: '#ffd700',
  },
  silverMedal: {
    backgroundColor: '#2f3136',
    borderColor: '#c0c0c0',
  },
  bronzeMedal: {
    backgroundColor: '#3a2615',
    borderColor: '#cd7f32',
  },
  medalText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  playerInfoContainer: {
    flex: 1,
    paddingRight: 6,
  },
  currentPlayerItem: {
    backgroundColor: '#2f2f2f',
    borderRadius: 6,
    paddingHorizontal: 6,
    marginVertical: 3,
  },
  currentPlayerName: {
    color: '#00ccff',
  },
  topThreeItem: {
    backgroundColor: '#2b2b2b',
  },
  rewardEligibleItem: {
    borderLeftWidth: 2,
    borderLeftColor: '#ffd700',
    paddingLeft: 5,
  },
  rewardIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#332b00',
    borderWidth: 1,
    borderColor: '#ffd700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rewardText: {
    color: '#ffd700',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  leaderboardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#ff6200',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#ff6200',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyLeaderboard: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 10,
    marginTop: 3,
  },
  activeTabText: {
    fontWeight: '700',
    color: '#fff',
  },
  // Quests & Tasks
  questItem: {
    padding: 6,
    backgroundColor: '#333',
    borderRadius: 6,
    marginVertical: 3,
  },
  questText: {
    color: '#fff',
    fontSize: 11,
  },
  questReward: {
    color: '#ff6200',
    fontSize: 10,
    marginTop: 3,
  },
  taskItem: {
    padding: 6,
    backgroundColor: '#333',
    borderRadius: 6,
    marginVertical: 3,
  },
  taskText: {
    color: '#fff',
    fontSize: 11,
  },
  taskReward: {
    color: '#ff6200',
    fontSize: 10,
    marginTop: 3,
  },
  // NPC Dialogue
  npcDialogue: {
    padding: 6,
    backgroundColor: '#333',
    borderRadius: 6,
    marginVertical: 5,
  },
  npcDialogueText: {
    color: '#fff',
    fontSize: 11,
  },
  npcQuestText: {
    color: '#ff6200',
    fontSize: 10,
    marginTop: 3,
  },
  // Skills
  skillTree: {
    marginVertical: 5,
  },
  skillTreeTitle: {
    color: '#ff6200',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  skillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    backgroundColor: '#333',
    borderRadius: 6,
    marginVertical: 3,
  },
  skillText: {
    color: '#fff',
    fontSize: 11,
  },
  // Events
  eventItem: {
    padding: 6,
    backgroundColor: '#333',
    borderRadius: 6,
    marginVertical: 3,
  },
  eventText: {
    color: '#fff',
    fontSize: 11,
  },
  eventTimer: {
    color: '#ff6200',
    fontSize: 10,
    marginTop: 3,
  },
  // Guide
  guideText: {
    color: '#fff',
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 8,
  },
  // Input & Picker
  input: {
    backgroundColor: '#444',
    color: '#fff',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  picker: {
    backgroundColor: '#444',
    color: '#fff',
    borderRadius: 6,
    marginBottom: 8,
  },
});