import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import api from "@/lib/api";
import { CheckCircle, XCircle, RefreshCw, Activity, Database } from "lucide-react";

export default function AdminMonitor() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/health");
      setHealth(res.data);
      setLastCheck(new Date());
    } catch (err) {
      setHealth({ services: [{ nome: "API", status: "offline", erro: err.message }] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkHealth(); }, []);

  const allOnline = health?.services?.every((s) => s.status === "online");

  return (
    <AdminLayout title="Monitor de Workflows">
      <div className="space-y-6" data-testid="admin-monitor">
        {/* Status Banner */}
        <div className={`rounded-xl border p-5 flex items-center gap-4
          ${allOnline ? "bg-emerald-900/20 border-emerald-700" : "bg-red-900/20 border-red-700"}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center
            ${allOnline ? "bg-emerald-900/50" : "bg-red-900/50"}`}>
            {allOnline
              ? <CheckCircle className="w-6 h-6 text-emerald-400" />
              : <XCircle className="w-6 h-6 text-red-400" />
            }
          </div>
          <div className="flex-1">
            <h2 className={`font-display font-bold text-xl ${allOnline ? "text-emerald-300" : "text-red-300"}`}>
              {allOnline ? "Todos os Serviços Online" : "Atenção: Falha Detectada"}
            </h2>
            {lastCheck && <p className="text-slate-400 text-sm">Última verificação: {lastCheck.toLocaleTimeString("pt-BR")}</p>}
          </div>
          <button
            onClick={checkHealth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Verificar Agora
          </button>
        </div>

        {/* Services */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="font-display font-bold text-white mb-4">Status dos Serviços</h3>
          <div className="space-y-3">
            {(health?.services || []).map((s) => (
              <div key={s.nome} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-slate-400" />
                  <span className="text-white font-medium text-sm">{s.nome}</span>
                </div>
                <div className="flex items-center gap-3">
                  {s.latencia && <span className="text-xs text-slate-400">{s.latencia}</span>}
                  {s.erro && <span className="text-xs text-red-400">{s.erro}</span>}
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full
                    ${s.status === "online" ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status === "online" ? "bg-emerald-400" : "bg-red-400"}`} />
                    {s.status}
                  </span>
                </div>
              </div>
            ))}

            {/* Additional static services info */}
            {[
              { nome: "n8n Webhooks", status: "info", nota: "Configurar URL no tenant" },
              { nome: "Evolution API", status: "info", nota: "Verificar conexão por tenant" },
              { nome: "Google Calendar", status: "info", nota: "OAuth configurado por tenant" },
              { nome: "Gemini AI", status: "online", nota: "Assistente ativo" },
            ].map((s) => (
              <div key={s.nome} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <span className="text-white font-medium text-sm">{s.nome}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{s.nota}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full
                    ${s.status === "online" ? "bg-emerald-900/50 text-emerald-400"
                    : s.status === "info" ? "bg-slate-600 text-slate-300"
                    : "bg-red-900/50 text-red-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status === "online" ? "bg-emerald-400" : "bg-slate-400"}`} />
                    {s.status === "info" ? "config. necessária" : s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Webhook URLs Guide */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="font-display font-bold text-white mb-4">URLs de Webhook para n8n</h3>
          <div className="space-y-2">
            {[
              ["Kanban Update", "POST /api/webhook/kanban"],
              ["Escalação", "POST /api/webhook/escalacao"],
              ["WebSocket Notify", "POST /api/webhook/ws/notify"],
            ].map(([label, url]) => (
              <div key={label} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-lg">
                <span className="text-sm text-slate-300">{label}</span>
                <code className="text-xs font-mono text-brand-info bg-slate-900/50 px-2 py-1 rounded">{url}</code>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">Adicione o header <code className="text-brand-info">x-webhook-secret</code> com o secret do tenant em todas as chamadas.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
