/**
 * Hardware ID Generation Utility
 * Generates a consistent hardware fingerprint based on available system characteristics
 */

export interface SystemInfo {
  platform: string;
  arch?: string;
  osType?: string;
  userAgent: string;
  language: string;
  timezone: number;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  hardware: {
    concurrency: number;
  };
}

/**
 * Collect system information for hardware ID generation
 */
async function collectSystemInfo(): Promise<SystemInfo> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('Hardware ID generation requires browser environment');
  }

  const baseInfo: SystemInfo = {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: new Date().getTimezoneOffset(),
    screen: {
      width: typeof screen !== 'undefined' ? screen.width : 1920,
      height: typeof screen !== 'undefined' ? screen.height : 1080,
      colorDepth: typeof screen !== 'undefined' ? screen.colorDepth : 24,
    },
    hardware: {
      concurrency: navigator.hardwareConcurrency || 4,
    },
  };

  // Try to get additional Tauri-specific system information
  if (typeof window !== 'undefined' && (window as unknown as { __TAURI__?: { os: { platform: () => Promise<string>; arch: () => Promise<string>; type: () => Promise<string> } } }).__TAURI__) {
    try {
      const { platform, arch, type: osType } = (window as unknown as { __TAURI__: { os: { platform: () => Promise<string>; arch: () => Promise<string>; type: () => Promise<string> } } }).__TAURI__.os;
      
      const [platformInfo, archInfo, osTypeInfo] = await Promise.allSettled([
        platform(),
        arch(),
        osType(),
      ]);

      if (platformInfo.status === 'fulfilled') {
        baseInfo.platform = platformInfo.value;
      }
      if (archInfo.status === 'fulfilled') {
        baseInfo.arch = archInfo.value;
      }
      if (osTypeInfo.status === 'fulfilled') {
        baseInfo.osType = osTypeInfo.value;
      }
    } catch (error) {
      console.warn('Failed to get Tauri OS information:', error);
    }
  }

  return baseInfo;
}

/**
 * Generate a SHA-256 hash from the collected system information
 */
async function generateHash(systemInfo: SystemInfo): Promise<string> {
  try {
    // Create a deterministic string from system info
    const infoString = [
      systemInfo.platform,
      systemInfo.arch || 'unknown',
      systemInfo.osType || 'unknown',
      systemInfo.userAgent,
      systemInfo.language,
      systemInfo.timezone.toString(),
      systemInfo.screen.width.toString(),
      systemInfo.screen.height.toString(),
      systemInfo.screen.colorDepth.toString(),
      systemInfo.hardware.concurrency.toString(),
    ].join('|');

    // Generate SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(infoString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Failed to generate hash:', error);
    throw error;
  }
}

/**
 * Format a hash string into a readable hardware ID
 */
function formatHardwareId(hash: string): string {
  // Take first 16 characters and format as HWID-XXXX-XXXX-XXXX-XXXX
  const formatted = hash.substring(0, 16).toUpperCase();
  return `HWID-${formatted.substring(0, 4)}-${formatted.substring(4, 8)}-${formatted.substring(8, 12)}-${formatted.substring(12, 16)}`;
}

/**
 * Generate a fallback hardware ID when the main method fails
 */
function generateFallbackId(): string {
  try {
    // Use a combination of timestamp and deterministic values as fallback
    // This ensures no personal information is leaked
    const timestamp = Date.now().toString(16).toUpperCase().padStart(12, '0');
    const sessionId = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    
    return `HWID-${timestamp.substring(0, 4)}-${timestamp.substring(4, 8)}-${timestamp.substring(8, 12)}-${sessionId}`;
  } catch {
    // Ultimate fallback - completely generic
    return 'HWID-0000-0000-0000-0000';
  }
}

/**
 * Generate a consistent hardware ID for the current system
 * This ID should remain consistent across application sessions on the same machine
 */
export async function generateHardwareId(): Promise<string> {
  try {
    const systemInfo = await collectSystemInfo();
    const hash = await generateHash(systemInfo);
    return formatHardwareId(hash);
  } catch (error) {
    console.warn('Hardware ID generation failed, using fallback:', error);
    return generateFallbackId();
  }
}

/**
 * Get detailed system information for display purposes
 */
export async function getSystemInformation(): Promise<{
  hardwareId: string;
  platform: string;
  arch?: string;
  osType?: string;
}> {
  try {
    const systemInfo = await collectSystemInfo();
    const hardwareId = await generateHardwareId();
    
    return {
      hardwareId,
      platform: systemInfo.platform,
      arch: systemInfo.arch,
      osType: systemInfo.osType,
    };
  } catch (error) {
    console.warn('Failed to get system information:', error);
    return {
      hardwareId: generateFallbackId(),
      platform: navigator.platform,
    };
  }
} 