'use client';

import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

// Import window functions for Tauri v1 (using allowlist)
let appWindow: any = null;

if (typeof window !== 'undefined') {
  import('@tauri-apps/api/window').then(({ appWindow: window }) => {
    appWindow = window;
  });
}

interface CustomTitlebarProps {
  title?: string;
  className?: string;
}

export function CustomTitlebar({ title = "SecureGen", className }: CustomTitlebarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const { isNeumorphismEnabled } = useAppStore();

  useEffect(() => {
    // Check if window is maximized on mount
    if (appWindow) {
      appWindow.isMaximized().then(setIsMaximized).catch(() => {});
    }
  }, []);

  const handleMinimize = async () => {
    if (appWindow) {
      try {
        await appWindow.minimize();
      } catch (error) {
        console.error('Failed to minimize window:', error);
      }
    }
  };

  const handleMaximizeToggle = async () => {
    if (appWindow) {
      try {
        await appWindow.toggleMaximize();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        console.error('Failed to toggle maximize:', error);
      }
    }
  };

  const handleClose = async () => {
    if (appWindow) {
      try {
        // Hide to tray instead of closing
        await appWindow.hide();
      } catch (error) {
        console.error('Failed to hide window:', error);
      }
    }
  };

  const handleDoubleClick = async () => {
    if (appWindow) {
      try {
        await appWindow.toggleMaximize();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        console.error('Failed to toggle maximize on double click:', error);
      }
    }
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    // Only start dragging on left mouse button and if not clicking on buttons
    if (e.button === 0 && !(e.target as Element).closest('button')) {
      if (appWindow) {
        try {
          if (e.detail === 2) {
            // Double click - toggle maximize
            await handleDoubleClick();
          } else {
            // Single click - start dragging
            await appWindow.startDragging();
          }
        } catch (error) {
          console.error('Failed to handle mouse interaction:', error);
        }
      }
    }
  };

  return (
    <div 
      className={cn(
        "titlebar flex items-center justify-between h-10 select-none relative z-50",
        isNeumorphismEnabled 
          ? "bg-gradient-to-r from-gray-900/98 via-black/98 to-gray-800/98 border-b border-gray-700/30" 
          : "bg-background/98 backdrop-blur-sm border-b border-border/40 bg-gradient-to-r from-card/95 via-background/95 to-card/95",
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Left section - App branding */}
      <div className="flex items-center gap-3 px-4">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium tracking-tight",
            isNeumorphismEnabled 
              ? "text-gray-200" 
              : "text-foreground/90"
          )}>
            {title}
          </span>
        </div>
      </div>

      {/* Center section - Could be used for additional info */}
      <div className="flex-1 flex items-center justify-center">
        {/* Optional: Add breadcrumb or current view indicator */}
      </div>

      {/* Right section - Window controls */}
      <div className="titlebar-controls flex items-center">
        {/* Minimize Button */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "titlebar-button h-10 w-12 border-0 p-0 flex items-center justify-center group",
            isNeumorphismEnabled ? "text-gray-300" : "text-muted-foreground"
          )}
          onClick={handleMinimize}
          aria-label="Minimize window"
        >
          <Minus className={cn(
            "w-4 h-4 transition-colors",
            isNeumorphismEnabled 
              ? "group-hover:text-white" 
              : "group-hover:text-foreground"
          )} />
        </Button>

        {/* Maximize/Restore Button */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "titlebar-button h-10 w-12 border-0 p-0 flex items-center justify-center group",
            isNeumorphismEnabled ? "text-gray-300" : "text-muted-foreground"
          )}
          onClick={handleMaximizeToggle}
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
        >
          {isMaximized ? (
            <Copy className={cn(
              "w-3.5 h-3.5 transition-colors",
              isNeumorphismEnabled 
                ? "group-hover:text-white" 
                : "group-hover:text-foreground"
            )} />
          ) : (
            <Square className={cn(
              "w-3.5 h-3.5 transition-colors",
              isNeumorphismEnabled 
                ? "group-hover:text-white" 
                : "group-hover:text-foreground"
            )} />
          )}
        </Button>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "titlebar-button close h-10 w-12 border-0 p-0 flex items-center justify-center group",
            isNeumorphismEnabled ? "text-gray-300" : "text-muted-foreground"
          )}
          onClick={handleClose}
          aria-label="Hide to system tray"
        >
          <X className={cn(
            "w-4 h-4 transition-colors",
            isNeumorphismEnabled 
              ? "group-hover:text-white" 
              : "group-hover:text-destructive"
          )} />
        </Button>
      </div>
    </div>
  );
} 