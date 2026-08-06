import { Routes, Route } from 'react-router-dom';
import { DataProvider } from './state';
import { ToastProvider } from './toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Products from './pages/Products';
import Contacts from './pages/Contacts';
import Banking from './pages/Banking';
import Accounting from './pages/Accounting';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  return (
    <DataProvider>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sales/:docType" element={<Sales />} />
            <Route path="/purchases/:docType" element={<Purchases />} />
            <Route path="/products" element={<Products />} />
            <Route path="/contacts/:kind" element={<Contacts />} />
            <Route path="/banking" element={<Banking />} />
            <Route path="/accounting/:view" element={<Accounting />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </DataProvider>
  );
}
