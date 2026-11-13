import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { resumeMatch } from './kaijiApi';
import { isOpen, viewOf, shortAddr } from './kaijiMapping';

const TOURNEY_KEY = 'kaiji_tourney_v1';

/** Tourney mode calls this when a player enters / finishes, so wallet changes can be blocked in between. */
export async function markTourneyActive(active) {
  try {
    if (active) await SecureStore.setItemAsync(TOURNEY_KEY, '1');
    else await SecureStore.deleteItemAsync(TOURNEY_KEY);
  } catch (e) {
    // non-fatal
  }
}

/**
 * Call before the user disconnects, restores, imports or creates a wallet.
 * - open tournament: blocked (prizes and card trades are tied to the entry wallet)
 * - open single match: warns (the payout goes to the wallet that made the deposit)
 * Resolves true when it is fine to go ahead.
 */
export async function confirmWalletChange() {
  try {
    if (await SecureStore.getItemAsync(TOURNEY_KEY)) {
      Alert.alert(
        'Tournament in progress',
        'You cannot switch wallets until your tournament ends. Prizes and card trades are tied to the wallet you entered with.',
        [{ text: 'OK' }]
      );
      return false;
    }
    const s = await resumeMatch();
    if (s && isOpen(s.match)) {
      const payoutWallet = shortAddr(viewOf(s.match, s.side).myWallet);
      return await new Promise((resolve) =>
        Alert.alert(
          'Match in progress',
          `A Kaiji match is open. Its payout goes to the wallet that made the deposit (${payoutWallet}). If you switch now you may not be able to collect it.`,
          [
            { text: 'Keep my wallet', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Switch anyway', style: 'destructive', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        )
      );
    }
  } catch (e) {
    // if the check itself fails, do not trap the user
  }
  return true;
}
