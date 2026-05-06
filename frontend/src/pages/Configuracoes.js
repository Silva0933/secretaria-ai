import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Stethoscope, Clock, MessageSquare, Bell, Link, CreditCard, Plus, Trash2, Edit, Check, X, Save, BellRing, BellOff, Calendar as CalendarIcon, Unlink, ExternalLink, Zap } from "lucide-react";
import {
  pushSupported,
  getCurrentSubscription,
  subscribePush,
  unsubscribePush,
  testPush,
} from "@/lib/push";

const TABS = [
  { key: "equipe", label: "Equipe", icon: Users },
  { key: "profissionais", label: "Profissionais", icon: Stethoscope },
  { key: "horarios", label: "Horários", icon: Clock },
  { key: "mensagens", label: "Mensagens", icon: MessageSquare },
  { key: "notificacoes", label: "Notificações", icon: Bell },
  { key: "integracoes", label: "Integrações", icon: Link },
  { key: "plano", label: "Plano", icon: CreditCard },
];

const PLANO_INFO = {
  trial: { nome: "Trial", color: "bg-yellow-100 text-yellow-800", limite: "7 dias" },
  starter: { nome: "Starter", color: "bg-blue-100 text-blue-800", limite: "500 conv/mês" },
  pro: { nome: "Pro", color: "bg-indigo-100 text-indigo-800", limite: "2000 conv/mês" },
  enterprise: { nome: "Enterprise", color: "bg-purple-100 text-purple-800", limite: "Ilimitado" },
};

export default function Configuracoes() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("equipe");
  const [config, setConfig] = useState({});
  const [tenant, setTenant] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Forms
  const [newProf, setNewProf] = useState({ nome: "", especialidade: "", tipo: "medico", calendar_id: "" });
  const [newOp, setNewOp] = useState({ nome: "", email: "", senha: "", nivel: "operador" });
  const [editProf, setEditProf] = useState(null);
  const [localConfig, setLocalConfig] = useState({});

  // Integrations state
  const [pushStatus, setPushStatus] = useState({ supported: false, subscribed: false, loading: false });
  const [pushMsg, setPushMsg] = useState("");
  const [googleStatus, setGoogleStatus] = useState({ configured: false, connected: false, email: null });
  const [googleConnecting, setGoogleConnecting] = useState(false);

  // Billing state
  const [plans, setPlans] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [billingMsg, setBillingMsg] = useState("");

  useEffect(() => {
    api.get("/config").then((r) => {
      setConfig(r.data.config || {});
      setTenant(r.data.tenant);
      setLocalConfig(r.data.config || {});
    });
    api.get("/config/profissionais").then((r) => setProfissionais(r.data.profissionais || []));
    if (isAdmin()) {
      api.get("/config/operadores").then((r) => setOperadores(r.data.operadores || []));
    }
    // Plans + transactions
    api.get("/billing/plans").then((r) => setPlans(r.data.plans || [])).catch(() => {});
    if (isAdmin()) {
      api.get("/billing/transactions").then((r) => setTransactions(r.data.transactions || [])).catch(() => {});
    }
    // Google status
    api.get("/integrations/google/status").then((r) => setGoogleStatus(r.data)).catch(() => {});

    // Push status
    (async () => {
      const supported = pushSupported();
      let subscribed = false;
      if (supported) {
        try {
          const sub = await getCurrentSubscription();
          subscribed = !!sub;
        } catch {}
      }
      setPushStatus({ supported, subscribed, loading: false });
    })();
  }, []);

  // Handle redirect feedback (?google_status=ok|error or ?billing=cancel)
  useEffect(() => {
    const gs = searchParams.get("google_status");
    if (gs) {
      if (gs === "ok") {
        setTab("integracoes");
        api.get("/integrations/google/status").then((r) => setGoogleStatus(r.data)).catch(() => {});
      } else {
        setTab("integracoes");
        setBillingMsg(searchParams.get("msg") || "Falha ao conectar Google");
      }
      // clear params
      const next = new URLSearchParams(searchParams);
      next.delete("google_status");
      next.delete("msg");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const saveConfig = async (chave, valor) => {
    setSaving(true);
    await api.patch("/config", { chave, valor });
    setConfig((prev) => ({ ...prev, [chave]: valor }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCreateProf = async (e) => {
    e.preventDefault();
    const res = await api.post("/config/profissionais", newProf);
    setProfissionais((prev) => [...prev, res.data.profissional]);
    setNewProf({ nome: "", especialidade: "", tipo: "medico", calendar_id: "" });
  };

  const handleDeleteProf = async (id) => {
    await api.delete(`/config/profissionais/${id}`);
    setProfissionais((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCreateOp = async (e) => {
    e.preventDefault();
    await api.post("/config/operadores", newOp);
    const res = await api.get("/config/operadores");
    setOperadores(res.data.operadores || []);
    setNewOp({ nome: "", email: "", senha: "", nivel: "operador" });
  };

  const handleDeleteOp = async (id) => {
    await api.delete(`/config/operadores/${id}`);
    setOperadores((prev) => prev.filter((o) => o.id !== id));
  };

  // Push handlers
  const handleEnablePush = async () => {
    setPushStatus((p) => ({ ...p, loading: true }));
    setPushMsg("");
    try {
      await subscribePush();
      setPushStatus({ supported: true, subscribed: true, loading: false });
      setPushMsg("Notificações ativadas com sucesso!");
    } catch (e) {
      setPushStatus((p) => ({ ...p, loading: false }));
      setPushMsg(e.message || "Erro ao ativar notificações");
    }
  };

  const handleDisablePush = async () => {
    setPushStatus((p) => ({ ...p, loading: true }));
    try {
      await unsubscribePush();
      setPushStatus({ supported: true, subscribed: false, loading: false });
      setPushMsg("Notificações desativadas");
    } catch (e) {
      setPushStatus((p) => ({ ...p, loading: false }));
      setPushMsg("Erro ao desativar");
    }
  };

  const handleTestPush = async () => {
    try {
      const r = await testPush();
      setPushMsg(`Push de teste enviado para ${r.sent} dispositivo(s)`);
    } catch (e) {
      setPushMsg("Erro ao enviar teste: " + (e.response?.data?.detail || e.message));
    }
  };

  // Google Calendar handlers
  const handleConnectGoogle = async () => {
    setGoogleConnecting(true);
    try {
      const { data } = await api.get("/integrations/google/authorize");
      window.location.href = data.url;
    } catch (e) {
      setGoogleConnecting(false);
      setBillingMsg(e.response?.data?.detail || "Erro ao iniciar OAuth");
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm("Desconectar Google Calendar?")) return;
    await api.delete("/integrations/google/disconnect");
    setGoogleStatus({ ...googleStatus, connected: false, email: null });
  };

  // Billing handlers
  const handleCheckout = async (planoId) => {
    setCheckoutLoading(planoId);
    setBillingMsg("");
    try {
      const { data } = await api.post("/billing/checkout", {
        plano: planoId,
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) {
      setCheckoutLoading(null);
      setBillingMsg(e.response?.data?.detail || "Erro ao iniciar checkout");
    }
  };

  return (
    <Layout title="Configurações">
      <div className="flex gap-6 h-full" data-testid="configuracoes-page">
        {/* Tab Sidebar */}
        <div className="w-48 flex-shrink-0">
          <nav className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                data-testid={`config-tab-${key}`}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-left border-b border-slate-100 last:border-0 transition-colors
                  ${tab === key ? "bg-brand-primary text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-y-auto scrollbar-thin">
          {saved && (
            <div className="mb-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <Check className="w-4 h-4" /> Salvo com sucesso!
            </div>
          )}

          {/* EQUIPE */}
          {tab === "equipe" && (
            <div>
              <h2 className="font-display font-bold text-xl text-slate-900 mb-5">Equipe</h2>
              <div className="space-y-3 mb-6">
                {operadores.map((op) => (
                  <div key={op.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center">
                      <span className="font-bold text-brand-primary text-sm">{op.nome?.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">{op.nome}</p>
                      <p className="text-xs text-slate-400">{op.email} · <span className="capitalize">{op.nivel}</span></p>
                    </div>
                    {isAdmin() && op.email !== user?.email && (
                      <button onClick={() => handleDeleteOp(op.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isAdmin() && (
                <div className="border border-dashed border-slate-300 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-700 text-sm mb-3">Adicionar Operador</h3>
                  <form onSubmit={handleCreateOp} className="grid grid-cols-2 gap-3">
                    <input value={newOp.nome} onChange={(e) => setNewOp({ ...newOp, nome: e.target.value })} placeholder="Nome completo" required className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary" />
                    <input value={newOp.email} onChange={(e) => setNewOp({ ...newOp, email: e.target.value })} placeholder="Email" type="email" required className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary" />
                    <input value={newOp.senha} onChange={(e) => setNewOp({ ...newOp, senha: e.target.value })} placeholder="Senha" type="password" required className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary" />
                    <select value={newOp.nivel} onChange={(e) => setNewOp({ ...newOp, nivel: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
                      <option value="operador">Operador</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="col-span-2 bg-brand-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Adicionar
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* PROFISSIONAIS */}
          {tab === "profissionais" && (
            <div>
              <h2 className="font-display font-bold text-xl text-slate-900 mb-5">Profissionais</h2>
              <div className="space-y-3 mb-6">
                {profissionais.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Stethoscope className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">{p.nome}</p>
                      <p className="text-xs text-slate-400">{p.especialidade} · {p.tipo}</p>
                      {p.calendar_id && <p className="text-xs text-slate-300 font-mono truncate">{p.calendar_id}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                    {isAdmin() && (
                      <button onClick={() => handleDeleteProf(p.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isAdmin() && (
                <div className="border border-dashed border-slate-300 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-700 text-sm mb-3">Adicionar Profissional</h3>
                  <form onSubmit={handleCreateProf} className="grid grid-cols-2 gap-3">
                    <input value={newProf.nome} onChange={(e) => setNewProf({ ...newProf, nome: e.target.value })} placeholder="Nome completo" required className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary" />
                    <input value={newProf.especialidade} onChange={(e) => setNewProf({ ...newProf, especialidade: e.target.value })} placeholder="Especialidade" className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary" />
                    <select value={newProf.tipo} onChange={(e) => setNewProf({ ...newProf, tipo: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
                      <option value="medico">Médico</option>
                      <option value="dentista">Dentista</option>
                      <option value="fisioterapeuta">Fisioterapeuta</option>
                      <option value="psicologo">Psicólogo</option>
                    </select>
                    <input value={newProf.calendar_id} onChange={(e) => setNewProf({ ...newProf, calendar_id: e.target.value })} placeholder="Google Calendar ID (email)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary" />
                    <button type="submit" className="col-span-2 bg-brand-secondary text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-secondary/90 transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Adicionar Profissional
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* HORARIOS */}
          {tab === "horarios" && (
            <div>
              <h2 className="font-display font-bold text-xl text-slate-900 mb-5">Horários de Atendimento</h2>
              <div className="space-y-4 max-w-sm">
                {[["horario_inicio", "Horário de Início"], ["horario_fim", "Horário de Término"]].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                    <input
                      type="time"
                      defaultValue={localConfig[key] || ""}
                      onBlur={(e) => saveConfig(key, e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MENSAGENS */}
          {tab === "mensagens" && (
            <div>
              <h2 className="font-display font-bold text-xl text-slate-900 mb-5">Mensagens Automáticas</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Mensagem fora do horário</label>
                  <textarea
                    defaultValue={localConfig.mensagem_fora_horario || ""}
                    onBlur={(e) => saveConfig("mensagem_fora_horario", e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICAÇÕES */}
          {tab === "notificacoes" && (
            <div>
              <h2 className="font-display font-bold text-xl text-slate-900 mb-5">Notificações</h2>

              {/* SLA */}
              <div className="space-y-4 max-w-sm mb-8">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">SLA de resposta humana (minutos)</label>
                  <input
                    type="number"
                    min="1" max="60"
                    defaultValue={localConfig.sla_resposta_humana || "5"}
                    onBlur={(e) => saveConfig("sla_resposta_humana", e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary w-24"
                  />
                  <p className="text-xs text-slate-400 mt-1">Cards ficam vermelhos após este tempo sem ação</p>
                </div>
              </div>

              {/* Web Push */}
              <div className="border-t border-slate-100 pt-6">
                <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-brand-primary" /> Notificações no Navegador
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Receba alertas de novas escalações mesmo com o ClinicaPanel em segundo plano.
                </p>

                {!pushStatus.supported && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Seu navegador não suporta Web Push.
                  </p>
                )}

                {pushStatus.supported && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {!pushStatus.subscribed ? (
                      <button
                        onClick={handleEnablePush}
                        disabled={pushStatus.loading}
                        data-testid="btn-push-enable"
                        className="bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        <BellRing className="w-4 h-4" /> Ativar notificações
                      </button>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium">
                          <Check className="w-4 h-4" /> Ativadas neste dispositivo
                        </span>
                        <button
                          onClick={handleTestPush}
                          data-testid="btn-push-test"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5" /> Testar
                        </button>
                        <button
                          onClick={handleDisablePush}
                          disabled={pushStatus.loading}
                          data-testid="btn-push-disable"
                          className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5"
                        >
                          <BellOff className="w-3.5 h-3.5" /> Desativar
                        </button>
                      </>
                    )}
                  </div>
                )}
                {pushMsg && (
                  <p className="mt-3 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    {pushMsg}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* INTEGRAÇÕES */}
          {tab === "integracoes" && tenant && (
            <div>
              <h2 className="font-display font-bold text-xl text-slate-900 mb-5">Integrações</h2>

              {/* Google Calendar Card */}
              <div className="mb-6 rounded-xl border border-slate-200 p-5 bg-gradient-to-br from-blue-50/40 to-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">Google Calendar</h3>
                    <p className="text-xs text-slate-500">Sincronize agendamentos com a agenda Google da clínica</p>
                  </div>
                  {googleStatus.connected ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">Conectado</span>
                  ) : googleStatus.configured ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">Não conectado</span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Não configurado</span>
                  )}
                </div>
                {googleStatus.connected ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Conectado como <span className="font-medium">{googleStatus.email || "—"}</span>
                    </p>
                    {isAdmin() && (
                      <button
                        onClick={handleDisconnectGoogle}
                        data-testid="btn-google-disconnect"
                        className="flex items-center gap-1.5 text-sm text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg"
                      >
                        <Unlink className="w-3.5 h-3.5" /> Desconectar
                      </button>
                    )}
                  </div>
                ) : isAdmin() && googleStatus.configured ? (
                  <button
                    onClick={handleConnectGoogle}
                    disabled={googleConnecting}
                    data-testid="btn-google-connect"
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {googleConnecting ? "Redirecionando..." : "Conectar com Google"}
                  </button>
                ) : (
                  <p className="text-xs text-slate-500">
                    {!googleStatus.configured
                      ? "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no servidor."
                      : "Apenas administradores podem conectar."}
                  </p>
                )}
                {billingMsg && (
                  <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{billingMsg}</p>
                )}
              </div>

              {/* Detalhes técnicos */}
              <h3 className="font-semibold text-slate-700 text-sm mb-3 mt-6">Detalhes técnicos</h3>
              <div className="space-y-2">
                {[
                  ["Instância Evolution API", tenant.instancia_evolution],
                  ["URL n8n", tenant.url_n8n || "Não configurado"],
                  ["URL Evolution API", tenant.url_evolution || "Não configurado"],
                  ["Webhook Secret", tenant.webhook_secret],
                  ["Slug / Subdomínio", tenant.slug],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm font-medium text-slate-600">{label}</span>
                    <span className="text-sm font-mono text-slate-800 bg-white px-2 py-1 rounded border border-slate-200">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PLANO */}
          {tab === "plano" && tenant && (
            <div>
              <h2 className="font-display font-bold text-xl text-slate-900 mb-5">Plano Atual</h2>
              <div className="bg-gradient-to-br from-brand-primary/5 to-brand-info/5 rounded-xl border border-brand-primary/20 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Seu plano</p>
                    <h3 className="font-display font-bold text-2xl text-slate-900 capitalize">{tenant.plano}</h3>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${PLANO_INFO[tenant.plano]?.color || "bg-slate-100 text-slate-700"}`}>
                    {PLANO_INFO[tenant.plano]?.nome || tenant.plano}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Limite", PLANO_INFO[tenant.plano]?.limite || "-"],
                    ["Status", tenant.status],
                    ["Membro desde", new Date(tenant.criado_em).toLocaleDateString("pt-BR")],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-white/60 rounded-lg p-3">
                      <p className="text-xs text-slate-400">{k}</p>
                      <p className="font-semibold text-slate-800 text-sm capitalize">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upgrade options */}
              {isAdmin() && plans.length > 0 && (
                <>
                  <h3 className="font-display font-bold text-lg text-slate-900 mb-3">Fazer upgrade</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6" data-testid="billing-plans">
                    {plans.map((p) => (
                      <div key={p.id} className={`rounded-xl border p-4 transition-all
                        ${tenant.plano === p.id ? "border-brand-primary bg-brand-primary/5" : "border-slate-200 hover:border-brand-primary/50 hover:shadow-md"}`}
                        data-testid={`plan-card-${p.id}`}
                      >
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{p.nome}</p>
                        <p className="font-display font-bold text-2xl text-slate-900 mt-1">
                          R$ {p.amount.toFixed(2).replace(".", ",")}
                          <span className="text-sm font-normal text-slate-500">/mês</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {p.limite_conversas === -1 ? "Conversas ilimitadas" : `${p.limite_conversas} conversas/mês`}
                        </p>
                        <button
                          onClick={() => handleCheckout(p.id)}
                          disabled={checkoutLoading === p.id || tenant.plano === p.id}
                          data-testid={`btn-checkout-${p.id}`}
                          className={`mt-4 w-full py-2 rounded-lg text-sm font-semibold transition-all
                            ${tenant.plano === p.id
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-brand-primary hover:bg-brand-primary/90 text-white"}`}
                        >
                          {tenant.plano === p.id ? "Plano atual" : checkoutLoading === p.id ? "Redirecionando..." : "Assinar"}
                        </button>
                      </div>
                    ))}
                  </div>
                  {billingMsg && (
                    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{billingMsg}</p>
                  )}

                  {/* Histórico de transações */}
                  {transactions.length > 0 && (
                    <>
                      <h3 className="font-semibold text-slate-700 text-sm mb-3 mt-6">Histórico de pagamentos</h3>
                      <div className="space-y-2">
                        {transactions.map((t) => (
                          <div key={t.id || t.session_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div>
                              <p className="text-sm font-medium text-slate-800 capitalize">{t.plano}</p>
                              <p className="text-xs text-slate-400">{new Date(t.criado_em).toLocaleString("pt-BR")}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-700">
                                R$ {Number(t.amount).toFixed(2).replace(".", ",")}
                              </p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                ${t.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" :
                                  t.payment_status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                  "bg-slate-100 text-slate-600"}`}>
                                {t.payment_status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
