import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Modal from 'react-native-modal';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '@react-navigation/native';
import { debounce } from 'lodash';
import _ from 'lodash';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import ConnectButton from '../components/ConnectButton';
import { styles } from '../styles/KaitoStyles';

// ---- Constants Section ----
const avatarImages = {
  default: require('../assets/images/avatars/default.jpg'),
  warrior: require('../assets/images/avatars/warrior.jpg'),
  herbalist: require('../assets/images/avatars/herbalist.jpg'),
  explorer: require('../assets/images/avatars/explorer.jpg'),
};

const itemImages = {
  water: require('../assets/images/items/water.png'),
  herbs: require('../assets/images/items/herbs.png'),
  pepper: require('../assets/images/items/pepper.png'),
  sugar: require('../assets/images/items/sugar.png'),
  'mist-essence': require('../assets/images/items/mist-essence.png'),
  'shadow-root': require('../assets/images/items/shadow-root.png'),
  'iron-ore': require('../assets/images/items/iron-ore.png'),
  wood: require('../assets/images/items/wood.png'),
  'golden-herb': require('../assets/images/items/golden-herb.png'),
  'iron-shard': require('../assets/images/items/iron-shard.png'),
  'mist-crystal': require('../assets/images/items/mist-crystal.png'),
  'herbal-tea': require('../assets/images/items/herbal-tea.png'),
  'spicy-sake': require('../assets/images/items/spicy-sake.png'),
  'mist-potion': require('../assets/images/items/mist-potion.png'),
  'golden-elixir': require('../assets/images/items/golden-elixir.png'),
  'weak-healing-potion': require('../assets/images/items/weak-healing-potion.png'),
  'medium-healing-potion': require('../assets/images/items/medium-healing-potion.png'),
  'strong-healing-potion': require('../assets/images/items/strong-healing-potion.png'),
  'lucky-gather-potion': require('../assets/images/items/lucky-gather-potion.png'),
  'swift-gather-potion': require('../assets/images/items/swift-gather-potion.png'),
  'combat-blade': require('../assets/images/items/combat-blade.png'),
  'steel-axe': require('../assets/images/items/steel-axe.png'),
  'shadow-dagger': require('../assets/images/items/shadow-dagger.png'),
  'leather-armor': require('../assets/images/items/leather-armor.png'),
  chainmail: require('../assets/images/items/chainmail.png'),
  'plate-armor': require('../assets/images/items/plate-armor.png'),
  default: require('../assets/images/items/default.png'),
};

const enemyImages = {
  bandit: require('../assets/images/enemies/bandit.png'),
  'shadow-ninja': require('../assets/images/enemies/shadow-ninja.png'),
  golem: require('../assets/images/enemies/golem.png'),
};

const defaultPlayer = {
  name: "Kaito Brewmaster",
  gold: 5,
  health: 100,
  max_health: 100,
  xp: 0,
  level: 1,
  inventory: [
    { name: "Water", quantity: 2 },
    { name: "Herbs", quantity: 1 },
  ],
  inventory_slots: 10,
  rare_items: [],
  recipes: [
    { name: "Herbal Tea", ingredients: ["Water", "Herbs"], type: "sell", baseGold: 20 },
    { name: "Spicy Sake", ingredients: ["Water", "Pepper"], type: "sell", baseGold: 20 },
    { name: "Mist Potion", ingredients: ["Mist Essence", "Herbs"], type: "sell", baseGold: 20 },
    { name: "Golden Elixir", ingredients: ["Golden Herb", "Mist Essence"], type: "sell", baseGold: 50 },
    { name: "Weak Healing Potion", ingredients: ["Water", "Herbs"], type: "heal", healPercent: 0.2, sellValue: 15 },
    { name: "Medium Healing Potion", ingredients: ["Water", "Mist Essence"], type: "heal", healPercent: 0.4, sellValue: 25 },
    { name: "Strong Healing Potion", ingredients: ["Mist Essence", "Shadow Root"], type: "heal", healPercent: 0.6, sellValue: 40 },
    { name: "Lucky Gather Potion", ingredients: ["Herbs", "Golden Herb"], type: "gather", effect: { rareChanceBoost: 0.1, duration: 300000 } },
    { name: "Swift Gather Potion", ingredients: ["Pepper", "Mist Essence"], type: "gather", effect: { cooldownReduction: 0.2, duration: 300000 } },
    { name: "Combat Blade", ingredients: ["Iron Ore", "Wood"], type: "equip", bonus: { damage: 5 } },
    { name: "Steel Axe", ingredients: ["Iron Ore", "Iron Ore"], type: "equip", bonus: { damage: 8 } },
    { name: "Shadow Dagger", ingredients: ["Shadow Root", "Iron Ore"], type: "equip", bonus: { damage: 6 } },
    { name: "Leather Armor", ingredients: ["Herbs", "Wood"], type: "armor", bonus: { defense: 5 }, unlockLevel: 10 },
    { name: "Chainmail", ingredients: ["Iron Ore", "Shadow Root"], type: "armor", bonus: { defense: 10 }, unlockLevel: 10 },
    { name: "Plate Armor", ingredients: ["Iron Ore", "Mist Crystal"], type: "armor", bonus: { defense: 15 }, unlockLevel: 10 },
  ],
  equipment: { weapon: null, armor: null },
  quests: [],
  skills: [
    { name: "Basic Attack", uses: 0, level: 1, effect: { damage: 10 }, tree: "Warrior" },
  ],
  stats: { enemiesDefeated: 0, potionsCrafted: 0, itemsSold: 0, gathers: 0 },
  last_login: null,
  daily_tasks: [],
  weekly_tasks: [],
  guild: null,
  avatar: "default",
  trait: null,
};

const towns = [
  {
    name: "Sakura Village",
    ingredients: ["Water", "Herbs", "Wood"],
    rareIngredients: [{ name: "Golden Herb", chance: 0.1 }],
    gatherCooldown: 0.5,
    rewardMultiplier: 1,
    demand: { "Herbal Tea": 1.0, "Spicy Sake": 0.8, "Mist Potion": 0.5, "Golden Elixir": 1.5 },
    npcOffers: [{ ingredient: "Pepper", price: 5 }, { ingredient: "Mist Essence", price: 7 }],
    npcs: [
      {
        name: "Hana the Herbalist",
        dialogue: "Greetings! I need Herbs for my remedies. Can you gather 5 for me?",
        quest: { id: "herbQuest", description: "Gather 5 Herbs for Hana", progress: 0, target: 5, reward: { gold: 60, xp: 60 } },
      },
    ],
  },
  {
    name: "Iron Port",
    ingredients: ["Pepper", "Sugar", "Iron Ore"],
    rareIngredients: [{ name: "Iron Shard", chance: 0.1 }],
    gatherCooldown: 1,
    rewardMultiplier: 2,
    demand: { "Herbal Tea": 0.7, "Spicy Sake": 1.2, "Mist Potion": 0.9, "Golden Elixir": 1.2 },
    npcOffers: [{ ingredient: "Water", price: 5 }, { ingredient: "Shadow Root", price: 8 }],
    npcs: [
      {
        name: "Captain Toru",
        dialogue: "Ahoy! We need a sturdy Combat Blade for our next voyage. Craft one for us!",
        quest: { id: "bladeQuest", description: "Craft a Combat Blade for Toru", progress: 0, target: 1, reward: { gold: 80, xp: 80 } },
      },
    ],
  },
  {
    name: "Mist Hollow",
    ingredients: ["Mist Essence", "Shadow Root"],
    rareIngredients: [{ name: "Mist Crystal", chance: 0.2 }],
    gatherCooldown: 2,
    rewardMultiplier: 4,
    demand: { "Herbal Tea": 0.6, "Spicy Sake": 0.9, "Mist Potion": 1.5, "Golden Elixir": 1.8 },
    npcOffers: [{ ingredient: "Herbs", price: 6 }, { ingredient: "Sugar", price: 5 }],
    npcs: [
      {
        name: "Mystic Rei",
        dialogue: "The shadows grow restless. Defeat 3 Bandits to restore peace.",
        quest: { id: "banditQuest", description: "Defeat 3 Bandits for Rei", progress: 0, target: 3, reward: { gold: 100, xp: 100 } },
      },
    ],
  },
];

const allIngredients = ["Water", "Herbs", "Pepper", "Sugar", "Mist Essence", "Shadow Root", "Iron Ore", "Wood", "Golden Herb", "Iron Shard", "Mist Crystal"];
const rare_items = ["Golden Herb", "Iron Shard", "Mist Crystal"];

const weatherTypes = [
  { type: "sunny", gatherBonus: null, combatModifier: 1.0, demandBonus: { "Spicy Sake": 1.1 } },
  { type: "rainy", gatherBonus: { ingredient: "Water", chance: 0.5 }, combatModifier: 0.9, demandBonus: { "Herbal Tea": 1.2 } },
  { type: "foggy", gatherBonus: { ingredient: "Mist Essence", chance: 0.3 }, combatModifier: 0.8, demandBonus: { "Mist Potion": 1.3 } },
];

const enemies = [
  { name: "Bandit", health: 80, damage: 10, gold: 10, drop: "Shadow Root", dropChance: 0.2 },
  { name: "Shadow Ninja", health: 60, damage: 15, gold: 15, drop: "Mist Essence", dropChance: 0.3 },
  { name: "Golem", health: 120, damage: 8, gold: 20, drop: "Iron Ore", dropChance: 0.25 },
];

const skillTrees = {
  Warrior: [
    { name: "Double Strike", uses: 0, level: 0, effect: { damage: 10 }, cost: { gold: 50 } },
    { name: "Stun", uses: 0, level: 0, effect: { damage: 5, stunChance: 0.2 }, cost: { gold: 75 } },
  ],
  Herbalist: [
    { name: "Efficient Brewing", uses: 0, level: 0, effect: { costReduction: 0.2 }, cost: { gold: 50 } },
    { name: "Potent Mix", uses: 0, level: 0, effect: { healBonus: 10 }, cost: { gold: 75 } },
  ],
  Explorer: [
    { name: "Quick Gather", uses: 0, level: 0, effect: { cooldownReduction: 0.1 }, cost: { gold: 50 } },
    { name: "Lucky Find", uses: 0, level: 0, effect: { rareChance: 0.05 }, cost: { gold: 75 } },
  ],
};

// ---- KaitoAdventure Component ----
const KaitoAdventureScreen = () => {
  const navigation = useNavigation();
  const { wallet, connected } = useContext(EmbeddedWalletContext);
  const defaultPlayerMemo = useMemo(
    () => ({
      ...defaultPlayer,
      wallet_address: wallet ? wallet.address : null,
    }),
    [wallet]
  );
  const [player, setPlayer] = useState(defaultPlayerMemo);
  const [currentTown, setCurrentTown] = useState("Sakura Village");
  const [gameMessage, setGameMessage] = useState("Welcome to Kaito's Adventure!");
  const [modals, setModals] = useState({
    craft: false,
    healing: false,
    market: false,
    gather: false,
    combat: false,
    leaderboard: false,
    quests: false,
    daily: false,
    stats: false,
    community: false,
    customize: false,
    npc: false,
    travel: false,
    skills: false,
    events: false,
    guild: false,
    guide: false,
  });
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [lastGatherTimes, setLastGatherTimes] = useState({});
  const [lastQueuedGatherTime, setLastQueuedGatherTime] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [queuedCountdown, setQueuedCountdown] = useState(null);
  const [combatState, setCombatState] = useState(null);
  const [combatResult, setCombatResult] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [townLevels, setTownLevels] = useState({ "Sakura Village": 1, "Iron Port": 1, "Mist Hollow": 1 });
  const [activeTab, setActiveTab] = useState("drinks");
  const [weather, setWeather] = useState(weatherTypes[0]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [eventTimer, setEventTimer] = useState(null);
  const [selectedNPC, setSelectedNPC] = useState(null);
  const [travelDestination, setTravelDestination] = useState(null);
  const [gatherBuff, setGatherBuff] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  // ---- Persistence and Supabase Sync ----
  useEffect(() => {
    const loadPlayer = async () => {
      // Log context state for debugging
      console.log('EmbeddedWalletContext state:', { isWalletConnected, wallet });
  
      // Check for wallet.publicKey
      const walletAddress = wallet?.publicKey;
      if (!walletAddress) {
        console.warn('Cannot load player: No publicKey found in wallet', {
          isWalletConnected,
          wallet,
        });
        setPlayer(defaultPlayerMemo);
        setModals((prev) => ({ ...prev, guide: true }));
        return;
      }
  
      try {
        const normalizedWalletAddress = walletAddress.toLowerCase();
        console.log(`Fetching player data for wallet: ${walletAddress}`);
  
        // Fetch player from Supabase
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('wallet_address', walletAddress)
          .single();
  
        if (error) {
          if (error.code === 'PGRST116') {
            console.log('No player found, creating new player');
            const newPlayer = {
              wallet_address: walletAddress,
              name: 'Kaito',
              level: 1,
              gold: 5,
              xp: 0,
              health: 100,
              max_health: 100,
              inventory: [],
              inventory_slots: 10,
              rare_items: [],
              recipes: [],
              equipment: { armor: null, weapon: null },
              quests: [],
              skills: [],
              stats: { gathers: 0, itemsSold: 0, potionsCrafted: 0, enemiesDefeated: 0 },
              daily_tasks: [],
              weekly_tasks: [],
              guild: null,
              avatar: 'default',
              trait: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
  
            const { error: insertError } = await supabase
              .from('players')
              .insert([newPlayer]);
  
            if (insertError) {
              console.error('Error inserting new player:', insertError);
              setGameMessage('Failed to create player profile.');
              setPlayer(defaultPlayerMemo);
              return;
            }
  
            console.log('New player created:', newPlayer);
            setPlayer(newPlayer);
            setModals((prev) => ({ ...prev, guide: true }));
            return;
          }
          console.error('Error fetching player data:', error);
          setGameMessage('Failed to load player data.');
          setPlayer(defaultPlayerMemo);
          return;
        }
  
        console.log('Player data fetched:', data);
        const mergedPlayer = {
          ...defaultPlayerMemo,
          ...data,
          wallet_address: normalizedWalletAddress,
          name: data.name || defaultPlayerMemo.name,
          level: data.level ?? defaultPlayerMemo.level,
          gold: data.gold ?? defaultPlayerMemo.gold,
          xp: data.xp ?? defaultPlayerMemo.xp,
          health: data.health ?? defaultPlayerMemo.health,
          max_health: data.max_health ?? defaultPlayerMemo.max_health,
          inventory: Array.isArray(data.inventory) ? data.inventory : defaultPlayerMemo.inventory,
          inventory_slots: data.inventory_slots ?? defaultPlayerMemo.inventory_slots,
          rare_items: Array.isArray(data.rare_items) ? data.rare_items : defaultPlayerMemo.rare_items,
          recipes: Array.isArray(data.recipes) ? data.recipes : defaultPlayerMemo.recipes,
          equipment: data.equipment && typeof data.equipment === 'object' ? data.equipment : defaultPlayerMemo.equipment,
          quests: Array.isArray(data.quests) ? data.quests : defaultPlayerMemo.quests,
          skills: Array.isArray(data.skills) ? data.skills : defaultPlayerMemo.skills,
          stats: data.stats && typeof data.stats === 'object' ? data.stats : defaultPlayerMemo.stats,
          last_login: data.last_login || null,
          daily_tasks: Array.isArray(data.daily_tasks) ? data.daily_tasks : defaultPlayerMemo.daily_tasks,
          weekly_tasks: Array.isArray(data.weekly_tasks) ? data.weekly_tasks : defaultPlayerMemo.weekly_tasks,
          guild: data.guild && typeof data.guild === 'object' ? data.guild : defaultPlayerMemo.guild,
          avatar: data.avatar || defaultPlayerMemo.avatar,
          trait: data.trait || defaultPlayerMemo.trait,
        };
  
        setPlayer(mergedPlayer);
        setCurrentTown('Sakura Village');
        setLastGatherTimes({});
        setLastQueuedGatherTime(null);
        setTownLevels({ 'Sakura Village': 1, 'Iron Port': 1, 'Mist Hollow': 1 });
        setGameMessage(`Welcome back, ${mergedPlayer.name}!`);
      } catch (e) {
        console.error('Unexpected error loading player:', e);
        setGameMessage('An error occurred while loading your progress.');
        setPlayer(defaultPlayerMemo);
      }
    };
  
    // Run immediately and retry if wallet is not available
    console.log('Running loadPlayer effect');
    loadPlayer();
  
    // Retry mechanism for delayed wallet state
    const interval = setInterval(() => {
      if (wallet?.publicKey) {
        console.log('Retrying loadPlayer with wallet:', wallet.publicKey);
        loadPlayer();
        clearInterval(interval);
      }
    }, 1000);
  
    return () => clearInterval(interval);
  }, [wallet, defaultPlayerMemo]);

  const saveToLocalStorage = useCallback(
    debounce(() => {
      // Local storage not typically used in React Native; skipping for now
    }, 500),
    [currentTown, lastGatherTimes, lastQueuedGatherTime, townLevels]
  );

  const syncPlayerToSupabase = useCallback(
    debounce(async () => {
      if (!connected || !wallet || !player.wallet_address) {
        console.warn("Cannot sync to Supabase: Wallet not connected or wallet_address is null");
        return;
      }

      try {
        const { error } = await supabase.from('players').upsert(
          {
            wallet_address: player.wallet_address,
            name: player.name,
            level: player.level,
            gold: player.gold,
            xp: player.xp,
            health: player.health,
            max_health: player.max_health,
            inventory: player.inventory,
            inventory_slots: player.inventory_slots,
            rare_items: player.rare_items,
            recipes: player.recipes,
            equipment: player.equipment,
            quests: player.quests,
            skills: player.skills,
            stats: player.stats,
            last_login: new Date().toISOString(),
            daily_tasks: player.daily_tasks,
            weekly_tasks: player.weekly_tasks,
            guild: player.guild,
            avatar: player.avatar,
            trait: player.trait,
            updated_at: new Date().toISOString(),
          },
          { onConflict: ['wallet_address'] }
        );

        if (error) throw error;
      } catch (error) {
        console.error("Error syncing to Supabase:", error);
      }
    }, 1000),
    [player, connected, wallet]
  );

  useEffect(() => {
    if (connected && wallet && player.wallet_address) {
      syncPlayerToSupabase();
      saveToLocalStorage();
    }
    return () => {
      syncPlayerToSupabase.cancel();
      saveToLocalStorage.cancel();
    };
  }, [syncPlayerToSupabase, saveToLocalStorage, player, connected, wallet]);

  // ---- Weather System ----
  useEffect(() => {
    const changeWeather = () => {
      const newWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
      setWeather(newWeather);
      setGameMessage(`The weather changes to ${newWeather.type}!`);
    };
    changeWeather();
    const interval = setInterval(changeWeather, 300000);
    return () => clearInterval(interval);
  }, []);

  // ---- Dynamic Events ----
  useEffect(() => {
    const triggerEvent = () => {
      if (Math.random() < 0.3) {
        const events = [
          {
            type: "festival",
            description: "A festival boosts demand for 24 hours!",
            effect: () =>
              setTownLevels((prev) => ({ ...prev, [currentTown]: prev[currentTown] + 0.5 })),
            duration: 24 * 60 * 60 * 1000,
          },
          {
            type: "raid",
            description: "Bandits raid the town for 1 hour!",
            effect: () => setModals((prev) => ({ ...prev, combat: true })),
            duration: 60 * 60 * 1000,
          },
          {
            type: "storm",
            description: "A storm reduces gathering for 12 hours!",
            effect: () => {},
            duration: 12 * 60 * 60 * 1000,
          },
        ];
        const event = events[Math.floor(Math.random() * events.length)];
        setCurrentEvent(event);
        setGameMessage(event.description);
        event.effect();
        setEventTimer(Date.now() + event.duration);
      }
    };
    triggerEvent();
    const interval = setInterval(triggerEvent, 300000);
    return () => clearInterval(interval);
  }, [currentTown]);

  useEffect(() => {
    if (eventTimer && Date.now() >= eventTimer) {
      setCurrentEvent(null);
      setEventTimer(null);
      setGameMessage("The event has ended!");
    }
  }, [eventTimer]);

  // ---- XP and Leveling ----
  const updateXP = useCallback((xpGain) => {
    setPlayer((prev) => {
      const newXP = prev.xp + xpGain;
      const newLevel = Math.floor(newXP / 150) + 1;
      let updatedPlayer = { ...prev, xp: newXP, level: newLevel };
      if (newLevel > prev.level) {
        updatedPlayer.max_health = 100 + (newLevel - 1) * 10;
        updatedPlayer.health = updatedPlayer.max_health;
        setGameMessage(`Level up! Reached Level ${newLevel}. Max Health increased to ${updatedPlayer.max_health}!`);
      }
      return updatedPlayer;
    });
  }, []);

  const xpProgress = useMemo(() => {
    const xpForNext = player.level * 150;
    const xpForCurrent = (player.level - 1) * 150;
    return Math.min(((player.xp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100, 100);
  }, [player.xp, player.level]);

  // ---- Quests ----
  const addQuest = useCallback((quest) => {
    setPlayer((prev) => ({
      ...prev,
      quests: prev.quests.length < 3 ? [...prev.quests, quest] : prev.quests,
    }));
  }, []);

  const completeQuest = useCallback((questId) => {
    setPlayer((prev) => {
      const quest = prev.quests.find((q) => q.id === questId);
      if (!quest || quest.progress < quest.target) return prev;
      setGameMessage(`Quest "${quest.description}" completed!`);
      return {
        ...prev,
        gold: prev.gold + quest.reward.gold,
        xp: prev.xp + quest.reward.xp,
        level: Math.floor((prev.xp + quest.reward.xp) / 150) + 1,
        quests: prev.quests.filter((q) => q.id !== questId),
      };
    });
  }, []);

  // ---- Daily and Weekly Tasks ----
  const completeDailyTask = useCallback((taskId) => {
    setPlayer((prev) => {
      const task = prev.daily_tasks.find((t) => t.id === taskId);
      if (!task || task.progress < task.target) return prev;
      setGameMessage(`${task.description} completed!`);
      return {
        ...prev,
        gold: prev.gold + (task.reward.gold || 0),
        xp: prev.xp + (task.reward.xp || 0),
        level: Math.floor((prev.xp + (task.reward.xp || 0)) / 150) + 1,
        daily_tasks: prev.daily_tasks.map((t) =>
          t.id === taskId ? { ...t, completed: true } : t
        ),
      };
    });
  }, []);

  const completeWeeklyTask = useCallback((taskId) => {
    setPlayer((prev) => {
      const task = prev.weekly_tasks.find((t) => t.id === taskId);
      if (!task || task.progress < task.target) return prev;
      setGameMessage(`${task.description} completed!`);
      return {
        ...prev,
        gold: prev.gold + (task.reward.gold || 0),
        xp: prev.xp + (task.reward.xp || 0),
        level: Math.floor((prev.xp + (task.reward.xp || 0)) / 150) + 1,
        weekly_tasks: prev.weekly_tasks.map((t) =>
          t.id === taskId ? { ...t, completed: true } : t
        ),
      };
    });
  }, []);

  // ---- Skills Progression ----
  const updateSkillLevel = useCallback((skillName) => {
    setPlayer((prev) => {
      const skills = prev.skills.map((skill) => {
        if (skill.name === skillName) {
          const newUses = skill.uses + 1;
          const newLevel = Math.min(Math.floor(newUses / 5) + 1, 5);
          return {
            ...skill,
            uses: newUses,
            level: newLevel,
            effect: {
              ...skill.effect,
              damage: skill.effect.damage
                ? skill.effect.damage * (1 + (newLevel - 1) * 0.05)
                : undefined,
              healBonus: skill.effect.healBonus
                ? skill.effect.healBonus + (newLevel - 1) * 2
                : undefined,
              costReduction: skill.effect.costReduction
                ? skill.effect.costReduction + (newLevel - 1) * 0.05
                : undefined,
              cooldownReduction: skill.effect.cooldownReduction
                ? skill.effect.cooldownReduction + (newLevel - 1) * 0.02
                : undefined,
              rareChance: skill.effect.rareChance
                ? skill.effect.rareChance + (newLevel - 1) * 0.01
                : undefined,
              stunChance: skill.effect.stunChance
                ? skill.effect.stunChance + (newLevel - 1) * 0.05
                : undefined,
            },
          };
        }
        return skill;
      });
      return { ...prev, skills };
    });
  }, []);

  const unlockSkill = useCallback((skillName, tree) => {
    setPlayer((prev) => {
      const skill = skillTrees[tree].find((s) => s.name === skillName);
      if (prev.gold < skill.cost.gold || prev.skills.some((s) => s.name === skillName)) {
        setGameMessage("Not enough gold or skill already unlocked!");
        return prev;
      }
      return {
        ...prev,
        gold: prev.gold - skill.cost.gold,
        skills: [...prev.skills, { ...skill, level: 1 }],
      };
    });
    setGameMessage(`${skillName} unlocked!`);
  }, []);

  // ---- Crafting ----
  const toggleIngredient = useCallback(
    (item) => {
      setSelectedIngredients((prev) => {
        const countInSelection = prev.filter((i) => i === item).length;
        const ownedItem = player.inventory.find((i) => i.name === item);
        const maxAllowed = ownedItem ? ownedItem.quantity : 0;
        if (countInSelection < maxAllowed) {
          return [...prev, item];
        } else {
          return prev.filter((i, idx) => i !== item || prev.indexOf(i) !== idx);
        }
      });
    },
    [player.inventory]
  );

  const getAvailableIngredients = useMemo(() => {
    return allIngredients.map((name) => {
      const item = player.inventory.find((i) => i.name === name);
      return {
        name,
        quantity: item?.quantity ?? 0,
        owned: !!item,
      };
    });
  }, [player.inventory]);

  const craftItem = useCallback(
    (type, onSuccess) => {
      const recipe = player.recipes.find(
        (r) =>
          r.type === type &&
          r.ingredients.every((ing) => selectedIngredients.includes(ing)) &&
          r.ingredients.length === selectedIngredients.length &&
          (!r.unlockLevel || player.level >= r.unlockLevel)
      );
      if (!recipe) {
        setGameMessage(
          `No matching ${
            type === "heal"
              ? "healing potion"
              : type === "gather"
              ? "gathering potion"
              : "item"
          } recipe for these ingredients${
            type !== "heal" && type !== "gather" && player.level < 10 ? " or level too low" : ""
          }!`
        );
        return;
      }

      const available = getAvailableIngredients;
      const hasEnough = recipe.ingredients.every((ing) => {
        const item = available.find((i) => i.name === ing);
        return item && item.owned && item.quantity > 0;
      });
      if (!hasEnough) {
        setGameMessage("You don’t have enough of the required ingredients!");
        return;
      }

      setPlayer((prev) => {
        const costReduction = prev.skills.some((s) => s.name === "Efficient Brewing")
          ? prev.skills.find((s) => s.name === "Efficient Brewing").effect.costReduction
          : 0;
        const newInventory = prev.inventory
          .map((item) =>
            recipe.ingredients.includes(item.name)
              ? { ...item, quantity: item.quantity - (Math.random() < costReduction ? 0 : 1) }
              : item
          )
          .filter((item) => item.quantity > 0);

        const task = prev.daily_tasks.find((t) => t.description === "Craft 3 potions");
        const updatedTasks = task
          ? prev.daily_tasks.map((t) =>
              t.description === "Craft 3 potions"
                ? { ...t, progress: Math.min(t.progress + 1, t.target) }
                : t
            )
          : prev.daily_tasks;
        if (task && task.progress + 1 >= task.target) completeDailyTask("craftPotions");

        const traitBonus = player.trait === "craftsman" ? 0.1 : 0;
        const successChance = 0.8 + traitBonus;
        const isSuccess = Math.random() < successChance;

        if (isSuccess) {
          const existingItem = prev.inventory.find((item) => item.name === recipe.name);
          const updatedInventory = existingItem
            ? newInventory.map((item) =>
                item.name === recipe.name
                  ? { ...item, quantity: Math.min(item.quantity + 1, prev.inventory_slots) }
                  : item
              )
            : [...newInventory, { name: recipe.name, quantity: 1 }];
          const bladeQuest = prev.quests.find(
            (q) => q.id === "bladeQuest" && recipe.name === "Combat Blade"
          );
          const updatedQuests = bladeQuest
            ? prev.quests.map((q) =>
                q.id === "bladeQuest" ? { ...q, progress: Math.min(q.progress + 1, q.target) } : q
              )
            : prev.quests;

          if (recipe.type === "gather") {
            setGatherBuff({
              type: recipe.effect.rareChanceBoost ? "rareChanceBoost" : "cooldownReduction",
              value: recipe.effect.rareChanceBoost || recipe.effect.cooldownReduction,
              expires: Date.now() + recipe.effect.duration,
            });
            setGameMessage(
              `You crafted ${recipe.name}! It’s in your inventory and boosts gathering for ${
                recipe.effect.duration / 60000
              } minutes!`
            );
          }

          return {
            ...prev,
            inventory: updatedInventory,
            stats: { ...prev.stats, potionsCrafted: prev.stats.potionsCrafted + 1 },
            daily_tasks: updatedTasks,
            quests: updatedQuests,
          };
        }
        return { ...prev, inventory: newInventory };
      });

      const isSuccess = Math.random() < (0.8 + (player.trait === "craftsman" ? 0.1 : 0));
      if (isSuccess) {
        updateXP(type === "heal" || type === "gather" ? 10 : 20);
        if (recipe.type !== "gather") {
          setGameMessage(
            `You crafted ${recipe.name}! It is now in your inventory. (+${
              type === "heal" || type === "gather" ? 10 : 20
            } XP)`
          );
        }
      } else {
        setGameMessage(`Crafting ${recipe.name} failed! Ingredients lost.`);
      }

      setSelectedIngredients([]);
      setModals((prev) => ({ ...prev, [type === "heal" || type === "gather" ? "craft" : "craft"]: false }));
      if (onSuccess && type !== "heal" && type !== "gather") onSuccess(recipe);
    },
    [
      player.recipes,
      player.trait,
      player.skills,
      player.inventory_slots,
      player.level,
      selectedIngredients,
      getAvailableIngredients,
      updateXP,
      completeDailyTask,
      completeQuest,
    ]
  );

  const useGatherPotion = useCallback(
    (potionName) => {
      const potion = player.inventory.find((item) => item.name === potionName);
      if (!potion || potion.quantity === 0) {
        setGameMessage("You don’t have this potion!");
        return;
      }
      const recipe = player.recipes.find((r) => r.name === potionName && r.type === "gather");
      if (!recipe) {
        setGameMessage("This isn’t a gathering potion!");
        return;
      }
      setPlayer((prev) => ({
        ...prev,
        inventory: prev.inventory
          .map((item) =>
            item.name === potionName ? { ...item, quantity: item.quantity - 1 } : item
          )
          .filter((item) => item.quantity > 0),
      }));
      setGatherBuff({
        type: recipe.effect.rareChanceBoost ? "rareChanceBoost" : "cooldownReduction",
        value: recipe.effect.rareChanceBoost || recipe.effect.cooldownReduction,
        expires: Date.now() + recipe.effect.duration,
      });
      setGameMessage(
        `Used ${potionName}! Gathering boosted for ${recipe.effect.duration / 60000} minutes.`
      );
    },
    [player.inventory, player.recipes]
  );

  // ---- Combat ----
  const startCombat = useCallback(() => {
    if (player.health <= 0) {
      setGameMessage("You’re at 0 health! Craft a healing potion in combat to survive.");
    }
    const enemy = enemies[Math.floor(Math.random() * enemies.length)];
    const levelScaleHealth = 1 + (player.level - 1) * 0.15;
    const levelScaleDamage = 1 + (player.level - 1) * 0.05;
    const weatherMod = weather.combatModifier;
    setCombatState({
      playerHealth: player.health > player.max_health ? player.max_health : player.health,
      enemy: {
        ...enemy,
        health: Math.round(enemy.health * levelScaleHealth * weatherMod),
        damage: Math.round(enemy.damage * levelScaleDamage * weatherMod),
        gold: Math.round(enemy.gold * levelScaleHealth),
      },
      enemyHealth: Math.round(enemy.health * levelScaleHealth * weatherMod),
      isAttacking: false,
      log: player.health <= 0 ? ["You’re at 0 health! Craft a potion quickly!"] : [],
    });
    setCombatResult(null);
    setModals((prev) => ({ ...prev, combat: true }));
    if (player.health > 0) {
      setGameMessage(
        `Combat started against ${enemy.name} (HP: ${Math.round(
          enemy.health * levelScaleHealth * weatherMod
        )}, Damage: ${Math.round(enemy.damage * levelScaleDamage * weatherMod)})`
      );
    }
  }, [player.health, player.level, player.max_health, weather]);

  const attackEnemy = useCallback(
    (skillName = "Basic Attack") => {
      if (!combatState || combatState.isAttacking) return;
      setCombatState((prev) => ({ ...prev, isAttacking: true }));
      setTimeout(() => {
        setCombatState((prev) => {
          if (!prev) return null;
          const skill =
            player.skills.find((s) => s.name === skillName) || {
              name: "Basic Attack",
              effect: { damage: 10 },
              level: 1,
            };
          const weaponDamage = player.equipment.weapon
            ? player.recipes.find((r) => r.name === player.equipment.weapon)?.bonus.damage || 0
            : 0;
          const armorDefense = player.equipment.armor
            ? player.recipes.find((r) => r.name === player.equipment.armor)?.bonus.defense || 0
            : 0;
          const traitBonus = player.trait === "warrior" ? 5 : 0;
          const baseDamage = skill.effect.damage || 10;
          const doubledDamage = skill.name === "Double Strike" ? baseDamage * 2 : baseDamage;
          const scaledDamage = doubledDamage * (1 + (skill.level - 1) * 0.05);
          const cappedDamage = Math.min(scaledDamage, 50);
          const totalDamage = Math.round(cappedDamage + weaponDamage + traitBonus);
          const newEnemyHealth = Math.max(prev.enemyHealth - totalDamage, 0);
          const attackMessage = `Kaito uses ${skill.name} for ${totalDamage} damage (Base: ${baseDamage}, Doubled: ${doubledDamage}, Scaled: ${scaledDamage.toFixed(
            1
          )}, Capped: ${cappedDamage}, +Weapon: ${weaponDamage}, +Trait: ${traitBonus})`;
          let newLog = [...prev.log, attackMessage];

          if (skill.effect.stunChance && Math.random() < skill.effect.stunChance) {
            newLog.push(`${prev.enemy.name} is stunned!`);
          }

          if (newEnemyHealth <= 0) {
            const dropChance =
              Math.random() <
              prev.enemy.dropChance *
                (player.skills.some((s) => s.name === "Lucky Find")
                  ? 1 + player.skills.find((s) => s.name === "Lucky Find").effect.rareChance
                  : 1);
            const drop = dropChance ? prev.enemy.drop : null;
            const baseXP = prev.enemy.name === "Bandit" ? 20 : prev.enemy.name === "Shadow Ninja" ? 25 : 30;
            const xpGain = baseXP + (player.level - 1) * 2;
            setPlayer((p) => {
              let newInventory = [...p.inventory];
              let newrare_items = [...p.rare_items];
              if (drop) {
                const existingItem = newInventory.find((item) => item.name === drop);
                newInventory = existingItem
                  ? newInventory.map((item) =>
                      item.name === drop
                        ? { ...item, quantity: Math.min(item.quantity + 1, p.inventory_slots) }
                        : item
                    )
                  : [...newInventory, { name: drop, quantity: 1 }];
                if (rare_items.includes(drop)) newrare_items.push(drop);
              }
              const enemyTask = p.daily_tasks.find((t) => t.id === "defeatEnemies");
              const updatedTasks = enemyTask && !enemyTask.completed
                ? p.daily_tasks.map((t) =>
                    t.id === "defeatEnemies"
                      ? { ...t, progress: Math.min(t.progress + 1, t.target) }
                      : t
                  )
                : p.daily_tasks;
              if (enemyTask && enemyTask.progress + 1 >= enemyTask.target)
                completeDailyTask("defeatEnemies");
              return {
                ...p,
                gold: p.gold + prev.enemy.gold,
                inventory: newInventory,
                rare_items: newrare_items,
                stats: { ...p.stats, enemiesDefeated: p.stats.enemiesDefeated + 1 },
                daily_tasks: updatedTasks,
              };
            });
            updateXP(xpGain);
            setGameMessage(
              `You defeated ${prev.enemy.name} and earned ${prev.enemy.gold} gold!${
                drop ? " Dropped: " + drop : ""
              } (+${xpGain} XP)`
            );
            setCombatResult({
              type: "win",
              message: `Victory! You defeated ${prev.enemy.name}!`,
            });
            setTimeout(() => setModals((m) => ({ ...m, combat: false })), 1500);
            return null;
          }

          const rawDamage =
            skill.effect.stunChance && Math.random() < skill.effect.stunChance
              ? 0
              : prev.enemy.damage;
          const reducedDamage = Math.max(rawDamage - armorDefense, 0);
          const newPlayerHealth = Math.max(prev.playerHealth - reducedDamage, 0);
          newLog.push(`${prev.enemy.name} deals ${reducedDamage} damage to Kaito!`);

          if (newPlayerHealth <= 0) {
            setPlayer((p) => ({ ...p, health: newPlayerHealth }));
            setGameMessage("You were defeated!");
            setCombatResult({
              type: "fail",
              message: `Defeat! ${prev.enemy.name} overpowered you!`,
            });
            setTimeout(() => setModals((m) => ({ ...m, combat: false })), 1500);
            return null;
          }

          setPlayer((p) => ({ ...p, health: newPlayerHealth }));
          updateXP(15);
          updateSkillLevel(skillName);
          return {
            ...prev,
            playerHealth: newPlayerHealth,
            enemyHealth: newEnemyHealth,
            log: newLog,
            isAttacking: false,
          };
        });
      }, 1000);
    },
    [
      combatState,
      player.equipment,
      player.recipes,
      player.trait,
      player.skills,
      player.inventory,
      player.max_health,
      updateXP,
      updateSkillLevel,
      completeDailyTask,
    ]
  );

  const craftPotionInCombat = useCallback(
    (potionName) => {
      if (!combatState || combatState.isAttacking) return;
      setCombatState((prev) => ({ ...prev, isAttacking: true }));
      setTimeout(() => {
        setPlayer((prev) => {
          const recipe = prev.recipes.find((r) => r.name === potionName && r.type === "heal");
          if (!recipe) {
            setGameMessage("No such healing potion recipe!");
            setCombatState((prevState) => ({ ...prevState, isAttacking: false }));
            return prev;
          }
          const available = getAvailableIngredients;
          const hasEnough = recipe.ingredients.every((ing) => {
            const item = available.find((i) => i.name === ing);
            return item && item.owned && item.quantity > 0;
          });
          if (!hasEnough) {
            setGameMessage("Not enough ingredients to craft this potion!");
            setCombatState((prevState) => ({ ...prevState, isAttacking: false }));
            return prev;
          }
          const costReduction = prev.skills.some((s) => s.name === "Efficient Brewing")
            ? prev.skills.find((s) => s.name === "Efficient Brewing").effect.costReduction
            : 0;
          const healBonus = prev.skills.some((s) => s.name === "Potent Mix")
            ? prev.skills.find((s) => s.name === "Potent Mix").effect.healBonus
            : 0;
          const newInventory = prev.inventory
            .map((item) =>
              recipe.ingredients.includes(item.name)
                ? { ...item, quantity: item.quantity - (Math.random() < costReduction ? 0 : 1) }
                : item
            )
            .filter((item) => item.quantity > 0);
          const healAmount = Math.round(prev.max_health * recipe.healPercent) + healBonus;
          const newHealth = Math.min(prev.health + healAmount, prev.max_health);
          setGameMessage(`Crafted and used ${potionName} to heal ${healAmount} HP!`);
          setCombatState((prevState) => ({
            ...prevState,
            playerHealth: newHealth,
            log: [...prevState.log, `Kaito crafts and uses ${potionName} to heal ${healAmount} HP`],
            isAttacking: false,
          }));
          return { ...prev, health: newHealth, inventory: newInventory };
        });
      }, 1000);
    },
    [combatState, player.recipes, player.skills, player.inventory, player.max_health, getAvailableIngredients]
  );

  useEffect(() => {
    const checkBuffExpiration = () => {
      if (gatherBuff && Date.now() >= gatherBuff.expires) {
        setGatherBuff(null);
        setGameMessage("Your gathering potion effect has worn off!");
      }
    };
    const interval = setInterval(checkBuffExpiration, 1000);
    return () => clearInterval(interval);
  }, [gatherBuff]);

  // ---- Leaderboard ----
  const fetchLeaderboardData = useCallback(async () => {
    if (!connected || !wallet) return;
    try {
      const { data, error } = await supabase
        .from('players')
        .select('wallet_address, name, level, gold')
        .order('level', { ascending: false })
        .order('gold', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLeaderboardData(data || []);
      if (data && data.length > 0 && data[0].wallet_address === player.wallet_address) {
        setGameMessage("You’re #1 on the leaderboard! Claim 100 gold next login!");
      }
    } catch (error) {
      console.error("Leaderboard fetch error:", error);
      setLeaderboardData([]);
      setGameMessage("Failed to load leaderboard.");
    }
  }, [connected, wallet, player.wallet_address]);

  useEffect(() => {
    if (connected && wallet && modals.leaderboard) {
      fetchLeaderboardData();
    }
    const interval = setInterval(fetchLeaderboardData, 10000);
    return () => clearInterval(interval);
  }, [fetchLeaderboardData, modals.leaderboard, connected, wallet]);

  // ---- Equipment ----
  const equipItem = useCallback((itemName) => {
    setPlayer((prev) => {
      const item = prev.recipes.find((r) => r.name === itemName && (r.type === "equip" || r.type === "armor"));
      if (!item) return prev;
      return {
        ...prev,
        equipment: {
          ...prev.equipment,
          [item.type === "equip" ? "weapon" : "armor"]: itemName,
        },
      };
    });
  }, []);

  // ---- Town Upgrades ----
  const upgradeTown = useCallback(
    (townName, salesCount) => {
      if (salesCount >= 10) {
        setTownLevels((prev) => ({
          ...prev,
          [townName]: Math.min(prev[townName] + 1, 3),
        }));
      }
    },
    []
  );

  // ---- Market ----
  const buyIngredient = useCallback(
    (ingredient, price) => {
      const cost = Math.floor(price / townLevels[currentTown]);
      setPlayer((prev) => {
        if (prev.gold < cost) {
          setGameMessage("Not enough gold!");
          return prev;
        }
        const newInventory = [...prev.inventory];
        const existingItem = newInventory.find((item) => item.name === ingredient);
        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          newInventory.push({ name: ingredient, quantity: 1 });
        }
        return {
          ...prev,
          gold: prev.gold - cost,
          inventory: newInventory,
        };
      });
      setGameMessage(`Bought ${ingredient} for ${cost} gold!`);
    },
    [currentTown, townLevels]
  );

  const sellDrink = useCallback(
    (itemName) => {
      const recipe = player.recipes.find((r) => r.name === itemName);
      const itemInInventory = player.inventory.find((item) => item.name === itemName);

      if (!itemInInventory || itemInInventory.quantity === 0) {
        setGameMessage("You don’t have any of this item to sell!");
        return;
      }
      if (!recipe || (!recipe.sellValue && !recipe.baseGold)) {
        setGameMessage("This item cannot be sold!");
        return;
      }

      const currentTownData = towns.find((t) => t.name === currentTown);
      const demandMultiplier =
        (currentTownData.demand[itemName] || 1.0) *
        (currentEvent?.type === "festival" ? 1.5 : 1) *
        (weather.demandBonus[itemName] || 1);
      const reward = Math.floor(
        (recipe.sellValue || recipe.baseGold) * currentTownData.rewardMultiplier * demandMultiplier
      );

      setPlayer((prev) => {
        const sellTask = prev.weekly_tasks.find(
          (t) => t.description === "Sell 10 Spicy Sakes" && itemName === "Spicy Sake"
        );
        const updatedWeeklyTasks = sellTask
          ? prev.weekly_tasks.map((t) =>
              t.description === "Sell 10 Spicy Sakes"
                ? { ...t, progress: Math.min(t.progress + 1, t.target) }
                : t
            )
          : prev.weekly_tasks;
        if (sellTask && sellTask.progress + 1 >= sellTask.target)
          completeWeeklyTask("sellDrinks");

        return {
          ...prev,
          inventory: prev.inventory
            .map((item) =>
              item.name === itemName ? { ...item, quantity: item.quantity - 1 } : item
            )
            .filter((item) => item.quantity > 0),
          gold: prev.gold + reward,
          stats: { ...prev.stats, itemsSold: prev.stats.itemsSold + 1 },
          weekly_tasks: updatedWeeklyTasks,
        };
      });
      updateXP(reward * 2);
      upgradeTown(currentTown, player.stats.itemsSold + 1);
      setGameMessage(`You sold ${itemName} for ${reward} gold! (+${reward * 2} XP)`);
    },
    [
      player.inventory,
      player.recipes,
      currentTown,
      currentEvent,
      weather,
      updateXP,
      upgradeTown,
      player.stats.itemsSold,
      completeWeeklyTask,
    ]
  );

  // ---- Inventory Upgrades ----
  const upgradeInventory = useCallback(() => {
    setPlayer((prev) => {
      if (prev.gold < 50) {
        setGameMessage("Not enough gold to upgrade inventory!");
        return prev;
      }
      return { ...prev, gold: prev.gold - 50, inventory_slots: prev.inventory_slots + 5 };
    });
    setGameMessage("Inventory upgraded! +5 slots.");
  }, []);

  // ---- Guild ----
  const joinGuild = useCallback((guildName) => {
    setPlayer((prev) => {
      if (prev.guild) {
        setGameMessage("You’re already in a guild!");
        return prev;
      }
      return { ...prev, guild: { name: guildName, progress: 0, target: 100 } };
    });
    setGameMessage(`Joined ${guildName}! Contribute gold to guild goals.`);
  }, []);

  const contributeToGuild = useCallback(() => {
    setPlayer((prev) => {
      if (!prev.guild || prev.gold < 10) {
        setGameMessage("Not enough gold or no guild!");
        return prev;
      }
      const newProgress = prev.guild.progress + 10;
      if (newProgress >= prev.guild.target) {
        setGameMessage(`${prev.guild.name} goal completed! Earned 50 gold!`);
        return { ...prev, guild: { ...prev.guild, progress: 0 }, gold: prev.gold + 40 };
      }
      return { ...prev, guild: { ...prev.guild, progress: newProgress }, gold: prev.gold - 10 };
    });
  }, []);

  // ---- Gathering ----
  const gatherSingle = useCallback(() => {
    const town = towns.find((t) => t.name === currentTown);
    const now = Date.now();
    const cooldownReduction =
      (player.skills.some((s) => s.name === "Quick Gather")
        ? player.skills.find((s) => s.name === "Quick Gather").effect.cooldownReduction
        : 0) +
      (gatherBuff && gatherBuff.type === "cooldownReduction" && now < gatherBuff.expires
        ? gatherBuff.value
        : 0);
    if (
      lastGatherTimes[currentTown] &&
      now - lastGatherTimes[currentTown] < town.gatherCooldown * 60 * 1000 * (1 - cooldownReduction)
    ) {
      setGameMessage("Gather cooldown active!");
      return;
    }
    const ingredient =
      currentEvent?.type === "storm"
        ? null
        : town.ingredients[Math.floor(Math.random() * town.ingredients.length)];
    if (!ingredient) {
      setGameMessage("Gathering halted by the storm!");
      return;
    }
    setPlayer((prev) => {
      let newInventory = prev.inventory.find((i) => i.name === ingredient)
        ? prev.inventory.map((i) =>
            i.name === ingredient
              ? { ...i, quantity: Math.min(i.quantity + 1, prev.inventory_slots) }
              : i
          )
        : [...prev.inventory, { name: ingredient, quantity: 1 }];
      let newrare_items = [...prev.rare_items];
      const rareChanceBoost =
        gatherBuff && gatherBuff.type === "rareChanceBoost" && now < gatherBuff.expires
          ? gatherBuff.value
          : 0;
      const rareDrop = town.rareIngredients.find(
        (r) =>
          Math.random() <
          r.chance *
            (prev.skills.some((s) => s.name === "Lucky Find")
              ? 1 + prev.skills.find((s) => s.name === "Lucky Find").effect.rareChance
              : 1) +
            rareChanceBoost
      );
      if (rareDrop) {
        newInventory = newInventory.find((i) => i.name === rareDrop.name)
          ? newInventory.map((i) =>
              i.name === rareDrop.name
                ? { ...i, quantity: Math.min(i.quantity + 1, prev.inventory_slots) }
                : i
            )
          : [...newInventory, { name: rareDrop.name, quantity: 1 }];
        newrare_items.push(rareDrop.name);
        setGameMessage(`Rare find! You gathered a ${rareDrop.name}!`);
      }
      if (weather.gatherBonus && Math.random() < weather.gatherBonus.chance) {
        const bonusItem = newInventory.find((i) => i.name === weather.gatherBonus.ingredient);
        newInventory = bonusItem
          ? newInventory.map((i) =>
              i.name === weather.gatherBonus.ingredient
                ? { ...i, quantity: Math.min(i.quantity + 1, prev.inventory_slots) }
                : i
            )
          : [...newInventory, { name: weather.gatherBonus.ingredient, quantity: 1 }];
        setGameMessage(`Weather bonus! You gathered an extra ${weather.gatherBonus.ingredient}!`);
      }
      const herbQuest = prev.quests.find((q) => q.id === "herbQuest" && ingredient === "Herbs");
      const updatedQuests = herbQuest
        ? prev.quests.map((q) =>
            q.id === herbQuest.id ? { ...q, progress: Math.min(q.progress + 1, q.target) } : q
          )
        : prev.quests;
      if (herbQuest && herbQuest.progress + 1 >= herbQuest.target) completeQuest("herbQuest");
      return {
        ...prev,
        inventory: newInventory,
        rare_items: newrare_items,
        quests: updatedQuests,
        stats: { ...prev.stats, gathers: prev.stats.gathers + 1 },
      };
    });
    setLastGatherTimes((prev) => ({ ...prev, [currentTown]: now }));
    if (!gameMessage.includes("Rare find") && !gameMessage.includes("Weather bonus"))
      setGameMessage(`You gathered ${ingredient}!`);
  }, [
    currentTown,
    lastGatherTimes,
    weather,
    completeQuest,
    player.skills,
    player.inventory_slots,
    currentEvent,
    gatherBuff,
  ]);

  const queueGathers = useCallback(
    (count) => {
      const town = towns.find((t) => t.name === currentTown);
      const now = Date.now();
      if (player.gold < count) {
        setGameMessage("Not enough gold!");
        return;
      }
      if (lastQueuedGatherTime && now - lastQueuedGatherTime < 3 * 60 * 1000) {
        setGameMessage("Queued gather cooldown active!");
        return;
      }
      setPlayer((prev) => {
        let newInventory = [...prev.inventory];
        let newrare_items = [...prev.rare_items];
        const rareChanceBoost =
          gatherBuff && gatherBuff.type === "rareChanceBoost" && now < gatherBuff.expires
            ? gatherBuff.value
            : 0;
        for (let i = 0; i < count; i++) {
          const ingredient =
            currentEvent?.type === "storm"
              ? null
              : town.ingredients[Math.floor(Math.random() * town.ingredients.length)];
          if (!ingredient) continue;
          const existingItem = newInventory.find((item) => item.name === ingredient);
          newInventory = existingItem
            ? newInventory.map((item) =>
                item.name === ingredient
                  ? { ...item, quantity: Math.min(item.quantity + 1, prev.inventory_slots) }
                  : item
              )
            : [...newInventory, { name: ingredient, quantity: 1 }];
          if (weather.gatherBonus && Math.random() < weather.gatherBonus.chance) {
            const bonusItem = newInventory.find((i) => i.name === weather.gatherBonus.ingredient);
            newInventory = bonusItem
              ? newInventory.map((i) =>
                  i.name === weather.gatherBonus.ingredient
                    ? { ...i, quantity: Math.min(i.quantity + 1, prev.inventory_slots) }
                    : i
                )
              : [...newInventory, { name: weather.gatherBonus.ingredient, quantity: 1 }];
          }
          const rareDrop = town.rareIngredients.find(
            (r) =>
              Math.random() <
              r.chance *
                (prev.skills.some((s) => s.name === "Lucky Find")
                  ? 1 + prev.skills.find((s) => s.name === "Lucky Find").effect.rareChance
                  : 1) +
                rareChanceBoost
          );
          if (rareDrop) {
            newInventory = newInventory.find((i) => i.name === rareDrop.name)
              ? newInventory.map((i) =>
                  i.name === rareDrop.name
                    ? { ...i, quantity: Math.min(i.quantity + 1, prev.inventory_slots) }
                    : i
                )
              : [...newInventory, { name: rareDrop.name, quantity: 1 }];
            newrare_items.push(rareDrop.name);
          }
        }
        const herbQuest = prev.quests.find((q) => q.id === "herbQuest");
        const updatedQuests = herbQuest
          ? prev.quests.map((q) =>
              q.id === herbQuest.id ? { ...q, progress: Math.min(q.progress + count, q.target) } : q
            )
          : prev.quests;
        if (herbQuest && herbQuest.progress + count >= herbQuest.target)
          completeQuest("herbQuest");
        return {
          ...prev,
          inventory: newInventory,
          rare_items: newrare_items,
          gold: prev.gold - count,
          quests: updatedQuests,
          stats: { ...prev.stats, gathers: prev.stats.gathers + count },
        };
      });
      setLastQueuedGatherTime(now);
      setGameMessage(`You queued ${count} gathers!`);
    },
    [player.gold, player.inventory_slots, lastQueuedGatherTime, currentTown, weather, completeQuest, currentEvent, gatherBuff]
  );

  // ---- Countdowns ----
  const formatCountdown = useCallback((seconds) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return days > 0
      ? `${days}d ${hours}h`
      : hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}m ${secs}s`;
  }, []);

  useEffect(() => {
    const updateCountdowns = () => {
      const now = Date.now();
      const lastNormalTime = lastGatherTimes[currentTown];
      if (lastNormalTime) {
        const townData = towns.find((t) => t.name === currentTown);
        const cooldownReduction = player.skills.some((s) => s.name === "Quick Gather")
          ? player.skills.find((s) => s.name === "Quick Gather").effect.cooldownReduction
          : 0;
        const cooldownSeconds = townData.gatherCooldown * 60 * (1 - cooldownReduction);
        const remainingSeconds = Math.max(
          cooldownSeconds - Math.floor((now - lastNormalTime) / 1000),
          0
        );
        setCountdown(remainingSeconds);
        if (remainingSeconds === 0 && lastNormalTime)
          setGameMessage(`You can gather in ${currentTown} again!`);
      } else {
        setCountdown(null);
      }

      if (lastQueuedGatherTime) {
        const remainingSeconds = Math.max(
          3 * 60 - Math.floor((now - lastQueuedGatherTime) / 1000),
          0
        );
        setQueuedCountdown(remainingSeconds);
        if (remainingSeconds === 0 && lastQueuedGatherTime)
          setGameMessage("You can queue gathers for gold again!");
      } else {
        setQueuedCountdown(null);
      }
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, [lastGatherTimes, lastQueuedGatherTime, currentTown, player.skills]);

  // ---- Inventory ----
  const sortInventory = useCallback(() => {
    setPlayer((prev) => ({
      ...prev,
      inventory: [...prev.inventory].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, []);

  // ---- Community Event ----
  const mockCommunityEvent = useCallback(
    () => ({
      description:
        "Community Goal: Contribute 500 gold total! Current: " +
        Math.min(500, Math.floor(Math.random() * 600)) +
        "/500",
      action: () => {
        setPlayer((prev) => {
          if (prev.gold < 50) {
            setGameMessage("Need 50 gold to contribute!");
            return prev;
          }
          const contribution = 50;
          setGameMessage("You contributed 50 gold to the community goal!");
          if (Math.random() < 0.2) {
            setGameMessage("Community goal completed! Earned 100 gold!");
            return { ...prev, gold: prev.gold - contribution + 100 };
          }
          return { ...prev, gold: prev.gold - contribution };
        });
        setModals((prev) => ({ ...prev, community: false }));
      },
    }),
    []
  );

  // ---- Travel ----
  const travel = useCallback(
    (town) => {
      setTravelDestination(town);
      setModals((prev) => ({ ...prev, travel: true }));
      setTimeout(() => {
        setCurrentTown(town);
        updateXP(2);
        setGameMessage(`You arrived at ${town}! (+2 XP)`);
        setModals((prev) => ({ ...prev, travel: false }));
        setTravelDestination(null);
      }, 5000);
    },
    [updateXP]
  );

  // ---- Character Customization ----
  const [customName, setCustomName] = useState(player.name);
  const [customAvatar, setCustomAvatar] = useState(player.avatar);
  const [customTrait, setCustomTrait] = useState(player.trait);

  const customizeCharacter = useCallback(() => {
    setPlayer((prev) => ({
      ...prev,
      name: customName || prev.name,
      avatar: customAvatar || prev.avatar,
      trait: customTrait || prev.trait,
    }));
    setModals((prev) => ({ ...prev, customize: false }));
    setGameMessage(`Character customized! Welcome, ${customName || player.name}!`);
  }, [customName, customAvatar, customTrait, player.name]);

  // ---- Modal Toggle ----
  const toggleModal = useCallback((modal) => {
    setModals((prev) => ({ ...prev, [modal]: !prev[modal] }));
  }, []);

  // ---- Render Data for FlatList ----
  const renderData = [
    { type: 'navbar' },
    { type: 'connectButton' },
    { type: 'leaderboardButton' },
    { type: 'playerInfo' },
    { type: 'inventoryHeader' },
    { type: 'inventoryButtons' },
    { type: 'inventoryList', data: player.inventory },
    { type: 'rareItems' },
    { type: 'equipment' },
    { type: 'ingredientsHeader' },
    { type: 'ingredientsList', data: getAvailableIngredients },
    { type: 'actionButtons' },
    { type: 'countdown' },
  ];

  // ---- Render Item for FlatList ----
  const renderItem = ({ item }) => {
    switch (item.type) {
      case 'navbar':
        return (
          <View style={styles.navbar}>
            <View style={styles.navbarBrand}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>Sempai HQ</Text>
            </View>
            <TouchableOpacity onPress={toggleMenu} style={styles.menuToggle}>
              <Icon name={menuOpen ? 'times' : 'bars'} size={24} color="#ff6200" />
            </TouchableOpacity>
            {menuOpen && (
              <View style={styles.navLinks}>
                <TouchableOpacity
                  style={styles.navLink}
                  onPress={() => navigation.navigate('Home')}
                >
                  <Icon name="home" size={20} color="#ff6200" style={styles.navIcon} />
                  <Text style={styles.navLinkText}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navLink}
                  onPress={() => navigation.navigate('Profile')}
                >
                  <Icon name="user" size={20} color="#ff6200" style={styles.navIcon} />
                  <Text style={styles.navLinkText}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.navLink, styles.navLinkActive]}>
                  <Icon name="gamepad" size={20} color="#ff6200" style={styles.navIcon} />
                  <Text style={styles.navLinkText}>Game</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      case 'connectButton':
        return (
          <View style={styles.connectButtonContainer}>
            <ConnectButton />
          </View>
        );
      case 'leaderboardButton':
        return (
          <TouchableOpacity
            style={styles.leaderboardButton}
            onPress={() => toggleModal('leaderboard')}
          >
            <Icon name="star" size={20} color="#ff6200" style={styles.iconPulse} />
            <Text style={styles.buttonText}>Leaderboard</Text>
          </TouchableOpacity>
        );
      case 'playerInfo':
        return (
          <View style={styles.card}>
            <View style={styles.cardBody}>
              <View style={styles.cardTitleContainer}>
                <Image
                  source={avatarImages[player.avatar] || avatarImages.default}
                  style={styles.avatar}
                  resizeMode="cover"
                  onError={() => console.warn(`Failed to load avatar: ${player.avatar}`)}
                />
                <Text style={styles.cardTitle}>
                  {player.name} (Level {player.level})
                </Text>
              </View>
              <Text style={styles.statText}>
                <Icon name="shield-alt" size={16} color="#ff6200" /> Health:{' '}
                {player.health}/{player.max_health} | <Icon name="coins" size={16} color="#ff6200" />{' '}
                Gold: {player.gold} | <Icon name="star" size={16} color="#ff6200" /> XP:{' '}
                {player.xp}
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${xpProgress}%` }]} />
                <Text style={styles.progressText}>{Math.round(xpProgress)}%</Text>
              </View>
              <Text style={styles.infoText}>
                Current Town: {currentTown} (Level {townLevels[currentTown]}) | Weather:{' '}
                {weather.type}
              </Text>
              {currentEvent && (
                <Text style={styles.eventText}>
                  {currentEvent.description}{' '}
                  {eventTimer
                    ? `(${formatCountdown(
                        Math.max(0, Math.floor((eventTimer - Date.now()) / 1000))
                      )})`
                    : ''}
                </Text>
              )}
              <Text style={styles.gameMessage}>{gameMessage}</Text>
            </View>
          </View>
        );
      case 'inventoryHeader':
        return (
          <Text style={styles.sectionTitle}>
            <Icon name="flask" size={20} color="#ff6200" /> Inventory (Max:{' '}
            {player.inventory_slots})
          </Text>
        );
      case 'inventoryButtons':
        return (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionButton} onPress={sortInventory}>
              <Text style={styles.buttonText}>Sort</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={upgradeInventory}>
              <Text style={styles.buttonText}>Upgrade (+5) <Icon name="coins" size={14} color="#ff6200" /> 50</Text>
            </TouchableOpacity>
          </View>
        );
      case 'inventoryList':
        return (
          <FlatList
            data={item.data}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <View style={styles.inventoryItem}>
                <View style={styles.inventoryItemText}>
                  <Image
                    source={itemImages[item.name.toLowerCase().replace(' ', '-')] || itemImages.default}
                    style={styles.itemImage}
                    resizeMode="contain"
                    onError={() => console.warn(`Failed to load item image: ${item.name}`)}
                  />
                  <Text
                    style={[
                      styles.inventoryText,
                      rare_items.includes(item.name) && styles.rareItem,
                    ]}
                  >
                    {item.name}: {item.quantity}
                  </Text>
                </View>
                {(player.recipes.find(
                  (r) => r.name === item.name && (r.type === 'equip' || r.type === 'armor')
                )) && (
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => equipItem(item.name)}
                  >
                    <Text style={styles.buttonText}>
                      <Icon name="sword" size={14} color="#ff6200" /> Equip
                    </Text>
                  </TouchableOpacity>
                )}
                {(player.recipes.find(
                  (r) => r.name === item.name && r.type === 'gather'
                )) && (
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => useGatherPotion(item.name)}
                  >
                    <Text style={styles.buttonText}>
                      <Icon name="flask" size="14" color="#ff6200" /> Use
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            style={styles.inventoryList}
          />
        );
      case 'rareItems':
        return (
          <Text style={styles.infoText}>
            <Icon name="star" size={16} color="#ff6200" /> Rare Items:{' '}
            {player.rare_items.join(', ') || 'None'}
          </Text>
        );
      case 'equipment':
        return (
          <Text style={styles.infoText}>
            <Icon name="shield-alt" size={16} color="#ff6200" /> Equipped: Weapon:{' '}
            {player.equipment.weapon || 'None'} | Armor: {player.equipment.armor || 'None'}
          </Text>
        );
      case 'ingredientsHeader':
        return (
          <Text style={styles.sectionTitle}>
            <Icon name="map" size={20} color="#ff6200" /> Available Ingredients in{' '}
            {currentTown}
          </Text>
        );
      case 'ingredientsList':
        return (
          <FlatList
            data={item.data}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <View style={styles.inventoryItem}>
                <Image
                  source={itemImages[item.name.toLowerCase().replace(' ', '-')] || itemImages.default}
                  style={styles.itemImage}
                  resizeMode="contain"
                  onError={() => console.warn(`Failed to load item image: ${item.name}`)}
                />
                <Text style={styles.inventoryText}>
                  {item.name}:{' '}
                  {item.owned
                    ? item.quantity
                    : towns
                        .find((t) => t.name === currentTown)
                        .ingredients.includes(item.name)
                    ? '∞ (Town)'
                    : '0'}
                </Text>
              </View>
            )}
            style={styles.inventoryList}
          />
        );
      case 'actionButtons':
        return (
          <View style={styles.actionButtonContainer}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('craft')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="flask" size={16} color="#ffffff" /> Craft
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={startCombat}>
                <Text style={styles.buttonText}>
                  <Icon name="skull" size={16} color="#ffffff" /> Combat
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('market')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="map" size={16} color="#ffffff" /> Town
                </Text>
                </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('gather')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="leaf" size={16} color="#ffffff" /> Gather
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('quests')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="scroll" size={16} color="#ffffff" /> Quests
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('daily')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="calendar-day" size={16} color="#ffffff" /> Daily
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('stats')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="chart-bar" size={16} color="#ffffff" /> Stats
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('community')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="users" size={16} color="#ffffff" /> Community
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('customize')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="user-edit" size={16} color="#ffffff" /> Customize
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('npc')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="comment" size={16} color="#ffffff" /> NPCs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('travel')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="map-signs" size={16} color="#ffffff" /> Travel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('skills')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="bolt" size={16} color="#ffffff" /> Skills
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('events')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="calendar-alt" size={16} color="#ffffff" /> Events
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('guild')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="shield-alt" size={16} color="#ffffff" /> Guild
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleModal('guide')}
              >
                <Text style={styles.buttonText}>
                  <Icon name="book" size={16} color="#ffffff" /> Guide
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'countdown':
        return (
          <View style={styles.countdownContainer}>
            {countdown !== null && countdown > 0 && (
              <Text style={styles.countdownText}>
                Gather Cooldown: {formatCountdown(countdown)}
              </Text>
            )}
            {queuedCountdown !== null && queuedCountdown > 0 && (
              <Text style={styles.countdownText}>
                Queued Gather Cooldown: {formatCountdown(queuedCountdown)}
              </Text>
            )}
            {gatherBuff && Date.now() < gatherBuff.expires && (
              <Text style={styles.countdownText}>
                Gather Buff Active: {formatCountdown(
                  Math.max(0, Math.floor((gatherBuff.expires - Date.now()) / 1000))
                )}
              </Text>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  // ---- Render Modals ----
  const renderModals = () => (
    <>
      {/* Craft Modal */}
      <Modal
        isVisible={modals.craft}
        onBackdropPress={() => toggleModal('craft')}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="flask" size={20} color="#ff6200" /> Craft Item
          </Text>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'drinks' && styles.activeTab]}
              onPress={() => setActiveTab('drinks')}
            >
              <Text style={styles.tabText}>Drinks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'potions' && styles.activeTab]}
              onPress={() => setActiveTab('potions')}
            >
              <Text style={styles.tabText}>Potions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'equipment' && styles.activeTab]}
              onPress={() => setActiveTab('equipment')}
            >
              <Text style={styles.tabText}>Equipment</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={getAvailableIngredients}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.ingredientItem,
                  selectedIngredients.includes(item.name) && styles.selectedIngredient,
                  !item.owned && styles.disabledIngredient,
                ]}
                onPress={() => item.owned && toggleIngredient(item.name)}
                disabled={!item.owned}
              >
                <Image
                  source={itemImages[item.name.toLowerCase().replace(' ', '-')] || itemImages.default}
                  style={styles.itemImage}
                  resizeMode="contain"
                />
                <Text style={styles.ingredientText}>
                  {item.name}: {item.quantity}
                </Text>
                {selectedIngredients.includes(item.name) && (
                  <Text style={styles.ingredientCount}>
                    x{selectedIngredients.filter((i) => i === item.name).length}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            style={styles.ingredientList}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => craftItem(activeTab === 'drinks' ? 'sell' : activeTab === 'potions' ? 'heal' : 'equip')}
            >
              <Text style={styles.buttonText}>Craft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setSelectedIngredients([]);
                toggleModal('craft');
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Market Modal */}
      <Modal
        isVisible={modals.market}
        onBackdropPress={() => toggleModal('market')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="map" size={20} color="#ff6200" /> {currentTown} Market
          </Text>
          <FlatList
            data={towns.find((t) => t.name === currentTown).npcOffers}
            keyExtractor={(item) => item.ingredient}
            renderItem={({ item }) => (
              <View style={styles.marketItem}>
                <Image
                  source={itemImages[item.ingredient.toLowerCase().replace(' ', '-')] || itemImages.default}
                  style={styles.itemImage}
                  resizeMode="contain"
                />
                <Text style={styles.marketText}>
                  {item.ingredient}: {Math.floor(item.price / townLevels[currentTown])} Gold
                </Text>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => buyIngredient(item.ingredient, item.price)}
                >
                  <Text style={styles.buttonText}>Buy</Text>
                </TouchableOpacity>
              </View>
            )}
            style={styles.marketList}
          />
          <Text style={styles.sectionTitle}>Sell Items</Text>
          <FlatList
            data={player.inventory.filter((item) =>
              player.recipes.find((r) => r.name === item.name && (r.baseGold || r.sellValue))
            )}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => {
              const recipe = player.recipes.find((r) => r.name === item.name);
              const demandMultiplier =
                (towns.find((t) => t.name === currentTown).demand[item.name] || 1.0) *
                (currentEvent?.type === 'festival' ? 1.5 : 1) *
                (weather.demandBonus[item.name] || 1);
              const price = Math.floor(
                (recipe.sellValue || recipe.baseGold) *
                  towns.find((t) => t.name === currentTown).rewardMultiplier *
                  demandMultiplier
              );
              return (
                <View style={styles.marketItem}>
                  <Image
                    source={itemImages[item.name.toLowerCase().replace(' ', '-')] || itemImages.default}
                    style={styles.itemImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.marketText}>
                    {item.name}: {price} Gold
                  </Text>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => sellDrink(item.name)}
                  >
                    <Text style={styles.buttonText}>Sell</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
            style={styles.marketList}
          />
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('market')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Gather Modal */}
      <Modal
        isVisible={modals.gather}
        onBackdropPress={() => toggleModal('gather')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="leaf" size={20} color="#ff6200" /> Gather in {currentTown}
          </Text>
          <TouchableOpacity style={styles.modalButton} onPress={gatherSingle}>
            <Text style={styles.buttonText}>Gather Once (Free)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => queueGathers(5)}
          >
            <Text style={styles.buttonText}>Queue 5 Gathers (5 Gold)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => queueGathers(10)}
          >
            <Text style={styles.buttonText}>Queue 10 Gathers (10 Gold)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('gather')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Combat Modal */}
      <Modal
        isVisible={modals.combat}
        onBackdropPress={() => toggleModal('combat')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="skull" size={20} color="#ff6200" /> Combat
          </Text>
          {combatState && (
            <>
              <View style={styles.combatContainer}>
                <View style={styles.combatSide}>
                  <Text style={styles.combatText}>
                    Kaito: {combatState.playerHealth}/{player.max_health}
                  </Text>
                  <Image
                    source={avatarImages[player.avatar] || avatarImages.default}
                    style={styles.combatImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.combatSide}>
                  <Text style={styles.combatText}>
                    {combatState.enemy.name}: {combatState.enemyHealth}/
                    {combatState.enemy.health}
                  </Text>
                  <Image
                    source={enemyImages[combatState.enemy.name.toLowerCase().replace(' ', '-')]}
                    style={styles.combatImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
              <FlatList
                data={combatState.log.slice(-3)}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <Text style={styles.combatLog}>{item}</Text>
                )}
                style={styles.combatLogList}
              />
              {combatResult ? (
                <Text style={styles.combatResult}>{combatResult.message}</Text>
              ) : (
                <>
                  <FlatList
                    data={player.skills}
                    keyExtractor={(skill) => skill.name}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalButton}
                        onPress={() => attackEnemy(item.name)}
                        disabled={combatState.isAttacking}
                      >
                        <Text style={styles.buttonText}>
                          Use {item.name} (Lv {item.level})
                        </Text>
                      </TouchableOpacity>
                    )}
                    style={styles.skillList}
                  />
                  {combatState.playerHealth <= 0 && (
                    <FlatList
                      data={player.recipes.filter((r) => r.type === 'heal')}
                      keyExtractor={(item) => item.name}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.modalButton}
                          onPress={() => craftPotionInCombat(item.name)}
                          disabled={combatState.isAttacking}
                        >
                          <Text style={styles.buttonText}>
                            Craft {item.name}
                          </Text>
                        </TouchableOpacity>
                      )}
                      style={styles.potionList}
                    />
                  )}
                </>
              )}
            </>
          )}
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('combat')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Leaderboard Modal */}
      <Modal
        isVisible={modals.leaderboard}
        onBackdropPress={() => toggleModal('leaderboard')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="star" size={20} color="#ff6200" /> Leaderboard
          </Text>
          <FlatList
            data={leaderboardData}
            keyExtractor={(item) => item.wallet_address}
            renderItem={({ item, index }) => (
              <View style={styles.leaderboardItem}>
                <Text style={styles.leaderboardText}>
                  {index + 1}. {item.name} (Lv {item.level}, {item.gold} Gold)
                </Text>
              </View>
            )}
            style={styles.leaderboardList}
          />
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('leaderboard')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Quests Modal */}
      <Modal
        isVisible={modals.quests}
        onBackdropPress={() => toggleModal('quests')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="scroll" size={20} color="#ff6200" /> Active Quests
          </Text>
          <FlatList
            data={player.quests}
            keyExtractor={(quest) => quest.id}
            renderItem={({ item }) => (
              <View style={styles.questItem}>
                <Text style={styles.questText}>
                  {item.description} ({item.progress}/{item.target})
                </Text>
                <Text style={styles.questReward}>
                  Reward: {item.reward.gold} Gold, {item.reward.xp} XP
                </Text>
                {item.progress >= item.target && (
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => completeQuest(item.id)}
                  >
                    <Text style={styles.buttonText}>Complete</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            style={styles.questList}
          />
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('quests')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Daily Tasks Modal */}
      <Modal
        isVisible={modals.daily}
        onBackdropPress={() => toggleModal('daily')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="calendar-day" size={20} color="#ff6200" /> Daily Tasks
          </Text>
          <FlatList
            data={player.daily_tasks}
            keyExtractor={(task) => task.id}
            renderItem={({ item }) => (
              <View style={styles.taskItem}>
                <Text style={styles.taskText}>
                  {item.description} ({item.progress}/{item.target})
                </Text>
                <Text style={styles.taskReward}>
                  Reward: {item.reward.gold} Gold, {item.reward.xp} XP
                </Text>
                {item.progress >= item.target && !item.completed && (
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => completeDailyTask(item.id)}
                  >
                    <Text style={styles.buttonText}>Complete</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            style={styles.taskList}
          />
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('daily')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Stats Modal */}
      <Modal
        isVisible={modals.stats}
        onBackdropPress={() => toggleModal('stats')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="chart-bar" size={20} color="#ff6200" /> Player Stats
          </Text>
          <Text style={styles.statText}>
            Enemies Defeated: {player.stats.enemiesDefeated}
          </Text>
          <Text style={styles.statText}>
            Potions Crafted: {player.stats.potionsCrafted}
          </Text>
          <Text style={styles.statText}>
            Items Sold: {player.stats.itemsSold}
          </Text>
          <Text style={styles.statText}>Gathers: {player.stats.gathers}</Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('stats')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Community Modal */}
      <Modal
        isVisible={modals.community}
        onBackdropPress={() => toggleModal('community')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="users" size={20} color="#ff6200" /> Community Event
          </Text>
          <Text style={styles.eventText}>
            {mockCommunityEvent().description}
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={mockCommunityEvent().action}
          >
            <Text style={styles.buttonText}>Contribute 50 Gold</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('community')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Customize Modal */}
      <Modal
        isVisible={modals.customize}
        onBackdropPress={() => toggleModal('customize')}
        style={styles.modal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContent}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalInner}>
              <Text style={styles.modalTitle}>
                <Icon name="user-edit" size={20} color="#ff6200" /> Customize Character
              </Text>
              <TextInput
                style={styles.input}
                value={customName}
                onChangeText={setCustomName}
                placeholder="Enter Name"
                placeholderTextColor="#888"
              />
              <Picker
                selectedValue={customAvatar}
                onValueChange={(value) => setCustomAvatar(value)}
                style={styles.picker}
              >
                {Object.keys(avatarImages).map((avatar) => (
                  <Picker.Item key={avatar} label={avatar} value={avatar} />
                ))}
              </Picker>
              <Picker
                selectedValue={customTrait}
                onValueChange={(value) => setCustomTrait(value)}
                style={styles.picker}
              >
                <Picker.Item label="None" value={null} />
                <Picker.Item label="Warrior" value="warrior" />
                <Picker.Item label="Craftsman" value="craftsman" />
                <Picker.Item label="Explorer" value="explorer" />
              </Picker>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={customizeCharacter}
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => toggleModal('customize')}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* NPC Modal */}
      <Modal
        isVisible={modals.npc}
        onBackdropPress={() => toggleModal('npc')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="comment" size={20} color="#ff6200" /> NPCs in {currentTown}
          </Text>
          <FlatList
            data={towns.find((t) => t.name === currentTown).npcs}
            keyExtractor={(npc) => npc.name}
            renderItem={({ item }) => (
              <View style={styles.npcItem}>
                <Text style={styles.npcText}>{item.name}</Text>
                <Text style={styles.npcDialogue}>{item.dialogue}</Text>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => {
                    setSelectedNPC(item);
                    addQuest(item.quest);
                    toggleModal('npc');
                  }}
                >
                  <Text style={styles.buttonText}>Accept Quest</Text>
                </TouchableOpacity>
              </View>
            )}
            style={styles.npcList}
          />
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('npc')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Travel Modal */}
      <Modal
        isVisible={modals.travel}
        onBackdropPress={() => toggleModal('travel')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="map-signs" size={20} color="#ff6200" /> Travel
          </Text>
          {travelDestination ? (
            <View style={styles.travelLoading}>
              <ActivityIndicator size="large" color="#ff6200" />
              <Text style={styles.travelText}>
                Traveling to {travelDestination}...
              </Text>
            </View>
          ) : (
            <FlatList
              data={towns.filter((t) => t.name !== currentTown)}
              keyExtractor={(town) => town.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => travel(item.name)}
                >
                  <Text style={styles.buttonText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              style={styles.travelList}
            />
          )}
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('travel')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Skills Modal */}
      <Modal
        isVisible={modals.skills}
        onBackdropPress={() => toggleModal('skills')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="bolt" size={20} color="#ff6200" /> Skills
          </Text>
          {Object.keys(skillTrees).map((tree) => (
            <View key={tree} style={styles.skillTree}>
              <Text style={styles.skillTreeTitle}>{tree}</Text>
              <FlatList
                data={skillTrees[tree]}
                keyExtractor={(skill) => skill.name}
                renderItem={({ item }) => {
                  const isUnlocked = player.skills.some((s) => s.name === item.name);
                  return (
                    <View style={styles.skillItem}>
                      <Text style={styles.skillText}>
                        {item.name} (Cost: {item.cost.gold} Gold)
                      </Text>
                      {isUnlocked ? (
                        <Text style={styles.skillLevel}>
                          Level {player.skills.find((s) => s.name === item.name).level}
                        </Text>
                      ) : (
                        <TouchableOpacity
                          style={styles.smallButton}
                          onPress={() => unlockSkill(item.name, tree)}
                        >
                          <Text style={styles.buttonText}>Unlock</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
                style={styles.skillList}
              />
            </View>
          ))}
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('skills')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Events Modal */}
      <Modal
        isVisible={modals.events}
        onBackdropPress={() => toggleModal('events')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="calendar-alt" size={20} color="#ff6200" /> Current Events
          </Text>
          {currentEvent ? (
            <View style={styles.eventItem}>
              <Text style={styles.eventText}>{currentEvent.description}</Text>
              <Text style={styles.eventTimer}>
                {formatCountdown(
                  Math.max(0, Math.floor((eventTimer - Date.now()) / 1000))
                )}
              </Text>
            </View>
          ) : (
            <Text style={styles.eventText}>No active events.</Text>
          )}
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('events')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Guild Modal */}
      <Modal
        isVisible={modals.guild}
        onBackdropPress={() => toggleModal('guild')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="shield-alt" size={20} color="#ff6200" /> Guild
          </Text>
          {player.guild ? (
            <>
              <Text style={styles.guildText}>
                Guild: {player.guild.name}
              </Text>
              <Text style={styles.guildProgress}>
                Progress: {player.guild.progress}/{player.guild.target}
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={contributeToGuild}
              >
                <Text style={styles.buttonText}>Contribute 10 Gold</Text>
              </TouchableOpacity>
            </>
          ) : (
            <FlatList
              data={['Brewers Guild', 'Warriors Guild', 'Explorers Guild']}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => joinGuild(item)}
                >
                  <Text style={styles.buttonText}>Join {item}</Text>
                </TouchableOpacity>
              )}
              style={styles.guildList}
            />
          )}
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('guild')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Guide Modal */}
      <Modal
        isVisible={modals.guide}
        onBackdropPress={() => toggleModal('guide')}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            <Icon name="book" size={20} color="#ff6200" /> Game Guide
          </Text>
          <Text style={styles.guideText}>
            Welcome to Kaito's Adventure! Gather ingredients, craft potions, fight enemies, and complete quests to level up. Connect your wallet to save progress.
          </Text>
          <Text style={styles.guideText}>
            - Gather: Collect ingredients in towns.
            - Craft: Combine ingredients to make potions or equipment.
            - Combat: Fight enemies to earn gold and XP.
            - Quests: Complete tasks for rewards.
            - Market: Buy ingredients and sell crafted items.
            - Travel: Visit different towns for unique resources.
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => toggleModal('guide')}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );

  // ---- Main Render ----
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <FlatList
          data={renderData}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
        />
        {renderModals()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default KaitoAdventureScreen;