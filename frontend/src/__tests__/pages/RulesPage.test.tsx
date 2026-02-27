import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RulesPage from '../../pages/RulesPage';

const mockCategories = [
  { id: 1, name: 'Uncategorized', color: '#94a3b8', created_at: '', updated_at: '' },
  { id: 2, name: 'Food', color: '#22c55e', created_at: '', updated_at: '' },
];

const mockRules = [
  {
    id: 1,
    category_id: 2,
    pattern: 'SUPERMARKET',
    match_type: 'substring' as const,
    priority: 10,
    created_at: '',
    updated_at: '',
  },
  {
    id: 2,
    category_id: 2,
    pattern: '^FOOD.*',
    match_type: 'regex' as const,
    priority: 5,
    created_at: '',
    updated_at: '',
  },
];

vi.mock('../../services/api', () => ({
  rulesApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    apply: vi.fn().mockResolvedValue({ categorizedCount: 5, uncategorizedCount: 2 }),
  },
  categoriesApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

import { rulesApi, categoriesApi } from '../../services/api';

describe('RulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rulesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockRules);
    (categoriesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockCategories);
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>,
    );

  it('renders the page title and action buttons', () => {
    renderPage();
    expect(screen.getByText('Categorization Rules')).toBeInTheDocument();
    expect(screen.getByText('+ New Rule')).toBeInTheDocument();
    expect(screen.getByText('Re-apply All Rules')).toBeInTheDocument();
  });

  it('loads and displays rules in a table', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('SUPERMARKET')).toBeInTheDocument();
      expect(screen.getByText('^FOOD.*')).toBeInTheDocument();
    });
  });

  it('shows match type badges', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('substring')).toBeInTheDocument();
      expect(screen.getByText('regex')).toBeInTheDocument();
    });
  });

  it('shows empty state when no rules', async () => {
    (rulesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No categorization rules yet.')).toBeInTheDocument();
    });
  });

  it('opens modal when clicking New Rule', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('SUPERMARKET')).toBeInTheDocument());
    fireEvent.click(screen.getByText('+ New Rule'));
    expect(screen.getByText('New Rule')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. SUPERMARKET')).toBeInTheDocument();
  });

  it('calls apply when clicking Re-apply All Rules', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('SUPERMARKET')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Re-apply All Rules'));

    await waitFor(() => {
      expect(rulesApi.apply).toHaveBeenCalledOnce();
      expect(screen.getByText('5 transactions re-categorized')).toBeInTheDocument();
    });
  });

  it('calls create when submitting a new rule', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('SUPERMARKET')).toBeInTheDocument());
    fireEvent.click(screen.getByText('+ New Rule'));

    const patternInput = screen.getByPlaceholderText('e.g. SUPERMARKET');
    fireEvent.change(patternInput, { target: { value: 'PHARMACY' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(rulesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ pattern: 'PHARMACY' }),
      );
    });
  });
});
