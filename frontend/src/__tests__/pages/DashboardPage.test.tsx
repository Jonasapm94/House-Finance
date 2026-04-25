import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from '../../pages/DashboardPage';

const mockSummary = {
  totalIncome: '5000.00',
  totalExpenses: '3200.00',
  netBalance: '1800.00',
};

const mockTrend = [
  { month: '2025-01', income: '2500.00', expenses: '1600.00' },
  { month: '2025-02', income: '2500.00', expenses: '1600.00' },
];

const mockBreakdown = [
  { category: 'Food', amount: '1200.00', color: '#22c55e' },
  { category: 'Transport', amount: '800.00', color: '#3b82f6' },
];

vi.mock('../../services/api', () => ({
  dashboardApi: {
    summary: vi.fn().mockResolvedValue({
      totalIncome: '5000.00',
      totalExpenses: '3200.00',
      netBalance: '1800.00',
    }),
    monthlyTrend: vi.fn().mockResolvedValue([]),
    categoryBreakdown: vi.fn().mockResolvedValue([]),
    categoryTrend: vi.fn().mockResolvedValue([]),
  },
  categoriesApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, name: 'Snacks', color: '#f59e0b' },
      { id: 2, name: 'Transport', color: '#3b82f6' },
    ]),
  },
}));

// Mock recharts to avoid issues in JSDOM
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => null,
}));

import { dashboardApi, categoriesApi } from '../../services/api';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dashboardApi.summary as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
    (dashboardApi.monthlyTrend as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrend);
    (dashboardApi.categoryBreakdown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBreakdown,
    );
    (dashboardApi.categoryTrend as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (categoriesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, name: 'Snacks', color: '#f59e0b' },
      { id: 2, name: 'Transport', color: '#3b82f6' },
    ]);
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

  it('renders page title', () => {
    renderPage();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders period selector with default All time', () => {
    renderPage();
    const select = screen.getByDisplayValue('All time');
    expect(select).toBeInTheDocument();
  });

  it('loads and displays summary metric cards', async () => {
    renderPage();
    await waitFor(() => {
      // BRL formatting: R$ 5.000,00
      expect(screen.getByText(/5\.000/)).toBeInTheDocument();
      expect(screen.getByText(/3\.200/)).toBeInTheDocument();
      expect(screen.getByText(/1\.800/)).toBeInTheDocument();
    });
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Net Balance')).toBeInTheDocument();
  });

  it('renders charts when data is available', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });
  });

  it('calls API with date range params when months > 0', async () => {
    (dashboardApi.summary as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);
    (dashboardApi.monthlyTrend as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrend);
    (dashboardApi.categoryBreakdown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBreakdown,
    );

    renderPage();

    // Wait for initial render with default (months=0, no date range)
    await waitFor(() => {
      expect(dashboardApi.summary).toHaveBeenCalledWith(undefined);
    });

    // Now change to 6 months
    const select = screen.getByDisplayValue('All time') as HTMLSelectElement;
    select.value = '6';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => {
      expect(dashboardApi.summary).toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      );
      expect(dashboardApi.monthlyTrend).toHaveBeenCalledWith(6);
      expect(dashboardApi.categoryBreakdown).toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      );
    });
  });

  it('shows "No data" when trend is empty', async () => {
    (dashboardApi.monthlyTrend as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (dashboardApi.categoryBreakdown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      const noDataElements = screen.getAllByText('No data for selected period');
      expect(noDataElements).toHaveLength(2);
    });
  });

  it('renders category dropdown with categories', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Category Monthly Expenses')).toBeInTheDocument();
      expect(screen.getByText('Select a category...')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Snacks' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Transport' })).toBeInTheDocument();
    });
  });

  it('shows prompt message when no category is selected', async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText('Select a category to view monthly expenses'),
      ).toBeInTheDocument();
    });
  });

  it('fetches category trend when category is selected', async () => {
    (dashboardApi.categoryTrend as ReturnType<typeof vi.fn>).mockResolvedValue([
      { month: '2025-01', amount: '150.00' },
      { month: '2025-02', amount: '200.00' },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Category Monthly Expenses')).toBeInTheDocument();
    });

    const categorySelect = screen.getByDisplayValue('Select a category...');
    fireEvent.change(categorySelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(dashboardApi.categoryTrend).toHaveBeenCalledWith(1, 6);
    });
  });

  it('renders line chart when category trend data is available', async () => {
    (dashboardApi.categoryTrend as ReturnType<typeof vi.fn>).mockResolvedValue([
      { month: '2025-01', amount: '150.00' },
      { month: '2025-02', amount: '200.00' },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Category Monthly Expenses')).toBeInTheDocument();
    });

    const categorySelect = screen.getByDisplayValue('Select a category...');
    fireEvent.change(categorySelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  it('shows no-data message when category has no expenses', async () => {
    (dashboardApi.categoryTrend as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Category Monthly Expenses')).toBeInTheDocument();
    });

    const categorySelect = screen.getByDisplayValue('Select a category...');
    fireEvent.change(categorySelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByText('No expense data for this category')).toBeInTheDocument();
    });
  });

  it('renders chart type selector with Line, Bar, Area options', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Category Monthly Expenses')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Line')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bar' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Area' })).toBeInTheDocument();
  });

  it('switches to bar chart when Bar is selected', async () => {
    (dashboardApi.categoryTrend as ReturnType<typeof vi.fn>).mockResolvedValue([
      { month: '2025-01', amount: '150.00' },
    ]);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Category Monthly Expenses')).toBeInTheDocument();
    });

    const categorySelect = screen.getByDisplayValue('Select a category...');
    fireEvent.change(categorySelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    const chartTypeSelect = screen.getByDisplayValue('Line');
    fireEvent.change(chartTypeSelect, { target: { value: 'bar' } });

    await waitFor(() => {
      // Two bar charts: main monthly trend + category trend
      expect(screen.getAllByTestId('bar-chart')).toHaveLength(2);
    });
  });

  it('switches to area chart when Area is selected', async () => {
    (dashboardApi.categoryTrend as ReturnType<typeof vi.fn>).mockResolvedValue([
      { month: '2025-01', amount: '150.00' },
    ]);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Category Monthly Expenses')).toBeInTheDocument();
    });

    const categorySelect = screen.getByDisplayValue('Select a category...');
    fireEvent.change(categorySelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    const chartTypeSelect = screen.getByDisplayValue('Line');
    fireEvent.change(chartTypeSelect, { target: { value: 'area' } });

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  it('has its own time range selector for category trend', async () => {
    (dashboardApi.categoryTrend as ReturnType<typeof vi.fn>).mockResolvedValue([
      { month: '2025-01', amount: '100.00' },
    ]);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Category Monthly Expenses')).toBeInTheDocument();
    });

    // Select a category first
    const categorySelect = screen.getByDisplayValue('Select a category...');
    fireEvent.change(categorySelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(dashboardApi.categoryTrend).toHaveBeenCalledWith(1, 6);
    });

    // Change the category time range to 12 months
    // The category trend section has its own period selector (default "Last 6 months")
    const periodSelects = screen.getAllByDisplayValue('Last 6 months');
    const categoryPeriodSelect = periodSelects[periodSelects.length - 1];
    fireEvent.change(categoryPeriodSelect, { target: { value: '12' } });

    await waitFor(() => {
      expect(dashboardApi.categoryTrend).toHaveBeenCalledWith(1, 12);
    });
  });
});
