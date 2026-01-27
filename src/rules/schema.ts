import { z } from 'zod';

export const CustomRuleFixSchema = z.object({
  type: z.enum(['replace', 'remove', 'wrap']),
  replacement: z.string().optional(),
  wrapper: z.object({
    before: z.string(),
    after: z.string(),
  }).optional(),
});

export const CustomRuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Rule ID must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().min(1, 'Rule description is required'),
  category: z.enum(['phi-exposure', 'encryption', 'audit-logging', 'access-control', 'data-retention']),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  pattern: z.string().min(1, 'Pattern is required'),
  flags: z.string().optional().default('gi'),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  recommendation: z.string().min(1, 'Recommendation is required'),
  hipaaReference: z.string().optional(),
  mustNotContain: z.string().optional(),
  fix: CustomRuleFixSchema.optional(),
});

export const RulesFileSchema = z.object({
  version: z.string(),
  rules: z.array(CustomRuleSchema),
});

export type CustomRuleDefinition = z.infer<typeof CustomRuleSchema>;
export type RulesFile = z.infer<typeof RulesFileSchema>;
export type CustomRuleFix = z.infer<typeof CustomRuleFixSchema>;
