import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import api from "@/lib/api";
import { Plus, ExternalLink, AlertCircle, MessageSquare, Activity, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_BADGE = {
  ativo: "bg-emerald-900/50 text-emerald-400 border border-emerald-700",
  trial: "bg-yellow-900/50 text-yellow-400 border border-yellow-700",
  suspenso: "bg-red-900/50 text-red-400 border border-red-700",
  cancelado: "bg-slate-700 text-slate-400 border border-slate-600",
};
const PLANO_BADGE = {
  trial: "bg-slate-700 text-slate-300",
  starter: "bg-blue-900/50 text-blue-400",
  pro: "bg-indigo-900/50 text-indigo-400",
  enterprise: "bg-purple-900/50 text-purple-400",
};

function CreateTenantModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    nome: "", slug: "", cnpj: "", email_contato: "", plano: "trial",
    instancia_evolution: "", admin_nome: "", admin_email: "", admin_senha: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/admin/tenants", form);
      onCreated(res.data.tenant);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Erro ao criar clínica");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="font-display font-bold text-white text-lg">Nova Clínica</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-400 mb-1 block">Nome da Clínica *</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-brand-info" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Slug (subdomínio) *</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s/g, '') })} required
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-brand-info" placeholder="clinicaexemplo" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">CNPJ</label>
              <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-brand-info" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Email de contato</label>
              <input type="email" value={form.email_contato} onChange={(e) => setForm({ ...form, email_contato: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-brand-info" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Plano</label>
              <select value={form.plano} onChange={(e) => setForm({ ...form, plano: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none">
                {["trial", "starter", "pro", "enterprise"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-400 mb-1 block">Instância Evolution API *</label>
              <input value={form.instancia_evolution} onChange={(e) => setForm({ ...form, instancia_evolution: e.target.value })} required
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-brand-info" placeholder="nome_da_instancia" />
            </div>
          </div>
          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">Admin da Clínica</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nome *</label>
                <input value={form.admin_nome} onChange={(e) => setForm({ ...form, admin_nome: e.target.value })} required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-brand-info" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Email *</label>
                <input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-brand-info" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Senha *</label>
                <input type="password" value={form.admin_senha} onChange={(e) => setForm({ ...form, admin_senha: e.target.value })} required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-brand-info" />
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700/50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-brand-info hover:bg-brand-info/90 text-white font-semibold py-2.5 rounded-lg transition-all disabled:opacity-60">
            {loading ? "Criando..." : "Criar Clínica"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminTenants() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [impersonating, setImpersonating] = useState(null);

  useEffect(() => {
    api.get("/admin/tenants").then((r) => setTenants(r.data.tenants || [])).finally(() => setLoading(false));
  }, []);

  const handleImpersonate = async (tenant) => {
    setImpersonating(tenant.id);
    try {
      const res = await api.post(`/admin/tenants/${tenant.id}/impersonate`);
      const { access_token, operador_nome, tenant_nome } = res.data;
      const savedAdminToken = localStorage.getItem("cp_token");
      const savedAdminUser = localStorage.getItem("cp_user");
      localStorage.setItem("cp_impersonate_backup", JSON.stringify({ token: savedAdminToken, user: savedAdminUser }));
      localStorage.setItem("cp_token", access_token);
      localStorage.setItem("cp_user", JSON.stringify({ nome: operador_nome, role: "admin", tenant_nome, tenant_id: tenant.id }));
      window.location.href = "/dashboard";
    } catch (err) {
      alert("Erro ao impersonar: " + (err.response?.data?.detail || err.message));
    } finally {
      setImpersonating(null);
    }
  };

  const handleToggleStatus = async (tenant) => {
    const newStatus = tenant.status === "ativo" ? "suspenso" : "ativo";
    const res = await api.patch(`/admin/tenants/${tenant.id}`, { status: newStatus });
    setTenants((prev) => prev.map((t) => t.id === tenant.id ? { ...t, status: newStatus } : t));
  };

  return (
    <AdminLayout title="Gestão de Clínicas">
      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={(t) => setTenants((prev) => [t, ...prev])}
        />
      )}

      <div className="space-y-4" data-testid="admin-tenants">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">{tenants.length} clínica(s) cadastradas</p>
          <button
            onClick={() => setShowCreate(true)}
            data-testid="btn-create-tenant"
            className="flex items-center gap-2 bg-brand-info hover:bg-brand-info/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Clínica
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-info/30 border-t-brand-info rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map((t) => (
              <div key={t.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-colors" data-testid={`tenant-${t.slug}`}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-info/20 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-brand-info text-sm">{t.nome?.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{t.nome}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[t.status] || "bg-slate-700 text-slate-400"}`}>{t.status}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLANO_BADGE[t.plano] || ""}`}>{t.plano}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="font-mono">{t.slug}</span>
                      <span>{t.email_contato || "—"}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t.total_conversas || 0} conversas</span>
                      {t.escalacoes_abertas > 0 && (
                        <span className="flex items-center gap-1 text-red-400"><AlertCircle className="w-3 h-3" />{t.escalacoes_abertas} escalações</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleImpersonate(t)}
                      disabled={impersonating === t.id}
                      data-testid={`btn-impersonate-${t.slug}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-info/20 hover:bg-brand-info/30 text-brand-info rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {impersonating === t.id ? "..." : "Acessar"}
                    </button>
                    <button
                      onClick={() => handleToggleStatus(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${t.status === "ativo"
                          ? "bg-red-900/30 hover:bg-red-900/50 text-red-400"
                          : "bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400"
                        }`}
                    >
                      {t.status === "ativo" ? "Suspender" : "Ativar"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
