import { z } from 'zod';

export const passwordConfigSchema = z.object({
  length: z.number().min(4).max(128),
  lowercase: z.boolean(),
  uppercase: z.boolean(),
  numbers: z.boolean(),
  special: z.boolean(),
  avoid_ambiguous: z.boolean(),
  min_lowercase: z.number().min(0).max(128).optional(),
  min_uppercase: z.number().min(0).max(128).optional(),
  min_number: z.number().min(0).max(128).optional(),
  min_special: z.number().min(0).max(128).optional(),
});

export const passphraseConfigSchema = z.object({
  wordCount: z.number().min(3).max(20),
  separator: z.string(),
  capitalize: z.boolean(),
  includeNumbers: z.boolean(),
});

export const usernameConfigSchema = z.object({
  type: z.enum(['Word', 'Subaddress', 'Catchall', 'Forwarded']),
  
  // Word variant options
  capitalize: z.boolean().optional(),
  include_number: z.boolean().optional(),
  
  // Subaddress variant options
  email: z.string().optional(),
  append_type: z.enum(['Random', 'WebsiteName']).optional(),
  website: z.string().optional(),
  
  // Catchall variant options
  domain: z.string().optional(),
  
  // Forwarded variant options
  service: z.object({
    type: z.enum(['AddyIo', 'DuckDuckGo', 'Firefox', 'Fastmail', 'ForwardEmail', 'SimpleLogin']),
    api_token: z.string().optional(),
    domain: z.string().optional(),
    base_url: z.string().optional(),
    token: z.string().optional(),
    api_key: z.string().optional(),
  }).optional(),
  forwarded_website: z.string().optional(),
});

export type PasswordConfig = z.infer<typeof passwordConfigSchema>;
export type PassphraseConfig = z.infer<typeof passphraseConfigSchema>;
export type UsernameConfig = z.infer<typeof usernameConfigSchema>; 