import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import api from "@/lib/api";
import { FileText, Filter, RefreshCw, Download } from "lucide-react";

const ACAO_COLOR = {
  assumiu_conversa: "bg-blue-900/40 text-blue-400",
  devolveu_conversa: "bg-slate-700 text-slate-300",
  moveu_kanban: "bg-indigo-900/40 text-indigo-400",
  impersonation: "bg-yellow-900/40 text-yellow-400",
  criou_operador: "bg-emerald-900/40 text-emerald-400",
  resolveu_escalacao: "bg-green-900/40 text-green-400",
};

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [filters, setFilters] = useState({ tenant_id: "", acao: "" });

  const loadLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.tenant_id) params.set("tenant_id", filters.tenant_id);
    if (filters.acao) params.set("acao", filters.acao);
    params.set("limit", "100");
    try {
      const res = await api.get(`/admin/logs?${params}`);
      setLogs(res.data.logs || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get("/admin/tenants").then((r) => setTenants(r.data.tenants || []));
  }, []);

  useEffect(() => { loadLogs(); }, [filters]);

  const exportCSV = () => {
    const header = "timestamp,tenant_id,operador_id,acao,entidade,entidade_id\n";
    const rows = logs.map((l) =>
      `${l.timestamp},${l.tenant_id || ""},${l.operador_id || ""},${l.acao},${l.entidade || ""},${l.entidade_id || ""}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <AdminLayout title="Logs Globais">
      <div className="space-y-4" data-testid="admin-logs">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filters.tenant_id}
              onChange={(e) => setFilters({ ...filters, tenant_id: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-info"
            >
              <option value="">Todas as clínicas</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select
              value={filters.acao}
              onChange={(e) => setFilters({ ...filters, acao: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-info"
            >
              <option value="">Todas as ações</option>
              {["assumiu_conversa", "devolveu_conversa", "moveu_kanban", "impersonation"].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-info/20 hover:bg-brand-info/30 text-brand-info rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>

        {/* Logs Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">{logs.length} registros</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand-info/30 border-t-brand-info rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700">
                    <th className="text-left px-4 py-3">Timestamp</th>
                    <th className="text-left px-4 py-3">Ação</th>
                    <th className="text-left px-4 py-3">Entidade</th>
                    <th className="text-left px-4 py-3">Operador</th>
                    <th className="text-left px-4 py-3">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {logs.map((log) => (
                    <tr key={log.id} className="text-sm hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-xs whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACAO_COLOR[log.acao] || "bg-slate-700 text-slate-300"}`}>
                          {log.acao}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 text-xs">
                        {log.entidade && <span>{log.entidade}: </span>}
                        <span className="font-mono text-slate-400">{log.entidade_id || "—"}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">
                        {log.operador_id ? log.operador_id.slice(-8) : log.super_admin_id ? "ADMIN" : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {log.impersonado && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 font-medium">
                            IMPERSONADO
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
