import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Building2, Activity, FileText, CreditCard, LogOut, Shield
} from "lucide-react";

const NAV = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/tenants", icon: Building2, label: "Clínicas" },
  { to: "/admin/monitor", icon: Activity, label: "Monitor" },
  { to: "/admin/logs", icon: FileText, label: "Logs Globais" },
];

export default function AdminLayout({ children, title }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/admin/login"); };

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-800 flex flex-col flex-shrink-0 border-r border-slate-700">
        <div className="flex items-center gap-3 h-16 px-5 border-b border-slate-700">
          <div className="w-8 h-8 rounded-md bg-brand-info flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-white text-sm">Super Admin</span>
            <p className="text-xs text-slate-400">ClinicaPanel</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                data-testid={`admin-nav-${label.toLowerCase().replace(/\s/g, '-')}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${active
                    ? "bg-brand-info text-white"
                    : "text-slate-400 hover:bg-slate-700 hover:text-white"
                  }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-700 p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-info/20 flex items-center justify-center">
              <span className="text-brand-info font-bold text-sm">{user?.nome?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.nome}</p>
              <p className="text-xs text-slate-400">Super Admin</p>
            </div>
            <button
              onClick={handleLogout}
              data-testid="admin-logout-btn"
              className="p-1.5 rounded hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-900">
        <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-6 flex-shrink-0">
          <h1 className="font-display font-bold text-xl text-white">{title}</h1>
        </header>
        <div className="flex-1 overflow-auto p-6 scrollbar-thin">
          {children}
        </div>
      </main>
    </div>
  );
}
