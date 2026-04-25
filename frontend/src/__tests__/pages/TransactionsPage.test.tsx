import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionsPage from '../../pages/TransactionsPage';

const mockCategories = [
  { id: 1, name: 'Streaming', color: '#6366f1', created_at: '', updated_at: '' },
  { id: 2, name: 'Alimentação', color: '#22c55e', created_at: '', updated_at: '' },
];

const mockTransactions = {
  data: [
    {
      id: 1,
      date: '2026-04-01',
      description: 'PGTO NETFLIX',
      amount: '49.90',
      type: 'expense' as const,
      source: 'ofx' as const,
      category_id: null,
      category: null,
      account_id: null,
      external_id: null,
      created_at: '',
      updated_at: '',
    },
  ],
  pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
};

const mockSuggestions = [
  {
    transaction_id: 1,
    description: 'PGTO NETFLIX',
    suggested_category_id: 1,
    rule_pattern: 'netflix',
    explanation: 'Serviço de streaming Netflix',
  },
];

vi.mock('../../services/api', () => ({
  transactionsApi: {
    list: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  categoriesApi: {
    list: vi.fn().mockResolvedValue([]),
  },
  aiCategorizationApi: {
    suggest: vi.fn().mockResolvedValue({ suggestions: [], skipped: 0 }),
    apply: vi.fn().mockResolvedValue({ categorized: 0, rules_created: 0, skipped: 0 }),
    auto: vi.fn().mockResolvedValue({ categorized: 0, rules_created: 0, skipped: 0 }),
  },
}));

import { transactionsApi, categoriesApi, aiCategorizationApi } from '../../services/api';

describe('TransactionsPage — AI Categorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (transactionsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockTransactions);
    (categoriesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockCategories);
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>,
    );

  it('renders the Categorizar com IA button', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ai-categorize-btn')).toBeInTheDocument();
    });
  });

  it('opens mode selection modal when button is clicked', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('ai-categorize-btn'));

    fireEvent.click(screen.getByTestId('ai-categorize-btn'));

    // Modal shows mode selection buttons
    expect(screen.getByTestId('ai-auto-btn')).toBeInTheDocument();
    expect(screen.getByTestId('ai-review-btn')).toBeInTheDocument();
  });

  it('calls auto endpoint and shows success banner in auto mode', async () => {
    (aiCategorizationApi.auto as ReturnType<typeof vi.fn>).mockResolvedValue({
      categorized: 3,
      rules_created: 2,
      skipped: 0,
    });

    renderPage();
    await waitFor(() => screen.getByTestId('ai-categorize-btn'));

    fireEvent.click(screen.getByTestId('ai-categorize-btn'));
    fireEvent.click(screen.getByTestId('ai-auto-btn'));

    await waitFor(() => {
      expect(aiCategorizationApi.auto).toHaveBeenCalled();
      expect(screen.getByText(/3 transações categorizadas/)).toBeInTheDocument();
    });
  });

  it('calls suggest endpoint and opens review modal in review mode', async () => {
    (aiCategorizationApi.suggest as ReturnType<typeof vi.fn>).mockResolvedValue({
      suggestions: mockSuggestions,
      skipped: 0,
    });

    renderPage();
    await waitFor(() => screen.getByTestId('ai-categorize-btn'));

    fireEvent.click(screen.getByTestId('ai-categorize-btn'));
    fireEvent.click(screen.getByTestId('ai-review-btn'));

    await waitFor(() => {
      expect(aiCategorizationApi.suggest).toHaveBeenCalled();
      expect(screen.getByText('Revisar sugestões da IA')).toBeInTheDocument();
      // The review modal confirm button should appear
      expect(screen.getByTestId('ai-confirm-btn')).toBeInTheDocument();
    });
  });

  it('reject button removes suggestion from review modal', async () => {
    (aiCategorizationApi.suggest as ReturnType<typeof vi.fn>).mockResolvedValue({
      suggestions: mockSuggestions,
      skipped: 0,
    });

    renderPage();
    await waitFor(() => screen.getByTestId('ai-categorize-btn'));

    fireEvent.click(screen.getByTestId('ai-categorize-btn'));
    fireEvent.click(screen.getByTestId('ai-review-btn'));

    await waitFor(() => screen.getByTestId('reject-1'));
    fireEvent.click(screen.getByTestId('reject-1'));

    // After rejecting the only suggestion, confirm button should be disabled
    await waitFor(() => {
      const confirmBtn = screen.getByTestId('ai-confirm-btn');
      expect(confirmBtn).toBeDisabled();
    });
  });

  it('calls apply endpoint with suggestions when confirm is clicked', async () => {
    (aiCategorizationApi.suggest as ReturnType<typeof vi.fn>).mockResolvedValue({
      suggestions: mockSuggestions,
      skipped: 0,
    });
    (aiCategorizationApi.apply as ReturnType<typeof vi.fn>).mockResolvedValue({
      categorized: 1,
      rules_created: 1,
      skipped: 0,
    });

    renderPage();
    await waitFor(() => screen.getByTestId('ai-categorize-btn'));

    fireEvent.click(screen.getByTestId('ai-categorize-btn'));
    fireEvent.click(screen.getByTestId('ai-review-btn'));

    await waitFor(() => screen.getByTestId('ai-confirm-btn'));
    fireEvent.click(screen.getByTestId('ai-confirm-btn'));

    await waitFor(() => {
      expect(aiCategorizationApi.apply).toHaveBeenCalledWith(mockSuggestions);
      expect(screen.getByText(/1 transações categorizadas/)).toBeInTheDocument();
    });
  });

  it('shows error banner when AI service is unavailable', async () => {
    (aiCategorizationApi.auto as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { data: { message: 'AI service not configured. Set AI_API_KEY in environment.' } },
    });

    renderPage();
    await waitFor(() => screen.getByTestId('ai-categorize-btn'));

    fireEvent.click(screen.getByTestId('ai-categorize-btn'));
    fireEvent.click(screen.getByTestId('ai-auto-btn'));

    await waitFor(() => {
      expect(
        screen.getByText('AI service not configured. Set AI_API_KEY in environment.'),
      ).toBeInTheDocument();
    });
  });

  it('shows error when no suggestions are returned', async () => {
    (aiCategorizationApi.suggest as ReturnType<typeof vi.fn>).mockResolvedValue({
      suggestions: [],
      skipped: 0,
    });

    renderPage();
    await waitFor(() => screen.getByTestId('ai-categorize-btn'));

    fireEvent.click(screen.getByTestId('ai-categorize-btn'));
    fireEvent.click(screen.getByTestId('ai-review-btn'));

    await waitFor(() => {
      expect(
        screen.getByText(/Nenhuma sugestão gerada/),
      ).toBeInTheDocument();
    });
  });
});
