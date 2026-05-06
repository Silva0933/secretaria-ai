import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Clock, CheckCircle, UserCheck, Bell, BellOff } from "lucide-react";

function timeSince(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000 / 60);
  if (diff < 1) return "agora mesmo";
  if (diff < 60) return `há ${diff} minuto${diff > 1 ? "s" : ""}`;
  if (diff < 1440) return `há ${Math.floor(diff / 60)}h${Math.floor(diff % 60) > 0 ? ` ${Math.floor(diff % 60)}min` : ""}`;
  return `há ${Math.floor(diff / 1440)} dia${Math.floor(diff / 1440) > 1 ? "s" : ""}`;
}

function isUrgent(esc) {
  if (esc.resolvido_em) return false;
  const diff = (Date.now() - new Date(esc.recebido_em)) / 1000 / 60;
  return diff > 5;
}

export default function Alertas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [escalacoes, setEscalacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pendente");
  const [soundOn, setSoundOn] = useState(true);
  const wsRef = useRef(null);
  const audioRef = useRef(null);

  const loadEscalacoes = async () => {
    const params = filter === "pendente" ? "?pendente=true" : filter === "resolvido" ? "?pendente=false" : "";
    const res = await api.get(`/escalacoes${params}`);
    setEscalacoes(res.data.escalacoes || []);
    setLoading(false);
  };

  useEffect(() => { loadEscalacoes(); }, [filter]);

  // WebSocket for real-time
  useEffect(() => {
    if (!user?.tenant_id) return;
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const token = localStorage.getItem("cp_token");
    const wsUrl = BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(`${wsUrl}/api/ws/${user.tenant_id}?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "nova_escalacao") {
        loadEscalacoes();
        if (soundOn && "Notification" in window) {
          Notification.requestPermission().then((p) => {
            if (p === "granted") new Notification("Nova escalação!", { body: msg.data.motivo || "Paciente aguardando" });
          });
        }
      }
    };
    return () => ws.close();
  }, [user?.tenant_id, soundOn]);

  const handleResolver = async (id) => {
    await api.patch(`/escalacoes/${id}/resolver`);
    loadEscalacoes();
  };

  const pendentes = escalacoes.filter((e) => !e.resolvido_em);
  const urgentes = pendentes.filter(isUrgent);

  return (
    <Layout title="Alertas e Escalações">
      <div className="space-y-4" data-testid="alertas-page">
        {/* Summary Bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pendentes", value: pendentes.length, color: "bg-red-50 border-red-200 text-red-700", icon: AlertCircle },
            { label: "Urgentes (>5min)", value: urgentes.length, color: "bg-orange-50 border-orange-200 text-orange-700", icon: Clock },
            { label: "Resolvidas hoje", value: escalacoes.filter((e) => e.resolvido_em).length, color: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: CheckCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${color}`}>
              <Icon className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="text-2xl font-display font-bold">{value}</p>
                <p className="text-xs font-medium opacity-80">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter + Sound */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {[["pendente", "Pendentes"], ["resolvido", "Resolvidas"], ["", "Todas"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                data-testid={`filter-${label.toLowerCase()}`}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all
                  ${filter === val ? "bg-brand-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSoundOn(!soundOn)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
              ${soundOn ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"}`}
            data-testid="toggle-sound"
          >
            {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            {soundOn ? "Som Ativo" : "Som Off"}
          </button>
        </div>

        {/* Escalation List */}
        <div className="space-y-3">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
            </div>
          )}

          {!loading && escalacoes.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="font-display font-bold text-slate-700 text-lg">Nenhuma escalação pendente!</p>
              <p className="text-slate-400 text-sm mt-1">Tudo está sob controle por enquanto.</p>
            </div>
          )}

          {escalacoes.map((esc) => {
            const urgent = isUrgent(esc);
            const resolved = !!esc.resolvido_em;
            return (
              <div
                key={esc.id}
                data-testid={`escalacao-${esc.id}`}
                className={`bg-white rounded-xl border p-4 transition-all
                  ${urgent && !resolved ? "border-red-300 shadow-red-100 shadow-md" : "border-slate-200"}
                  ${resolved ? "opacity-70" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                    ${resolved ? "bg-emerald-100" : urgent ? "bg-red-100" : "bg-orange-100"}`}
                  >
                    {resolved
                      ? <CheckCircle className="w-5 h-5 text-emerald-600" />
                      : <AlertCircle className={`w-5 h-5 ${urgent ? "text-red-600 animate-pulse" : "text-orange-600"}`} />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900">{esc.nome_paciente || esc.telefone}</p>
                      {urgent && !resolved && (
                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                          URGENTE
                        </span>
                      )}
                      {resolved && (
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          Resolvida
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{esc.motivo || "Sem descrição"}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Recebida {timeSince(esc.recebido_em)}
                      </span>
                      {esc.resolvido_em && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="w-3 h-3" />
                          Resolvida {timeSince(esc.resolvido_em)}
                        </span>
                      )}
                      {esc.operador_nome && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <UserCheck className="w-3 h-3" />
                          {esc.operador_nome}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/conversas/${esc.telefone}`)}
                      data-testid={`esc-chat-${esc.id}`}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Abrir Chat
                    </button>
                    {!resolved && (
                      <button
                        onClick={() => handleResolver(esc.id)}
                        data-testid={`esc-resolver-${esc.id}`}
                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Resolver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
