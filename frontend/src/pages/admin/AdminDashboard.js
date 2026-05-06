import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import api from "@/lib/api";
import { Building2, MessageSquare, AlertCircle, Calendar, TrendingUp, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function MetricCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 slide-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
          <p className="font-display font-bold text-3xl text-white">{value ?? "—"}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

const STATUS_BADGE = {
  ativo: "bg-emerald-900/50 text-emerald-400 border-emerald-700",
  trial: "bg-yellow-900/50 text-yellow-400 border-yellow-700",
  suspenso: "bg-red-900/50 text-red-400 border-red-700",
  cancelado: "bg-slate-700 text-slate-400 border-slate-600",
};

export default function AdminDashboard() {
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/metricas-globais").then((r) => {
      setMetricas(r.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AdminLayout title="Dashboard Global">
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-info/30 border-t-brand-info rounded-full animate-spin" />
      </div>
    </AdminLayout>
  );

  const usoPorTenant = metricas?.uso_por_tenant || [];

  return (
    <AdminLayout title="Dashboard Global">
      <div className="space-y-6" data-testid="admin-dashboard">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Total de Clínicas" value={metricas?.total_tenants} icon={Building2} color="bg-brand-info/20 text-brand-info" />
          <MetricCard label="Clínicas Ativas" value={metricas?.tenants_ativos} icon={Activity} color="bg-emerald-900/30 text-emerald-400" sub="Status ativo" />
          <MetricCard label="Em Trial" value={metricas?.tenants_trial} icon={TrendingUp} color="bg-yellow-900/30 text-yellow-400" />
          <MetricCard label="Total Conversas" value={metricas?.total_conversas} icon={MessageSquare} color="bg-blue-900/30 text-blue-400" sub="Todos os tenants" />
          <MetricCard label="Escalações Abertas" value={metricas?.escalacoes_abertas} icon={AlertCircle} color="bg-red-900/30 text-red-400" />
          <MetricCard label="Agendamentos Ativos" value={metricas?.total_agendados} icon={Calendar} color="bg-purple-900/30 text-purple-400" />
        </div>

        {/* Usage by Tenant Chart */}
        {usoPorTenant.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="font-display font-bold text-base text-white mb-4">Conversas por Clínica</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={usoPorTenant}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="nome" tick={{ fill: "#94A3B8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 8, color: "#F1F5F9", fontSize: 12 }}
                />
                <Bar dataKey="conversas" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tenant Status Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="font-display font-bold text-base text-white mb-4">Status das Clínicas</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700">
                  <th className="text-left pb-3">Clínica</th>
                  <th className="text-left pb-3">Plano</th>
                  <th className="text-left pb-3">Status</th>
                  <th className="text-right pb-3">Conversas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {usoPorTenant.map((t) => (
                  <tr key={t.slug} className="text-sm">
                    <td className="py-3 text-white font-medium">{t.nome}</td>
                    <td className="py-3 text-slate-400 capitalize">{t.plano}</td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[t.status] || "bg-slate-700 text-slate-400"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-brand-info font-bold">{t.conversas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
