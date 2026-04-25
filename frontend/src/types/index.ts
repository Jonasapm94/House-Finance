export interface Category {
  id: number;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: number;
  name: string;
  bank_name: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'income' | 'expense';
export type TransactionSource = 'ofx' | 'csv' | 'manual';

export interface Transaction {
  id: number;
  external_id: string | null;
  category_id: number | null;
  account_id: number | null;
  date: string;
  amount: string;
  description: string;
  type: TransactionType;
  source: TransactionSource;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export type RuleMatchType = 'substring' | 'regex' | 'exact';

export interface CategorizationRule {
  id: number;
  category_id: number;
  pattern: string;
  match_type: RuleMatchType;
  priority: number;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface ImportLog {
  id: number;
  filename: string;
  imported_at: string;
  total_count: number;
  new_count: number;
  duplicate_count: number;
  categorized_count: number;
}

export interface DashboardSummary {
  totalIncome: string;
  totalExpenses: string;
  netBalance: string;
}

export interface MonthlyTrend {
  month: string;
  income: string;
  expenses: string;
}

export interface CategoryBreakdown {
  category: string;
  amount: string;
  color: string;
}

export interface CategoryTrend {
  month: string;
  amount: string;
}
