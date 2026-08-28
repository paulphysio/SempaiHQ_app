import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDark;
      setIsDark(newTheme);
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const setTheme = async (theme) => {
    try {
      const isDarkTheme = theme === 'dark';
      setIsDark(isDarkTheme);
      await AsyncStorage.setItem('theme', theme);
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  };

  // Theme colors matching web version ("Ink & Seal" dark / "Paper & Current"
  // light — see page.module.css). IMPORTANT: light mode's accent and its
  // "gold" companion are both cool tones (blue / teal) on purpose — the web
  // light theme never uses orange, so neither should this one. Only the
  // sidebar's fixed brand-orange stamp is exempt, and even that should be
  // reconsidered per-surface; this file no longer offers an orange option
  // for anything theme-driven.
  const colors = isDark
    ? {
        // Dark mode — "Ink & Seal"
        bg: '#0B0B14',
        bgElevated: '#111219',
        bgCard: '#15161F',
        bgCardAlt: '#1A1B26',
        accent: '#FF5733',
        accentDeep: '#F36316',
        accentRgb: '255, 87, 51',
        accentGlow: 'rgba(255, 87, 51, 0.35)',
        accentSoft: 'rgba(255, 87, 51, 0.12)',
        sakura: '#E94560',
        gold: '#FFD700',
        goldRgb: '255, 215, 0',
        badgeInk: '#0a0602',
        textPrimary: '#FFFFFF',
        textSecondary: '#C9C9D1',
        textMuted: '#8A8A99',
        border: 'rgba(255, 255, 255, 0.08)',
        borderAccent: 'rgba(255, 87, 51, 0.35)',
        danger: '#FF6B6B',
        overlayChip: 'rgba(11, 11, 20, 0.78)',
        bgPrimary: '#0d0d0d',
        bgSecondary: '#141414',
        inputBg: '#1a1a1a',
      }
    : {
        // Light mode — "Paper & Current". Cool blue accent, teal "gold" —
        // no orange, matching the web light theme exactly.
        bg: '#FDFBD4',
        bgElevated: '#f5f0d0',
        bgCard: '#ffffff',
        bgCardAlt: '#f8f8e8',
        accent: '#3b82f6',
        accentDeep: '#2563eb',
        accentRgb: '59, 130, 246',
        accentGlow: 'rgba(59, 130, 246, 0.35)',
        accentSoft: 'rgba(59, 130, 246, 0.12)',
        sakura: '#E94560',
        gold: '#0891b2',
        goldRgb: '8, 145, 178',
        badgeInk: '#0f2733',
        textPrimary: '#1e293b',
        textSecondary: '#475569',
        textMuted: '#64748b',
        border: 'rgba(59, 130, 246, 0.15)',
        borderAccent: 'rgba(59, 130, 246, 0.35)',
        danger: '#ef4444',
        overlayChip: 'rgba(253, 251, 212, 0.9)',
        bgPrimary: '#FDFBD4',
        bgSecondary: '#f5f0d0',
        inputBg: '#ffffff',
      };

  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;