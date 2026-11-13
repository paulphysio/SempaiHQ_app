import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../services/supabaseClient';

/**
 * Hook to track reading time for a chapter
 * Persists across app sessions and logs
 */
export const useReadingTimer = (userId, novelId, chapterId) => {
  const [sessionId, setSessionId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const appState = useRef(AppState.currentState);
  const intervalRef = useRef(null);
  // Refs mirror session state so endSession stays referentially stable —
  // otherwise the mount effect below re-runs on every session state change
  // and creates/ends sessions in a loop.
  const sessionIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const trackingRef = useRef(false);

  // Start or resume a reading session
  const startSession = useCallback(async () => {
    if (!userId || !novelId || !chapterId) return;
    if (trackingRef.current) return; // already tracking — don't double-start

    try {
      // Check for existing active session
      const { data: existingSession } = await supabase
        .from('reading_time_sessions')
        .select('id, started_at')
        .eq('user_id', userId)
        .eq('novel_id', novelId)
        .eq('chapter_id', parseInt(chapterId, 10))
        .eq('is_active', true)
        .single();

      if (existingSession) {
        // Resume existing session
        sessionIdRef.current = existingSession.id;
        startTimeRef.current = new Date(existingSession.started_at);
        trackingRef.current = true;
        setSessionId(existingSession.id);
        setStartTime(new Date(existingSession.started_at));
        setIsTracking(true);
        if (__DEV__) console.log('[ReadingTimer] Resumed session:', existingSession.id);
        return;
      }

      // Create new session
      const { data: newSession, error } = await supabase
        .from('reading_time_sessions')
        .insert({
          user_id: userId,
          novel_id: novelId,
          chapter_id: parseInt(chapterId, 10),
          is_active: true,
        })
        .select('id, started_at')
        .single();

      if (error) throw error;

      sessionIdRef.current = newSession.id;
      startTimeRef.current = new Date(newSession.started_at);
      trackingRef.current = true;
      setSessionId(newSession.id);
      setStartTime(new Date(newSession.started_at));
      setIsTracking(true);
      if (__DEV__) console.log('[ReadingTimer] Started new session:', newSession.id);
    } catch (error) {
      console.error('[ReadingTimer] Error starting session:', error);
    }
  }, [userId, novelId, chapterId]);

  // End the current reading session
  const endSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    const st = startTimeRef.current;
    if (!sid || !st) return;

    try {
      const endTime = new Date();
      const durationSeconds = Math.floor((endTime - st) / 1000);

      // Only save if session lasted at least 5 seconds
      if (durationSeconds < 5) {
        if (__DEV__) console.log('[ReadingTimer] Session too short, discarding');
        // Delete the session if it was too short
        await supabase
          .from('reading_time_sessions')
          .delete()
          .eq('id', sid);
      } else {
        const { error } = await supabase
          .from('reading_time_sessions')
          .update({
            ended_at: endTime.toISOString(),
            duration_seconds: durationSeconds,
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sid);

        if (error) throw error;

        if (__DEV__) console.log('[ReadingTimer] Ended session:', sid, 'Duration:', durationSeconds, 'seconds');
      }
    } catch (error) {
      console.error('[ReadingTimer] Error ending session:', error);
    } finally {
      sessionIdRef.current = null;
      startTimeRef.current = null;
      trackingRef.current = false;
      setSessionId(null);
      setStartTime(null);
      setIsTracking(false);
    }
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - resume tracking
        if (__DEV__) console.log('[ReadingTimer] App resumed, continuing session');
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App went to background - pause tracking
        if (__DEV__) console.log('[ReadingTimer] App backgrounded, pausing session');
        // Don't end session, just let it continue
        // The duration will include background time, which is acceptable
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Start session on mount, end on unmount
  useEffect(() => {
    if (userId && novelId && chapterId) {
      startSession();
    }

    return () => {
      endSession();
    };
  }, [userId, novelId, chapterId, startSession, endSession]);

  // Get current session duration
  const getCurrentDuration = useCallback(() => {
    if (!startTime) return 0;
    return Math.floor((new Date() - startTime) / 1000);
  }, [startTime]);

  return {
    isTracking,
    sessionId,
    startSession,
    endSession,
    getCurrentDuration,
  };
};

/**
 * Get total reading time for a user
 */
export const getUserReadingTime = async (userId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_reading_time', { p_user_id: userId });

    if (error) throw error;

    return data?.[0] || {
      total_seconds: 0,
      total_chapters: 0,
      total_novels: 0,
      last_read_at: null,
    };
  } catch (error) {
    console.error('[ReadingTimer] Error getting user reading time:', error);
    return {
      total_seconds: 0,
      total_chapters: 0,
      total_novels: 0,
      last_read_at: null,
    };
  }
};

/**
 * Format seconds into human-readable time
 */
export const formatReadingTime = (seconds) => {
  if (!seconds || seconds === 0) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};
