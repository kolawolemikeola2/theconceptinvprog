import React, { createContext, useContext, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

type AppThemeContextValue = { isDark: boolean; toggleTheme: () => void };
const AppThemeContext = createContext<AppThemeContextValue>({ isDark: false, toggleTheme: () => {} });

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const value = useMemo(() => ({ isDark, toggleTheme: () => setIsDark(current => !current) }), [isDark]);
  return <AppThemeContext.Provider value={value}><StatusBar style={isDark ? 'light' : 'dark'} /><View style={{ flex:  1, backgroundColor: isDark ? '#0B1220' : '#F7F9FB' }}>{children}</View></AppThemeContext.Provider>;
}
export function useAppTheme() { return useContext(AppThemeContext); }
export const getPalette = (dark: boolean) => dark ? {
  bg: '#0B1220', white: '#121C2D', navy: '#07101D', text: '#F2F5FA', muted: '#A4B0C0', border: '#263449', blue: '#55B8F2', blueLight: '#172B43', green: '#4DD6A0', greenLight: '#12372F', amber: '#F3C66B', amberLight: '#3B2E16', red: '#FF7A7A', soft: '#1A2638', softText: '#C6D0DE', input: '#172235'
} : {
  bg: '#F7F9FB', white: '#FFFFFF', navy: '#0E1C2F', text: '#191C1E', muted: '#75777D', border: '#E7EBF2', blue: '#006398', blueLight: '#EAF1FF', green: '#087B57', greenLight: '#E7F7EF', amber: '#996515', amberLight: '#FFF5DE', red: '#BA1A1A', soft: '#F2F4F6', softText: '#44474C', input: '#FFFFFF'
};
