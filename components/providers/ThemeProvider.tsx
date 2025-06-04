'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { isNeumorphismEnabled } = useAppStore();

  useEffect(() => {
    const body = document.body;
    
    if (isNeumorphismEnabled) {
      body.classList.add('neumorphism-theme', 'dark');
      body.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      body.style.letterSpacing = '-0.02em';
      body.style.fontWeight = '400';
    } else {
      body.classList.remove('neumorphism-theme');
      body.style.fontFamily = '';
      body.style.letterSpacing = '';
      body.style.fontWeight = '';
    }

    return () => {
      body.classList.remove('neumorphism-theme');
      body.style.fontFamily = '';
      body.style.letterSpacing = '';
      body.style.fontWeight = '';
    };
  }, [isNeumorphismEnabled]);

  return <>{children}</>;
} 