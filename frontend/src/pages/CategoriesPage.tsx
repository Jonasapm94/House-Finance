import { useState, useEffect, useCallback } from 'react';
import { categoriesApi } from '../services/api';
import type { Category } from '../types';
import './CategoriesPage.css';

function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cats = await categoriesApi.list();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to fetch categories', err);
      setError('Failed to load categories. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', color: '#6366f1' });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, color: cat.color });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Category name is required.');
      return;
    }
    try {
      if (editing) {
        await categoriesApi.update(editing.id, form);
      } else {
        await categoriesApi.create(form);
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      console.error('Failed to save category', err);
      setFormError('Failed to save category. Please try again.');
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !window.confirm(
        'Delete this category? Transactions will be reassigned to Uncategorized.',
      )
    )
      return;
    try {
      await categoriesApi.delete(id);
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete category', err);
      setError('Failed to delete category. Please try again.');
    }
  };

  return (
    <div className="categories-page">
      <div className="categories-header">
        <h2>Categories</h2>
        <button className="btn-primary" onClick={openAdd}>
          + New Category
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : (
      <div className="categories-grid">
        {categories.map((cat) => (
          <div key={cat.id} className="category-card">
            <div
              className="category-color"
              style={{ background: cat.color }}
            />
            <div className="category-info">
              <div className="name">{cat.name}</div>
            </div>
            <div className="category-actions">
              <button className="btn-secondary" onClick={() => openEdit(cat)}>
                Edit
              </button>
              {cat.name !== 'Uncategorized' && (
                <button
                  className="btn-danger"
                  onClick={() => handleDelete(cat.id)}
                >
                  Del
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Edit Category' : 'New Category'}</h3>
            {formError && <div className="form-error">{formError}</div>}
            <div className="form-group">
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                style={{ width: '60px', padding: '0.25rem' }}
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

export default CategoriesPage;
