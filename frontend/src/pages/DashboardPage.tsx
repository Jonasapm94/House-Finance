import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi, categoriesApi } from '../services/api';
import type { Category, DashboardSummary } from '../types';
import './DashboardPage.css';

const MONTHS_OPTIONS = [
  { value: 0, label: 'All time' },
  { value: 3, label: 'Last 3 months' },
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
  { value: 24, label: 'Last 24 months' },
  { value: -1, label: 'Specific month' },
];

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1;

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear - i);
const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const CATEGORY_MONTHS_OPTIONS = MONTHS_OPTIONS.filter((opt) => opt.value > 0);

type ChartType = 'line' | 'bar' | 'area';

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
  { value: 'area', label: 'Area' },
];

interface TrendRow {
  month: string;
  income: number;
  expenses: number;
}

interface BreakdownRow {
  category: string;
  amount: number;
  color: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function DashboardPage() {
  const [months, setMonths] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryTrend, setCategoryTrend] = useState<{ month: string; amount: number }[]>(
    [],
  );
  const [categoryChartType, setCategoryChartType] = useState<ChartType>('line');
  const [categoryMonths, setCategoryMonths] = useState(6);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = useCallback(() => {
    if (months === -1) {
      const fromDate = new Date(selectedYear, selectedMonth - 1, 1);
      const toDate = new Date(selectedYear, selectedMonth, 0);
      return {
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
      };
    }
    if (months > 0) {
      const from = new Date();
      from.setMonth(from.getMonth() - months);
      return {
        from: from.toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
      };
    }
    return undefined;
  }, [months, selectedMonth, selectedYear]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dateRange = getDateRange();
      const trendMonths = months === -1 ? 1 : months > 0 ? months : undefined;

      const [s, t, b] = await Promise.all([
        dashboardApi.summary(dateRange),
        dashboardApi.monthlyTrend(trendMonths),
        dashboardApi.categoryBreakdown(dateRange),
      ]);
      setSummary(s);
      setTrend(
        t.map((row) => ({
          ...row,
          income: Number(row.income),
          expenses: Number(row.expenses),
        })),
      );
      setBreakdown(
        b.map((row) => ({
          ...row,
          amount: Number(row.amount),
        })),
      );
    } catch (err) {
      console.error('Failed to load dashboard', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [months, getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedCategoryId === null) {
      setCategoryTrend([]);
      return;
    }
    dashboardApi
      .categoryTrend(selectedCategoryId, categoryMonths)
      .then((data) =>
        setCategoryTrend(data.map((row) => ({ ...row, amount: Number(row.amount) }))),
      )
      .catch(console.error);
  }, [selectedCategoryId, categoryMonths]);

  return (
    <div className="dashboard-page">
      <h2>Dashboard</h2>

      <div className="date-range-bar">
        <label>Period:</label>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          {MONTHS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {months === -1 && (
          <>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {MONTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          {/* Metric cards */}
          {summary && (
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="label">Income</div>
                <div className="value income">
                  {formatCurrency(Number(summary.totalIncome))}
                </div>
              </div>
              <div className="metric-card">
                <div className="label">Expenses</div>
                <div className="value expenses">
                  {formatCurrency(Number(summary.totalExpenses))}
                </div>
              </div>
              <div className="metric-card">
                <div className="label">Net Balance</div>
                <div
                  className={`value net ${Number(summary.netBalance) >= 0 ? 'positive' : 'negative'}`}
                >
                  {formatCurrency(Number(summary.netBalance))}
                </div>
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="charts-grid">
            <div className="chart-card">
              <h3>Monthly Trend</h3>
              {trend.length === 0 ? (
                <div className="no-data">No data for selected period</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="income" fill="#16a34a" name="Income" />
                    <Bar dataKey="expenses" fill="#dc2626" name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-card">
              <h3>Expenses by Category</h3>
              {breakdown.length === 0 ? (
                <div className="no-data">No data for selected period</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={breakdown}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({
                        category,
                        percent,
                      }: {
                        category: string;
                        percent: number;
                      }) => `${category} ${(percent * 100).toFixed(0)}%`}
                    >
                      {breakdown.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category Monthly Expenses */}
          <div className="category-trend-section">
            <div className="chart-card">
              <div className="category-trend-header">
                <h3>Category Monthly Expenses</h3>
                <div className="category-trend-controls">
                  <select
                    value={selectedCategoryId ?? ''}
                    onChange={(e) =>
                      setSelectedCategoryId(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={categoryMonths}
                    onChange={(e) => setCategoryMonths(Number(e.target.value))}
                  >
                    {CATEGORY_MONTHS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={categoryChartType}
                    onChange={(e) => setCategoryChartType(e.target.value as ChartType)}
                  >
                    {CHART_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {(() => {
                if (selectedCategoryId === null)
                  return (
                    <div className="no-data">
                      Select a category to view monthly expenses
                    </div>
                  );
                if (categoryTrend.length === 0)
                  return <div className="no-data">No expense data for this category</div>;

                const color =
                  categories.find((c) => c.id === selectedCategoryId)?.color ?? '#6366f1';

                const dataSeriesMap = {
                  bar: <Bar dataKey="amount" fill={color} name="Expenses" />,
                  area: (
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke={color}
                      fill={color}
                      fillOpacity={0.3}
                      name="Expenses"
                      strokeWidth={2}
                    />
                  ),
                  line: (
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke={color}
                      name="Expenses"
                      strokeWidth={2}
                    />
                  ),
                };

                const ChartComponent = {
                  bar: BarChart,
                  area: AreaChart,
                  line: LineChart,
                }[categoryChartType];

                return (
                  <ResponsiveContainer width="100%" height={300}>
                    <ChartComponent data={categoryTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      {dataSeriesMap[categoryChartType]}
                    </ChartComponent>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPage;
