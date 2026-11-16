import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes } from '../theme/tokens';
import { setBaseTextColor } from '../utils/fontScale';

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

  // Palettes live in theme/tokens.js (single source of truth). They are
  // module constants, so `colors` keeps a stable identity between renders.
  const colors = isDark ? palettes.dark : palettes.light;

  // Unstyled / colourless <Text> follows the theme (see utils/fontScale.js).
  setBaseTextColor(colors.textPrimary);

  const value = useMemo(
    () => ({ isDark, colors, toggleTheme, setTheme }),
    // toggleTheme/setTheme only close over isDark and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDark, colors]
  );

  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;