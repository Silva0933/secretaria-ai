import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/api";
import {
  LayoutDashboard, MessageSquare, KanbanSquare, Calendar,
  Bot, Bell, Settings, LogOut, ChevronLeft, ChevronRight,
  Activity, AlertCircle
} from "lucide-react";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/conversas", icon: MessageSquare, label: "Conversas" },
  { to: "/kanban", icon: KanbanSquare, label: "Kanban" },
  { to: "/agendamentos", icon: Calendar, label: "Agendamentos" },
  { to: "/assistente", icon: Bot, label: "Assistente IA" },
  { to: "/alertas", icon: Bell, label: "Alertas", badge: true },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
];

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [escalacoes, setEscalacoes] = useState(0);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!user?.tenant_id) return;
    const token = localStorage.getItem("cp_token");
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const wsUrl = BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(`${wsUrl}/api/ws/${user.tenant_id}?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "nova_escalacao") {
        setEscalacoes((n) => n + 1);
      }
    };
    return () => ws.close();
  }, [user?.tenant_id]);

  // Load initial escalations count
  useEffect(() => {
    fetch(`${API_BASE}/escalacoes?pendente=true`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("cp_token")}` },
    })
      .then((r) => r.json())
      .then((d) => setEscalacoes(d.escalacoes?.filter((e) => !e.resolvido_em).length || 0))
      .catch(() => {});
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? "w-16" : "w-60"} bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ease-in-out flex-shrink-0`}>
        {/* Logo */}
        <div className={`flex items-center h-16 px-4 border-b border-slate-200 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-brand-primary flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-brand-primary text-base">ClinicaPanel</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
            data-testid="sidebar-toggle"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Tenant Name */}
        {!collapsed && user?.tenant_nome && (
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Clínica</p>
            <p className="text-sm font-semibold text-slate-700 truncate">{user.tenant_nome}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
          {NAV.map(({ to, icon: Icon, label, badge }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
                className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all duration-150
                  ${active
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && (
                  <span className="flex-1">{label}</span>
                )}
                {!collapsed && badge && escalacoes > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {escalacoes > 9 ? "9+" : escalacoes}
                  </span>
                )}
                {collapsed && badge && escalacoes > 0 && (
                  <span className="absolute ml-5 mt-[-18px] bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {escalacoes}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-slate-200 p-3">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-brand-primary font-bold text-sm">
                  {user?.nome?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{user?.nome}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                data-testid="logout-btn"
                className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              data-testid="logout-btn-collapsed"
              className="w-full flex justify-center p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 flex-shrink-0">
          <h1 className="font-display font-bold text-xl text-slate-900">{title}</h1>
        </header>
        <div className="flex-1 overflow-auto scrollbar-thin p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
