'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { activeTab } = useAppStore();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main 
        className="flex-1 flex flex-col min-w-0"
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
          className="flex-1 p-8 overflow-auto custom-scrollbar focus-within:outline-none"
          tabIndex={-1}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
} 