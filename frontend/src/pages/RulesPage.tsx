import { useState, useEffect, useCallback } from 'react';
import { rulesApi, categoriesApi } from '../services/api';
import type { CategorizationRule, Category } from '../types';
import './RulesPage.css';

function RulesPage() {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CategorizationRule | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    pattern: '',
    match_type: 'substring' as 'substring' | 'exact' | 'regex',
    category_id: 0,
    priority: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        rulesApi.list(),
        categoriesApi.list(),
      ]);
      setRules(r);
      setCategories(c);
    } catch (err) {
      console.error('Failed to fetch rules', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      pattern: '',
      match_type: 'substring',
      category_id: categories[0]?.id ?? 0,
      priority: 0,
    });
    setShowModal(true);
  };

  const openEdit = (rule: CategorizationRule) => {
    setEditing(rule);
    setForm({
      pattern: rule.pattern,
      match_type: rule.match_type,
      category_id: rule.category_id,
      priority: rule.priority,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await rulesApi.update(editing.id, form);
      } else {
        await rulesApi.create(form);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save rule', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await rulesApi.delete(id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete rule', err);
    }
  };

  const handleApplyAll = async () => {
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await rulesApi.apply();
      setApplyResult(`${res.categorizedCount} transactions re-categorized`);
      setTimeout(() => setApplyResult(null), 4000);
    } catch (err) {
      console.error('Failed to apply rules', err);
    } finally {
      setApplying(false);
    }
  };

  const getCategoryName = (id: number) =>
    categories.find((c) => c.id === id)?.name ?? 'Unknown';

  return (
    <div className="rules-page">
      <div className="rules-header">
        <h2>Categorization Rules</h2>
        <div className="btn-group">
          <button
            className="btn-secondary"
            onClick={handleApplyAll}
            disabled={applying}
          >
            {applying ? 'Applying…' : 'Re-apply All Rules'}
          </button>
          <button className="btn-primary" onClick={openAdd}>
            + New Rule
          </button>
        </div>
      </div>

      {applyResult && <div className="info-banner">{applyResult}</div>}

      {rules.length === 0 ? (
        <div className="empty-rules">
          <p>No categorization rules yet.</p>
          <p>Create rules to automatically categorize imported transactions.</p>
        </div>
      ) : (
        <table className="rules-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Pattern</th>
              <th>Match</th>
              <th>Category</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <span className="priority-badge">{rule.priority}</span>
                </td>
                <td>
                  <code>{rule.pattern}</code>
                </td>
                <td>
                  <span
                    className={`match-type-badge ${rule.match_type}`}
                  >
                    {rule.match_type}
                  </span>
                </td>
                <td>{getCategoryName(rule.category_id)}</td>
                <td>
                  <div className="actions-cell">
                    <button
                      className="btn-secondary"
                      onClick={() => openEdit(rule)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleDelete(rule.id)}
                    >
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Edit Rule' : 'New Rule'}</h3>
            <div className="form-group">
              <label>Pattern</label>
              <input
                value={form.pattern}
                placeholder="e.g. SUPERMARKET"
                onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Match Type</label>
              <select
                value={form.match_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    match_type: e.target.value as 'substring' | 'exact' | 'regex',
                  })
                }
              >
                <option value="substring">Substring</option>
                <option value="exact">Exact</option>
                <option value="regex">Regex</option>
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={form.category_id}
                onChange={(e) =>
                  setForm({ ...form, category_id: Number(e.target.value) })
                }
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Priority (higher runs first)</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSave}>
                {editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RulesPage;
