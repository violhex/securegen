'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { activeTab, isNeumorphismEnabled } = useAppStore();

  return (
    <div className={cn(
      "flex h-screen overflow-hidden transition-all duration-500",
      isNeumorphismEnabled 
        ? "bg-gradient-to-br from-gray-900 via-black to-gray-800" 
        : "bg-background"
    )}>
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-500",
          isNeumorphismEnabled ? "bg-transparent" : ""
        )}
        role="main"
        aria-label="Main content"
      >
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{
            duration: 0.2,
            ease: [0.4, 0, 0.2, 1],
          }}
          className={cn(
            "flex-1 p-8 overflow-auto custom-scrollbar focus-within:outline-none transition-all duration-500",
            isNeumorphismEnabled ? "text-white" : ""
          )}
          tabIndex={-1}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
} 