import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE_URL = 'https://sempaihq.com/api';

const DEVICE_STORAGE_KEY = 'porp_device_hash';

/**
 * Generate or retrieve device hash for session tracking
 */
const getDeviceHash = async () => {
  try {
    let deviceHash = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
    
    if (!deviceHash) {
      // Generate a simple device hash based on platform and random string
      const platform = Platform.OS;
      const randomStr = Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now().toString();
      deviceHash = `${platform}-${randomStr}-${timestamp}`.substring(0, 64);
      await AsyncStorage.setItem(DEVICE_STORAGE_KEY, deviceHash);
    }
    
    return deviceHash;
  } catch (error) {
    console.error('[ReadingTracker] Error getting device hash:', error);
    return 'unknown-device';
  }
};

/**
 * Calculate entropy score from scroll patterns and timing
 * Higher entropy = more natural reading behavior
 */
const calculateEntropyScore = (scrollEvents, timeOnPage) => {
  try {
    if (!scrollEvents || scrollEvents.length < 2) return 0.5;
    
    // Calculate scroll velocity variance
    const velocities = [];
    for (let i = 1; i < scrollEvents.length; i++) {
      const velocity = Math.abs(scrollEvents[i].offset - scrollEvents[i-1].offset) / 
                      (scrollEvents[i].timestamp - scrollEvents[i-1].timestamp);
      velocities.push(velocity);
    }
    
    const meanVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const variance = velocities.reduce((a, b) => a + Math.pow(b - meanVelocity, 2), 0) / velocities.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize entropy score (0-1)
    // Higher standard deviation in scroll velocity = more natural = higher entropy
    const normalizedEntropy = Math.min(stdDev / 100, 1.0);
    
    // Adjust for time on page (too fast = suspicious, too slow = suspicious)
    const optimalTime = 300; // 5 minutes optimal
    const timeScore = 1 - Math.abs(timeOnPage - optimalTime) / optimalTime;
    
    // Combine scores
    const finalScore = (normalizedEntropy * 0.7) + (timeScore * 0.3);
    
    return Math.max(0, Math.min(1, finalScore));
  } catch (error) {
    console.error('[ReadingTracker] Error calculating entropy:', error);
    return 0.5;
  }
};

/**
 * Start a new reading session
 */
export const startReadingSession = async (userId, novelId, chapterNumber) => {
  try {
    const deviceHash = await getDeviceHash();
    
    const response = await fetch(`${API_BASE_URL}/porp/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        novelId,
        chapterNumber,
        deviceHash
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('[ReadingTracker] Started session:', data.id);
    return data;
  } catch (error) {
    console.error('[ReadingTracker] Error starting session:', error);
    throw error;
  }
};

/**
 * Update reading session with scroll events and timing
 */
export const updateReadingSession = async (sessionId, scrollEvents, timeOnPage) => {
  try {
    const entropyScore = calculateEntropyScore(scrollEvents, timeOnPage);
    
    const response = await fetch(`${API_BASE_URL}/porp/session/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        scrollEvents,
        timeOnPage,
        entropyScore
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[ReadingTracker] Error updating session:', error);
    throw error;
  }
};

/**
 * Complete a reading session and generate receipt
 */
export const completeReadingSession = async (sessionId, pagesRead, timeOnPages) => {
  try {
    const response = await fetch(`${API_BASE_URL}/porp/session/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        pagesRead,
        timeOnPages
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const receipt = await response.json();
    console.log('[ReadingTracker] Completed session:', sessionId, 'Receipt:', receipt.id);
    return receipt;
  } catch (error) {
    console.error('[ReadingTracker] Error completing session:', error);
    throw error;
  }
};

/**
 * Get user reputation
 */
export const getUserReputation = async (userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/porp/reputation/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          total_pages_read: 0,
          total_reading_time_seconds: 0,
          reputation_score: 0,
          current_tier: 'seed',
          reward_multiplier: 1.0
        };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[ReadingTracker] Error getting reputation:', error);
    return {
      total_pages_read: 0,
      total_reading_time_seconds: 0,
      reputation_score: 0,
      current_tier: 'seed',
      reward_multiplier: 1.0
    };
  }
};

/**
 * Get active reading session for user
 */
export const getActiveSession = async (userId, novelId, chapterNumber) => {
  try {
    const response = await fetch(`${API_BASE_URL}/porp/session/active?userId=${userId}&novelId=${novelId}&chapterNumber=${chapterNumber}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[ReadingTracker] Error getting active session:', error);
    return null;
  }
};

/**
 * Flag session for review (suspicious activity)
 */
export const flagSession = async (sessionId, reason) => {
  try {
    const response = await fetch(`${API_BASE_URL}/porp/session/flag`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        reason
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('[ReadingTracker] Flagged session:', sessionId, 'Reason:', reason);
  } catch (error) {
    console.error('[ReadingTracker] Error flagging session:', error);
    throw error;
  }
};

export default {
  startReadingSession,
  updateReadingSession,
  completeReadingSession,
  getUserReputation,
  getActiveSession,
  flagSession
};
