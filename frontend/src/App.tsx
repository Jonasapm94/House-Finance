import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import CategoriesPage from './pages/CategoriesPage';
import RulesPage from './pages/RulesPage';
import UploadPage from './pages/UploadPage';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/upload" element={<UploadPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
