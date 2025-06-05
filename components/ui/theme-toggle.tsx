'use client';

import { motion } from 'framer-motion';
import { Palette, Sparkles } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { isNeumorphismEnabled, toggleNeumorphism } = useAppStore();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative"
    >
      <button
        onClick={toggleNeumorphism}
        className={cn(
          'group relative w-full p-4 rounded-xl text-left transition-all duration-300',
          'flex items-center gap-4',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
          'overflow-hidden',
          isNeumorphismEnabled
            ? 'neuro-button-active bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/20'
            : 'card-flat text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
        aria-checked={isNeumorphismEnabled}
        aria-label={`${isNeumorphismEnabled ? 'Disable' : 'Enable'} neumorphism theme`}
        role="switch"
      >
        {/* Background gradient overlay for neumorphism mode */}
        {isNeumorphismEnabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/5 pointer-events-none"
          />
        )}

        {/* Icon container */}
        <div className={cn(
          'relative p-2.5 rounded-lg transition-all duration-300 flex-shrink-0 z-10',
          isNeumorphismEnabled
            ? 'neuro-icon-active bg-gradient-to-br from-white/20 to-white/10 text-white shadow-lg'
            : 'bg-sidebar-accent/50 text-sidebar-foreground/70 group-hover:bg-sidebar-accent group-hover:text-sidebar-foreground'
        )}>
          <motion.div
            animate={{ 
              rotate: isNeumorphismEnabled ? 360 : 0,
              scale: isNeumorphismEnabled ? 1.1 : 1
            }}
            transition={{ 
              duration: 0.5, 
              ease: [0.4, 0, 0.2, 1],
              rotate: { duration: 0.8 }
            }}
          >
            {isNeumorphismEnabled ? (
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Palette className="w-5 h-5" aria-hidden="true" />
            )}
          </motion.div>

          {/* Glow effect for active state */}
          {isNeumorphismEnabled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.6, scale: 1.2 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ 
                duration: 1.8,
                repeat: Infinity,
                repeatType: "reverse",
                ease: [0.4, 0, 0.6, 1]
              }}
              className="absolute inset-0 bg-white/30 rounded-lg blur-sm pointer-events-none"
            />
          )}
        </div>
        
        {/* Text content */}
        <div className="flex-1 min-w-0 relative z-10">
          <motion.div 
            className={cn(
              "font-medium text-sm leading-tight transition-colors duration-300",
              isNeumorphismEnabled ? "text-white" : ""
            )}
            animate={{ 
              letterSpacing: isNeumorphismEnabled ? "-0.02em" : "0em"
            }}
            transition={{ duration: 0.3 }}
          >
            {isNeumorphismEnabled ? 'Neumorphism Active' : 'Enable Neumorphism'}
          </motion.div>
          <motion.div 
            className={cn(
              "text-xs opacity-80 truncate mt-0.5 transition-colors duration-300",
              isNeumorphismEnabled ? "text-white/80" : ""
            )}
            animate={{ 
              opacity: isNeumorphismEnabled ? 0.9 : 0.8
            }}
            transition={{ duration: 0.3 }}
          >
            {isNeumorphismEnabled 
              ? 'Luxury glass design active' 
              : 'Switch to glass morphism'
            }
          </motion.div>
        </div>

        {/* Toggle indicator */}
        <div className={cn(
          "relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 z-10",
          isNeumorphismEnabled
            ? "bg-gradient-to-r from-white/30 to-white/20 border border-white/30"
            : "bg-sidebar-accent border border-sidebar-border"
        )}>
          <motion.div
            className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300",
              isNeumorphismEnabled
                ? "bg-white shadow-lg shadow-white/25"
                : "bg-sidebar-foreground/60"
            )}
            animate={{ 
              x: isNeumorphismEnabled ? 24 : 2,
              scale: isNeumorphismEnabled ? 1.1 : 1
            }}
            transition={{ 
              type: "spring", 
              stiffness: 500, 
              damping: 30 
            }}
          />
          
          {/* Glow effect for toggle */}
          {isNeumorphismEnabled && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/20 rounded-full blur-sm"
            />
          )}
        </div>
      </button>
    </motion.div>
  );
} 