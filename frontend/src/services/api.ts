import apiClient from './apiClient';
import type {
  Category,
  Transaction,
  CategorizationRule,
  DashboardSummary,
  MonthlyTrend,
  CategoryBreakdown,
} from '../types';

// === Categories ===
export const categoriesApi = {
  list: () => apiClient.get<Category[]>('/categories').then((r) => r.data),

  get: (id: number) => apiClient.get<Category>(`/categories/${id}`).then((r) => r.data),

  create: (data: { name: string; color?: string }) =>
    apiClient.post<Category>('/categories', data).then((r) => r.data),

  update: (id: number, data: { name?: string; color?: string }) =>
    apiClient.put<Category>(`/categories/${id}`, data).then((r) => r.data),

  delete: (id: number) => apiClient.delete(`/categories/${id}`).then((r) => r.data),
};

// === Transactions ===
export interface TransactionListResponse {
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  category_id?: number | 'uncategorized';
  type?: 'income' | 'expense';
  search?: string;
}

export const transactionsApi = {
  list: (filters?: TransactionFilters) =>
    apiClient
      .get<TransactionListResponse>('/transactions', { params: filters })
      .then((r) => r.data),

  get: (id: number) =>
    apiClient.get<Transaction>(`/transactions/${id}`).then((r) => r.data),

  create: (data: {
    date: string;
    amount: number;
    description: string;
    type: 'income' | 'expense';
    category_id?: number | null;
  }) => apiClient.post<Transaction>('/transactions', data).then((r) => r.data),

  update: (
    id: number,
    data: {
      date?: string;
      amount?: number;
      description?: string;
      type?: 'income' | 'expense';
      category_id?: number | null;
    },
  ) => apiClient.put<Transaction>(`/transactions/${id}`, data).then((r) => r.data),

  delete: (id: number) => apiClient.delete(`/transactions/${id}`).then((r) => r.data),
};

// === Rules ===
export const rulesApi = {
  list: () => apiClient.get<CategorizationRule[]>('/rules').then((r) => r.data),

  get: (id: number) =>
    apiClient.get<CategorizationRule>(`/rules/${id}`).then((r) => r.data),

  create: (data: {
    category_id: number;
    pattern: string;
    match_type?: 'substring' | 'regex' | 'exact';
    priority?: number;
  }) => apiClient.post<CategorizationRule>('/rules', data).then((r) => r.data),

  update: (
    id: number,
    data: {
      category_id?: number;
      pattern?: string;
      match_type?: 'substring' | 'regex' | 'exact';
      priority?: number;
    },
  ) => apiClient.put<CategorizationRule>(`/rules/${id}`, data).then((r) => r.data),

  delete: (id: number) => apiClient.delete(`/rules/${id}`).then((r) => r.data),

  apply: () =>
    apiClient
      .post<{ categorizedCount: number; uncategorizedCount: number }>('/rules/apply')
      .then((r) => r.data),
};

// === Upload ===
export interface UploadResult {
  filename: string;
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  categorizedCount: number;
}

export interface MultiUploadResponse {
  files: UploadResult[];
  totalTotalCount: number;
  totalNewCount: number;
  totalDuplicateCount: number;
  totalCategorizedCount: number;
}

export const uploadApi = {
  uploadFiles: (
    files: File[],
    csvMapping?: {
      date: string;
      amount: string;
      description: string;
      type?: string;
      external_id?: string;
    },
  ) => {
    const formData = new FormData();

    for (const file of files) {
      formData.append('file', file);
    }

    if (csvMapping) {
      formData.append('mapping', JSON.stringify(csvMapping));
    }

    return apiClient
      .post<MultiUploadResponse>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      .then((r) => r.data);
  },
};

// === Dashboard ===
export const dashboardApi = {
  summary: (params?: { from?: string; to?: string }) =>
    apiClient.get<DashboardSummary>('/dashboard/summary', { params }).then((r) => r.data),

  monthlyTrend: (months?: number) =>
    apiClient
      .get<MonthlyTrend[]>('/dashboard/monthly-trend', {
        params: { months },
      })
      .then((r) => r.data),

  categoryBreakdown: (params?: { from?: string; to?: string }) =>
    apiClient
      .get<CategoryBreakdown[]>('/dashboard/category-breakdown', {
        params,
      })
      .then((r) => r.data),
};
