import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CategoriesPage from '../../pages/CategoriesPage';

const mockCategories = [
  { id: 1, name: 'Uncategorized', color: '#94a3b8', created_at: '', updated_at: '' },
  { id: 2, name: 'Food', color: '#22c55e', created_at: '', updated_at: '' },
  { id: 3, name: 'Transport', color: '#3b82f6', created_at: '', updated_at: '' },
];

vi.mock('../../services/api', () => ({
  categoriesApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, name: 'Uncategorized', color: '#94a3b8', created_at: '', updated_at: '' },
      { id: 2, name: 'Food', color: '#22c55e', created_at: '', updated_at: '' },
      { id: 3, name: 'Transport', color: '#3b82f6', created_at: '', updated_at: '' },
    ]),
    create: vi.fn().mockResolvedValue({ id: 4, name: 'New', color: '#000', created_at: '', updated_at: '' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { categoriesApi } from '../../services/api';

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (categoriesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockCategories);
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <CategoriesPage />
      </MemoryRouter>,
    );

  it('renders the page title', () => {
    renderPage();
    expect(screen.getByText('Categories')).toBeInTheDocument();
  });

  it('loads and displays categories', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
    });
    expect(categoriesApi.list).toHaveBeenCalledOnce();
  });

  it('shows "+ New Category" button', () => {
    renderPage();
    expect(screen.getByText('+ New Category')).toBeInTheDocument();
  });

  it('opens modal when clicking New Category', async () => {
    renderPage();
    fireEvent.click(screen.getByText('+ New Category'));
    expect(screen.getByText('New Category')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('opens edit modal for a category', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Food')).toBeInTheDocument());
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]!);
    expect(screen.getByText('Edit Category')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('does not show delete button for Uncategorized', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Uncategorized')).toBeInTheDocument());

    // Uncategorized card should not have a Del button
    const uncatCard = screen.getByText('Uncategorized').closest('.category-card');
    expect(uncatCard?.querySelector('.btn-danger')).toBeNull();
  });

  it('calls create when submitting new category', async () => {
    renderPage();
    fireEvent.click(screen.getByText('+ New Category'));

    const input = screen.getByDisplayValue('');
    fireEvent.change(input, { target: { value: 'Bills' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(categoriesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bills' }),
      );
    });
  });
});
