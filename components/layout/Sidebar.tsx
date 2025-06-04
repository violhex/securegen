'use client';

import { motion } from 'framer-motion';
import { 
  Key, 
  Shield, 
  User, 
  History, 
  Settings,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import type { GeneratorType } from '@/types';

const navigationItems = [
  {
    id: 'password' as GeneratorType,
    label: 'Password Generator',
    icon: Key,
    description: 'Generate secure passwords',
  },
  {
    id: 'passphrase' as GeneratorType,
    label: 'Passphrase Generator',
    icon: Shield,
    description: 'Create memorable passphrases',
  },
  {
    id: 'username' as GeneratorType,
    label: 'Username Generator',
    icon: User,
    description: 'Generate unique usernames',
  },
  {
    id: 'history' as GeneratorType,
    label: 'Generation History',
    icon: History,
    description: 'View recent generations',
  },
  {
    id: 'settings' as GeneratorType,
    label: 'Settings',
    icon: Settings,
    description: 'Configure preferences',
  },
];

export function Sidebar() {
  const { activeTab, setActiveTab, isNeumorphismEnabled } = useAppStore();

  return (
    <aside 
      className={cn(
        "w-80 h-full border-r flex flex-col transition-all duration-500",
        isNeumorphismEnabled 
          ? "frosted-glass border-white/10" 
          : "bg-sidebar border-sidebar-border"
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Branding */}
      <header className={cn(
        "p-6 border-b transition-colors duration-500",
        isNeumorphismEnabled ? "border-white/10" : "border-sidebar-border"
      )}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="flex items-center gap-3"
        >
          <div className={cn(
            "p-3 rounded-xl transition-all duration-500",
            isNeumorphismEnabled 
              ? "neuro-button bg-gradient-to-br from-white/20 to-white/10 text-white" 
              : "card-elevated bg-primary text-primary-foreground"
          )}>
            <Sparkles className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className={cn(
              "text-xl font-semibold tracking-tight transition-colors duration-500",
              "font-sans",
              isNeumorphismEnabled ? "text-white" : "text-sidebar-foreground"
            )} style={{ letterSpacing: '-0.02em' }}>
              SecureGen
            </h1>
            <p className={cn(
              "text-sm font-medium transition-colors duration-500",
              "font-sans",
              isNeumorphismEnabled ? "text-white/80" : "text-sidebar-foreground/70"
            )} style={{ letterSpacing: '-0.02em' }}>
              Professional Password Generator
            </p>
          </div>
        </motion.div>
      </header>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2" role="list">
        {navigationItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                duration: 0.2, 
                delay: index * 0.05,
                ease: [0.4, 0, 0.2, 1] 
              }}
              role="listitem"
            >
              <button
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full p-4 rounded-xl text-left transition-all duration-300',
                  'flex items-center gap-4 group',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                  isNeumorphismEnabled
                    ? isActive
                      ? 'neuro-button-active text-white'
                      : 'neuro-button text-white/80 hover:text-white'
                    : isActive 
                      ? 'card-elevated bg-sidebar-accent text-sidebar-accent-foreground shadow-md' 
                      : 'card-flat text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-describedby={`${item.id}-description`}
              >
                <div className={cn(
                  'p-2.5 rounded-lg transition-all duration-300 flex-shrink-0',
                  isNeumorphismEnabled
                    ? isActive
                      ? 'neuro-icon-active bg-gradient-to-br from-white/30 to-white/20 text-white'
                      : 'bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white'
                    : isActive 
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                      : 'bg-sidebar-accent/50 text-sidebar-foreground/70 group-hover:bg-sidebar-accent group-hover:text-sidebar-foreground'
                )}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "font-medium text-sm leading-tight transition-colors duration-300 font-sans",
                    isNeumorphismEnabled ? "text-white" : ""
                  )} style={{ letterSpacing: '-0.02em' }}>
                    {item.label}
                  </div>
                  <div 
                    id={`${item.id}-description`}
                    className={cn(
                      "text-xs opacity-80 truncate mt-0.5 transition-colors duration-300 font-sans",
                      isNeumorphismEnabled ? "text-white/80" : ""
                    )} style={{ letterSpacing: '-0.02em' }}
                  >
                    {item.description}
                  </div>
                </div>
              </button>
            </motion.div>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="p-4">
        <ThemeToggle />
      </div>

      {/* Footer */}
      <footer className={cn(
        "p-4 border-t transition-colors duration-500",
        isNeumorphismEnabled ? "border-white/10" : "border-sidebar-border"
      )}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="text-center space-y-1"
        >
          <p className={cn(
            "text-xs font-medium transition-colors duration-500 font-sans",
            isNeumorphismEnabled ? "text-white/70" : "text-sidebar-foreground/60"
          )} style={{ letterSpacing: '-0.02em' }}>
            Powered by Bitwarden Algorithms
          </p>
          <p className={cn(
            "text-xs transition-colors duration-500 font-sans",
            isNeumorphismEnabled ? "text-white/60" : "text-sidebar-foreground/50"
          )} style={{ letterSpacing: '-0.02em' }}>
            v0.2.0 • Built with Tauri
          </p>
          <p className={cn(
            "text-xs transition-colors duration-500 font-sans",
            isNeumorphismEnabled ? "text-white/60" : "text-sidebar-foreground/50"
          )} style={{ letterSpacing: '-0.02em' }}>
            An app by Glass
          </p>
        </motion.div>
      </footer>
    </aside>
  );
} 