import { z } from 'zod';

// === Category Schemas ===
export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
    .optional()
    .default('#6366f1'),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
    .optional(),
});

// === Transaction Schemas ===
export const CreateTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1),
  type: z.enum(['income', 'expense']),
  category_id: z.number().int().positive().nullable().optional(),
  account_id: z.number().int().positive().nullable().optional(),
});

export const UpdateTransactionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  description: z.string().min(1).optional(),
  type: z.enum(['income', 'expense']).optional(),
  category_id: z.number().int().positive().nullable().optional(),
  account_id: z.number().int().positive().nullable().optional(),
});

// === Rule Schemas ===
export const CreateRuleSchema = z.object({
  category_id: z.number().int().positive(),
  pattern: z.string().min(1),
  match_type: z.enum(['substring', 'regex', 'exact']).optional().default('substring'),
  priority: z.number().int().min(0).optional().default(0),
});

export const UpdateRuleSchema = z.object({
  category_id: z.number().int().positive().optional(),
  pattern: z.string().min(1).optional(),
  match_type: z.enum(['substring', 'regex', 'exact']).optional(),
  priority: z.number().int().min(0).optional(),
});

// === Common Schemas ===
export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const TransactionFilterSchema = PaginationSchema.extend({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  category_id: z
    .union([z.literal('uncategorized'), z.coerce.number().int().positive()])
    .optional(),
  type: z.enum(['income', 'expense']).optional(),
  search: z.string().optional(),
});

export const DashboardQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const MonthlyTrendQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
});

export const CategoryTrendQuerySchema = MonthlyTrendQuerySchema.extend({
  category_id: z.coerce.number().int().positive(),
});

// === AI Categorization Schemas ===
export const AiSuggestionInputSchema = z.object({
  transaction_id: z.number().int().positive(),
  suggested_category_id: z.number().int().positive(),
  rule_pattern: z.string().min(1),
  explanation: z.string(),
});

export const AiApplyBodySchema = z.object({
  suggestions: z.array(AiSuggestionInputSchema).min(1),
});

// === Upload Schema ===
export const CSVMappingSchema = z.object({
  date: z.string().min(1),
  amount: z.string().min(1),
  description: z.string().min(1),
  type: z.string().optional(),
  external_id: z.string().optional(),
});
