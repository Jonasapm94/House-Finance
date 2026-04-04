import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
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
import { dashboardApi } from '../services/api';
import type { DashboardSummary } from '../types';
import './DashboardPage.css';

const MONTHS_OPTIONS = [
  { value: 0, label: 'All time' },
  { value: 3, label: 'Last 3 months' },
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
  { value: 24, label: 'Last 24 months' },
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
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dateRange =
        months > 0
          ? {
              from: (() => {
                const from = new Date();
                from.setMonth(from.getMonth() - months);
                return from.toISOString().slice(0, 10);
              })(),
              to: new Date().toISOString().slice(0, 10),
            }
          : undefined;

      const [s, t, b] = await Promise.all([
        dashboardApi.summary(dateRange),
        dashboardApi.monthlyTrend(months > 0 ? months : undefined),
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
  }, [months]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        </>
      )}
    </div>
  );
}

export default DashboardPage;
