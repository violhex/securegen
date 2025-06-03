/**
 * Tauri API Type Definitions
 * Provides type safety for Tauri APIs accessed through window.__TAURI__
 */

export interface TauriApp {
  getName: () => Promise<string>;
  getVersion: () => Promise<string>;
  getTauriVersion: () => Promise<string>;
  hide: () => Promise<void>;
  show: () => Promise<void>;
}

export interface TauriProcess {
  exit: (code: number) => Promise<void>;
}

export interface TauriShell {
  open: (url: string) => Promise<void>;
}

export interface TauriFs {
  readTextFile: (path: string) => Promise<string>;
  writeTextFile: (path: string, content: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  createDir: (path: string) => Promise<void>;
  removeFile: (path: string) => Promise<void>;
}

export interface TauriClipboard {
  writeText: (text: string) => Promise<void>;
  readText: () => Promise<string>;
}

export interface TauriNotification {
  sendNotification: (options: {
    title: string;
    body?: string;
    icon?: string;
  }) => Promise<void>;
}

export interface TauriOs {
  platform: () => Promise<string>;
  version: () => Promise<string>;
  arch: () => Promise<string>;
  type: () => Promise<string>;
}

export interface TauriAPI {
  app: TauriApp;
  process: TauriProcess;
  shell: TauriShell;
  fs: TauriFs;
  clipboard: TauriClipboard;
  notification: TauriNotification;
  os: TauriOs;
}

/**
 * Type-safe helper to access Tauri APIs
 * @returns Tauri API object or undefined if not available
 */
export function getTauriAPI(): TauriAPI | undefined {
  if (typeof window === 'undefined') return undefined;
  
  // Use type assertion to access the Tauri APIs
  const tauriWindow = window as unknown as { __TAURI__?: TauriAPI };
  return tauriWindow.__TAURI__;
}

/**
 * Check if running in Tauri environment
 * @returns true if Tauri APIs are available
 */
export function isTauriEnvironment(): boolean {
  return getTauriAPI() !== undefined;
}

/**
 * Type-safe access to specific Tauri API modules
 */
export const tauri = {
  get app() {
    return getTauriAPI()?.app;
  },
  get process() {
    return getTauriAPI()?.process;
  },
  get shell() {
    return getTauriAPI()?.shell;
  },
  get fs() {
    return getTauriAPI()?.fs;
  },
  get clipboard() {
    return getTauriAPI()?.clipboard;
  },
  get notification() {
    return getTauriAPI()?.notification;
  },
  get os() {
    return getTauriAPI()?.os;
  },
}; 