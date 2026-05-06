import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, Send, MessageSquare, Calendar, User, Bot,
  UserCheck, RefreshCw, AlertCircle
} from "lucide-react";

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
const STATUS_DOT = {
  novo_contato: "bg-yellow-400", em_atendimento: "bg-blue-500",
  agendando: "bg-orange-400", agendado: "bg-green-500",
  confirmado: "bg-emerald-500", aguardando_humano: "bg-red-500",
  remarcando: "bg-purple-500", cancelado: "bg-slate-400", atendido: "bg-gray-400",
};

function timeSince(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000 / 60);
  if (diff < 1) return "agora";
  if (diff < 60) return `há ${diff} min`;
  if (diff < 1440) return `há ${Math.floor(diff / 60)}h`;
  return `há ${Math.floor(diff / 1440)}d`;
}

export default function Conversas() {
  const { telefone: paramTelefone } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversas, setConversas] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [humanoAtivo, setHumanoAtivo] = useState(false);
  const [operadorNome, setOperadorNome] = useState(null);
  const [profissional, setProfissional] = useState(null);
  const [textoEnviar, setTextoEnviar] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);

  const loadConversas = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("busca", search);
    const res = await api.get(`/conversas?${params}`);
    setConversas(res.data.conversas || []);
  }, [statusFilter, search]);

  const loadConversa = useCallback(async (tel) => {
    setLoading(true);
    try {
      const res = await api.get(`/conversas/${tel}`);
      setMensagens(res.data.mensagens || []);
      setHumanoAtivo(res.data.humano_ativo);
      setOperadorNome(res.data.operador_nome);
      setProfissional(res.data.profissional);
      setSelected(res.data.card);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadConversas(); }, [loadConversas]);
  useEffect(() => {
    if (paramTelefone) loadConversa(paramTelefone);
  }, [paramTelefone, loadConversa]);

  // WebSocket for real-time messages
  useEffect(() => {
    if (!user?.tenant_id) return;
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const token = localStorage.getItem("cp_token");
    const wsUrl = BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(`${wsUrl}/api/ws/${user.tenant_id}?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "nova_mensagem" && selected?.telefone === msg.data.telefone) {
        setMensagens((prev) => [...prev, {
          tipo: msg.data.tipo, conteudo: msg.data.mensagem,
          operador_nome: msg.data.operador_nome, enviado_em: msg.data.enviado_em,
        }]);
      }
      if (msg.event === "conversa_assumida" || msg.event === "conversa_devolvida") {
        if (selected?.telefone === msg.data.telefone) {
          setHumanoAtivo(msg.event === "conversa_assumida");
          setOperadorNome(msg.data.operador_nome || null);
        }
        loadConversas();
      }
    };
    return () => ws.close();
  }, [user?.tenant_id, selected?.telefone]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const handleSelectConversa = (c) => {
    navigate(`/conversas/${c.telefone}`);
    loadConversa(c.telefone);
  };

  const handleAssumir = async () => {
    await api.post(`/conversas/${selected.telefone}/assumir`);
    setHumanoAtivo(true);
    setOperadorNome(user.nome);
    loadConversas();
  };

  const handleDevolver = async () => {
    await api.post(`/conversas/${selected.telefone}/devolver`);
    setHumanoAtivo(false);
    setOperadorNome(null);
    loadConversas();
  };

  const handleEnviar = async (e) => {
    e.preventDefault();
    if (!textoEnviar.trim() || !humanoAtivo) return;
    const texto = textoEnviar;
    setTextoEnviar("");
    await api.post(`/conversas/${selected.telefone}/enviar`, { mensagem: texto });
    setMensagens((prev) => [...prev, {
      tipo: "operador", conteudo: texto,
      operador_nome: user.nome, enviado_em: new Date().toISOString(),
    }]);
  };

  return (
    <Layout title="Conversas">
      <div className="flex h-[calc(100vh-8rem)] gap-0 rounded-xl overflow-hidden border border-slate-200 shadow-sm" data-testid="conversas-page">
        {/* LEFT: Conversation List */}
        <div className="w-72 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-slate-100">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar paciente..."
                data-testid="conversas-search"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="conversas-status-filter"
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none text-slate-600"
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {conversas.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectConversa(c)}
                data-testid={`conversa-item-${c.telefone}`}
                className={`w-full text-left px-3 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors
                  ${selected?.telefone === c.telefone ? "bg-blue-50 border-l-2 border-l-brand-primary" : ""}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[c.status] || "bg-slate-300"}`} />
                  <span className="font-medium text-sm text-slate-800 truncate flex-1">{c.nome_paciente || "Paciente"}</span>
                  <span className="text-xs text-slate-400">{timeSince(c.ultima_atividade)}</span>
                </div>
                <p className="text-xs text-slate-500 truncate pl-4">{c.ultima_mensagem || "..."}</p>
                <div className="pl-4 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLOR[c.status] || "bg-slate-100 text-slate-600"}`}>
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                </div>
              </button>
            ))}
            {conversas.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">Nenhuma conversa encontrada</div>
            )}
          </div>
        </div>

        {/* CENTER: Chat */}
        <div className="flex-1 flex flex-col bg-[#F8FAFC]">
          {selected ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <span className="font-bold text-brand-primary text-sm">{selected.nome_paciente?.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{selected.nome_paciente}</p>
                  <p className="text-xs text-slate-400">{selected.telefone}</p>
                </div>
                {/* Status Banner */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border
                  ${humanoAtivo
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                  }`}
                  data-testid="chat-status-banner"
                >
                  {humanoAtivo ? (
                    <><UserCheck className="w-3.5 h-3.5" />{operadorNome || "Humano"} no controle</>
                  ) : (
                    <><Bot className="w-3.5 h-3.5" />IA respondendo</>
                  )}
                </div>
                {/* Action Buttons */}
                {!humanoAtivo ? (
                  <button
                    onClick={handleAssumir}
                    data-testid="btn-assumir"
                    className="bg-brand-secondary hover:bg-brand-secondary/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" />Assumir
                  </button>
                ) : user.nome === operadorNome || !operadorNome ? (
                  <button
                    onClick={handleDevolver}
                    data-testid="btn-devolver"
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />Devolver IA
                  </button>
                ) : null}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 chat-scroll">
                {loading && <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" /></div>}
                {mensagens.map((m, i) => (
                  <div key={i} className={`flex ${m.tipo === "paciente" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[70%] px-3 py-2 text-sm leading-relaxed
                      ${m.tipo === "paciente" ? "msg-paciente" : m.tipo === "ia" ? "msg-ia" : "msg-operador"}`}
                    >
                      {m.tipo !== "paciente" && (
                        <p className="text-xs font-semibold mb-1 opacity-70">
                          {m.tipo === "ia" ? "Secretária Virtual" : m.operador_nome || "Equipe"}
                        </p>
                      )}
                      <p>{m.conteudo}</p>
                      <p className="text-xs opacity-50 mt-1 text-right">
                        {new Date(m.enviado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleEnviar} className="bg-white border-t border-slate-200 p-3 flex gap-2 flex-shrink-0">
                {!humanoAtivo && (
                  <div className="flex-1 px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-400 flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    Clique em "Assumir" para responder
                  </div>
                )}
                {humanoAtivo && (
                  <>
                    <input
                      value={textoEnviar}
                      onChange={(e) => setTextoEnviar(e.target.value)}
                      placeholder="Digite uma mensagem..."
                      data-testid="chat-input"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary"
                    />
                    <button
                      type="submit"
                      disabled={!textoEnviar.trim()}
                      data-testid="chat-send-btn"
                      className="bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </>
                )}
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm">Clique em um contato à esquerda</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Patient Info */}
        <div className="w-64 bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
          {selected ? (
            <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin">
              <div className="text-center pb-3 border-b border-slate-100">
                <div className="w-14 h-14 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto mb-2">
                  <span className="font-display font-bold text-brand-primary text-xl">{selected.nome_paciente?.charAt(0)}</span>
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">{selected.nome_paciente}</h3>
                <p className="text-xs text-slate-400">{selected.telefone}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Status</p>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[selected.status] || "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABEL[selected.status] || selected.status}
                </span>
              </div>

              {profissional && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Profissional</p>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{profissional.nome}</p>
                      <p className="text-xs text-slate-400">{profissional.especialidade}</p>
                    </div>
                  </div>
                </div>
              )}

              {selected.proximo_agendamento && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Próximo Agendamento</p>
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-800 font-medium">
                      {new Date(selected.proximo_agendamento).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Última Atividade</p>
                <p className="text-xs text-slate-600">{timeSince(selected.ultima_atividade)}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-slate-300 text-center">Selecione uma conversa para ver informações do paciente</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
