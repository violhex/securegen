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

// Word-based username schema
const wordUsernameSchema = z.object({
  type: z.literal('Word'),
  capitalize: z.boolean().optional(),
  include_number: z.boolean().optional(),
  strength: z.enum(['Basic', 'Standard', 'Strong', 'Maximum']).optional(),
});

// Email subaddress username schema
const subaddressUsernameSchema = z.object({
  type: z.literal('Subaddress'),
  email: z.string().email('Invalid email format').optional(),
  append_type: z.enum(['Random', 'WebsiteName']).optional(),
  website: z.string().optional(),
});

// Catchall email username schema
const catchallUsernameSchema = z.object({
  type: z.literal('Catchall'),
  domain: z.string().min(1, 'Domain is required for catchall type').optional(),
  append_type: z.enum(['Random', 'WebsiteName']).optional(),
  website: z.string().optional(),
});

// Forwarded email service schema
const forwardedServiceSchema = z.object({
  type: z.enum(['AddyIo', 'DuckDuckGo', 'Firefox', 'Fastmail', 'ForwardEmail', 'SimpleLogin']),
  api_token: z.string().optional(),
  domain: z.string().optional(),
  base_url: z.string().url('Invalid URL format').optional(),
  token: z.string().optional(),
  api_key: z.string().optional(),
});

// Forwarded email username schema
const forwardedUsernameSchema = z.object({
  type: z.literal('Forwarded'),
  service: forwardedServiceSchema.optional(),
  forwarded_website: z.string().optional(),
});

// Discriminated union of all username config variants
export const usernameConfigSchema = z.discriminatedUnion('type', [
  wordUsernameSchema,
  subaddressUsernameSchema,
  catchallUsernameSchema,
  forwardedUsernameSchema,
]);

export type PasswordConfig = z.infer<typeof passwordConfigSchema>;
export type PassphraseConfig = z.infer<typeof passphraseConfigSchema>;
export type UsernameConfig = z.infer<typeof usernameConfigSchema>; 