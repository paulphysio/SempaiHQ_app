import React, { createContext, useContext, useCallback } from 'react';

const NavigationContext = createContext();

export const NavigationProvider = ({ children }) => {
  const handleWelcomeComplete = useCallback(() => {
    // The actual implementation will be provided by the AppContent component
    // through the useNavigationHandler hook
  }, []);

  return (
    <NavigationContext.Provider value={{ handleWelcomeComplete }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigationHandler = (handler) => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationHandler must be used within a NavigationProvider');
  }
  
  // Override the handleWelcomeComplete implementation
  context.handleWelcomeComplete = handler;
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}; 