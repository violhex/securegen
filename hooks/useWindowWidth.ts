import { useState, useEffect } from 'react';

export function useWindowWidth(): number {
  const [windowWidth, setWindowWidth] = useState<number>(() => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    // Default width for SSR
    return 1024;
  });

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial value
    setWindowWidth(window.innerWidth);

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return windowWidth;
} 