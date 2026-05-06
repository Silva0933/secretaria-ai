import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import {
  MessageSquare, Calendar, AlertCircle, TrendingUp,
  Clock, ChevronRight, Bot, User
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { useNavigate } from "react-router-dom";

const STATUS_LABEL = {
  novo_contato: "Novo Contato", em_atendimento: "Em Atendimento",
  agendando: "Agendando", agendado: "Agendado", confirmado: "Confirmado",
  aguardando_humano: "Aguardando Humano", remarcando: "Remarcando",
  cancelado: "Cancelado", atendido: "Atendido",
};
const STATUS_COLOR = {
  novo_contato: "bg-yellow-100 text-yellow-800",
  em_atendimento: "bg-blue-100 text-blue-800",
  agendando: "bg-orange-100 text-orange-800",
  agendado: "bg-green-100 text-green-800",
  confirmado: "bg-emerald-100 text-emerald-800",
  aguardando_humano: "bg-red-100 text-red-800",
  remarcando: "bg-purple-100 text-purple-800",
  cancelado: "bg-slate-100 text-slate-600",
  atendido: "bg-gray-100 text-gray-600",
};

function MetricCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm slide-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="font-display font-bold text-3xl text-slate-900">{value ?? "—"}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [metricas, setMetricas] = useState(null);
  const [grafico, setGrafico] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [escalacoes, setEscalacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/metricas"),
      api.get("/dashboard/grafico-mensagens"),
      api.get("/dashboard/agenda-hoje"),
      api.get("/dashboard/escalacoes-recentes"),
    ]).then(([m, g, c, e]) => {
      setMetricas(m.data);
      setGrafico(g.data.data || []);
      setConsultas(c.data.consultas || []);
      setEscalacoes(e.data.escalacoes || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Layout title="Dashboard">
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout title="Dashboard">
      <div className="space-y-6" data-testid="dashboard-page">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Conversas Ativas"
            value={metricas?.conversas_ativas}
            icon={MessageSquare}
            color="bg-blue-50 text-blue-600"
            sub="Hoje"
          />
          <MetricCard
            label="Agendamentos"
            value={metricas?.agendamentos_confirmados}
            icon={Calendar}
            color="bg-emerald-50 text-emerald-600"
            sub="Confirmados"
          />
          <MetricCard
            label="Escalações"
            value={metricas?.escalacoes_pendentes}
            icon={AlertCircle}
            color="bg-red-50 text-red-600"
            sub="Pendentes"
          />
          <MetricCard
            label="Taxa IA"
            value={`${metricas?.taxa_resolucao_ia ?? 0}%`}
            icon={TrendingUp}
            color="bg-indigo-50 text-indigo-600"
            sub="Resolvidos pela IA"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Volume Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-display font-bold text-base text-slate-900 mb-4">Volume de Mensagens (24h)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={grafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} tickFormatter={(v) => v.split(":")[0] + "h"} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                <Line type="monotone" dataKey="mensagens" stroke="#0F2D5E" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Today's appointments */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Consultas de Hoje</h3>
              <button
                onClick={() => navigate("/agendamentos")}
                className="text-xs text-brand-primary hover:underline flex items-center gap-1"
              >
                Ver todas <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {consultas.length === 0 ? (
              <div className="flex items-center justify-center h-36 text-slate-400 text-sm">
                Nenhuma consulta hoje
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {consultas.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/conversas/${c.telefone}`)}>
                    <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-primary font-bold text-xs">{c.nome_paciente?.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.nome_paciente}</p>
                      <p className="text-xs text-slate-400">{c.profissional || "Sem profissional"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status] || "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Escalations */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-base text-slate-900">Escalações Recentes</h3>
            <button onClick={() => navigate("/alertas")} className="text-xs text-brand-primary hover:underline flex items-center gap-1">
              Ver todas <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {escalacoes.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Nenhuma escalação recente</p>
          ) : (
            <div className="space-y-2">
              {escalacoes.slice(0, 5).map((e) => (
                <div key={e.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-slate-50
                  ${!e.resolvido_em ? "border-red-200 bg-red-50/50" : "border-slate-100"}`}
                  onClick={() => navigate(`/conversas/${e.telefone}`)}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${!e.resolvido_em ? "bg-red-500" : "bg-emerald-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{e.nome_paciente || e.telefone}</p>
                    <p className="text-xs text-slate-400 truncate">{e.motivo}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Clock className="w-3.5 h-3.5 text-slate-400 inline mr-1" />
                    <span className="text-xs text-slate-400">
                      {new Date(e.recebido_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
