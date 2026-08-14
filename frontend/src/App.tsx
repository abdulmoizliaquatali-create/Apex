import { Routes, Route, useLocation } from 'react-router-dom';
import { DataProvider, useData } from './state';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider } from './toast';
import { ThemeProvider } from './theme';
import Layout from './components/Layout';
import BootScreen from './components/BootScreen';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Products from './pages/Products';
import Contacts from './pages/Contacts';
import Banking from './pages/Banking';
import Accounting from './pages/Accounting';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function Shell() {
  const { ready, refreshing } = useData();
  const { user, checking } = useAuth();
  const location = useLocation();

  // Validating the stored session against the backend.
  if (checking) return <BootScreen />;

  // No valid session — show the login screen (data boot continues in background).
  if (!user) return <Login />;

  if (!ready) return <BootScreen />;

  return (
    <div className={`shell ${refreshing ? 'shell-refreshing' : ''}`}>
      {refreshing && <div className="top-progress"><div className="top-progress-bar" /></div>}
      <Layout>
        <div key={location.pathname + location.search} className="route-fade">
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sales/:docType" element={<Sales />} />
            <Route path="/purchases/:docType" element={<Purchases />} />
            <Route path="/products" element={<Products />} />
            <Route path="/contacts/:kind" element={<Contacts />} />
            <Route path="/banking" element={<Banking />} />
            <Route path="/accounting/:view" element={<Accounting />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin" element={<Settings />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </Layout>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
