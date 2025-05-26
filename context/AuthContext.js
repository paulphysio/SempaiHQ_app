import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [skippedSignIn, setSkippedSignIn] = useState(false);

  useEffect(() => {
    // Check if user is already signed in or has skipped sign in
    const checkUserSession = async () => {
      try {
        const userString = await AsyncStorage.getItem('user');
        const skipped = await AsyncStorage.getItem('skippedSignIn');
        
        if (userString) {
          setUser(JSON.parse(userString));
        }
        
        if (skipped === 'true') {
          setSkippedSignIn(true);
        }
      } catch (error) {
        console.error('Error retrieving user session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserSession();
  }, []);

  const signIn = async (userData) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (error) {
      console.error('Error signing in:', error);
      return false;
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('user');
      setUser(null);
      return true;
    } catch (error) {
      console.error('Error signing out:', error);
      return false;
    }
  };

  const skipSignIn = async () => {
    try {
      await AsyncStorage.setItem('skippedSignIn', 'true');
      setSkippedSignIn(true);
      return true;
    } catch (error) {
      console.error('Error skipping sign in:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signOut,
        skipSignIn,
        isAuthenticated: !!user,
        skippedSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
