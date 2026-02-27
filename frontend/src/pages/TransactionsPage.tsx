import { useState, useEffect, useCallback } from 'react';
import { transactionsApi, categoriesApi } from '../services/api';
import type { TransactionFilters } from '../services/api';
import type { Transaction, Category } from '../types';
import './TransactionsPage.css';

function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 25,
  });
  const [showModal, setShowModal] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [form, setForm] = useState({
    date: '',
    amount: '',
    description: '',
    type: 'expense' as 'income' | 'expense',
    category_id: '' as string,
  });

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await transactionsApi.list(filters);
      setTransactions(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    }
  }, [filters]);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await categoriesApi.list();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openAdd = () => {
    setEditingTxn(null);
    setForm({
      date: new Date().toISOString().split('T')[0]!,
      amount: '',
      description: '',
      type: 'expense',
      category_id: '',
    });
    setShowModal(true);
  };

  const openEdit = (txn: Transaction) => {
    setEditingTxn(txn);
    setForm({
      date: txn.date.slice(0, 10),
      amount: txn.amount,
      description: txn.description,
      type: txn.type,
      category_id: txn.category_id?.toString() ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingTxn) {
        await transactionsApi.update(editingTxn.id, {
          date: form.date,
          amount: parseFloat(form.amount),
          description: form.description,
          type: form.type,
          category_id: form.category_id ? parseInt(form.category_id) : null,
        });
      } else {
        await transactionsApi.create({
          date: form.date,
          amount: parseFloat(form.amount),
          description: form.description,
          type: form.type,
          category_id: form.category_id ? parseInt(form.category_id) : null,
        });
      }
      setShowModal(false);
      fetchTransactions();
    } catch (err) {
      console.error('Failed to save transaction', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await transactionsApi.delete(id);
      fetchTransactions();
    } catch (err) {
      console.error('Failed to delete transaction', err);
    }
  };

  const formatAmount = (amount: string, type: string) => {
    const n = parseFloat(amount);
    const formatted = n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return type === 'income' ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <div className="transactions-page">
      <h2>Transactions</h2>

      <div className="transactions-toolbar">
        <div className="filter-group">
          <label>Search</label>
          <input
            placeholder="Search description..."
            value={filters.search ?? ''}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value, page: 1 })
            }
          />
        </div>

        <div className="filter-group">
          <label>From</label>
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                from: e.target.value || undefined,
                page: 1,
              })
            }
          />
        </div>

        <div className="filter-group">
          <label>To</label>
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                to: e.target.value || undefined,
                page: 1,
              })
            }
          />
        </div>

        <div className="filter-group">
          <label>Type</label>
          <select
            value={filters.type ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                type: (e.target.value || undefined) as
                  | 'income'
                  | 'expense'
                  | undefined,
                page: 1,
              })
            }
          >
            <option value="">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Category</label>
          <select
            value={filters.category_id ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setFilters({
                ...filters,
                category_id: val === 'uncategorized'
                  ? 'uncategorized'
                  : val
                    ? parseInt(val)
                    : undefined,
                page: 1,
              });
            }}
          >
            <option value="">All</option>
            <option value="uncategorized">Uncategorized</option>
            {categories.filter((c) => c.name !== 'Uncategorized').map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button className="btn-primary" onClick={openAdd}>
          + Add Transaction
        </button>
      </div>

      <div className="transactions-table">
        {transactions.length === 0 ? (
          <div className="no-data">No transactions found</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id}>
                  <td>{txn.date}</td>
                  <td>{txn.description}</td>
                  <td>
                    <span
                      className="category-badge"
                      style={{
                        borderLeft: `3px solid ${txn.category?.color ?? '#94a3b8'}`,
                      }}
                    >
                      {txn.category?.name ?? 'Uncategorized'}
                    </span>
                  </td>
                  <td
                    className={
                      txn.type === 'income'
                        ? 'amount-income'
                        : 'amount-expense'
                    }
                  >
                    {formatAmount(txn.amount, txn.type)}
                  </td>
                  <td>{txn.source}</td>
                  <td className="table-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => openEdit(txn)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleDelete(txn.id)}
                    >
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button
          className="btn-secondary"
          disabled={pagination.page <= 1}
          onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
        >
          Prev
        </button>
        <span className="page-info">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total}{' '}
          total)
        </span>
        <button
          className="btn-secondary"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
        >
          Next
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingTxn ? 'Edit Transaction' : 'Add Transaction'}</h3>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label>Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Type</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value as 'income' | 'expense',
                  })
                }
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                value={form.category_id}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value })
                }
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSave}>
                {editingTxn ? 'Save Changes' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionsPage;
