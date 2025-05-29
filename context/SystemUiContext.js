import { createContext, useContext } from 'react';

export const SystemUiContext = createContext();

export const useSystemUi = () => {
  const context = useContext(SystemUiContext);
  if (context === undefined) {
    throw new Error('useSystemUi must be used within a SystemUiProvider');
  }
  return context;
}; 