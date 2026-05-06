import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import "@/index.css";

// Clinic pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Conversas from "@/pages/Conversas";
import Kanban from "@/pages/Kanban";
import Agendamentos from "@/pages/Agendamentos";
import Assistente from "@/pages/Assistente";
import Alertas from "@/pages/Alertas";
import Configuracoes from "@/pages/Configuracoes";
import BillingSuccess from "@/pages/BillingSuccess";

// Admin pages
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminTenants from "@/pages/admin/AdminTenants";
import AdminMonitor from "@/pages/admin/AdminMonitor";
import AdminLogs from "@/pages/admin/AdminLogs";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "super_admin") return <Navigate to="/dashboard" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "super_admin") return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Clinic Panel */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/conversas" element={<ProtectedRoute><Conversas /></ProtectedRoute>} />
          <Route path="/conversas/:telefone" element={<ProtectedRoute><Conversas /></ProtectedRoute>} />
          <Route path="/kanban" element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
          <Route path="/agendamentos" element={<ProtectedRoute><Agendamentos /></ProtectedRoute>} />
          <Route path="/assistente" element={<ProtectedRoute><Assistente /></ProtectedRoute>} />
          <Route path="/alertas" element={<ProtectedRoute><Alertas /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
          <Route path="/billing/success" element={<ProtectedRoute><BillingSuccess /></ProtectedRoute>} />

          {/* Super Admin */}
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/tenants" element={<AdminRoute><AdminTenants /></AdminRoute>} />
          <Route path="/admin/monitor" element={<AdminRoute><AdminMonitor /></AdminRoute>} />
          <Route path="/admin/logs" element={<AdminRoute><AdminLogs /></AdminRoute>} />

          {/* Default redirects */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
