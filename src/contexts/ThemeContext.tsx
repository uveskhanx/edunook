import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { DbService } from '@/lib/db-service';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, dbUser } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('edunook-theme');
      return (saved as Theme) || 'dark';
    }
    return 'dark';
  });

  // Sync theme from DB on load
  useEffect(() => {
    if (dbUser?.preferences?.app?.theme) {
      setThemeState(dbUser.preferences.app.theme);
      localStorage.setItem('edunook-theme', dbUser.preferences.app.theme);
    }
  }, [dbUser]);

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-theme', theme);
    // Also toggle standard Tailwind 'dark' class if needed
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('edunook-theme', theme);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    if (user) {
      try {
        await DbService.updatePreferences(user.id, {
          app: {
            ...(dbUser?.preferences?.app || { darkMode: true, reduceAnimations: false, dataSaver: false }),
            theme: newTheme,
            darkMode: newTheme === 'dark'
          }
        });
      } catch (err) {
        console.error('Failed to sync theme to DB:', err);
      }
    }
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
