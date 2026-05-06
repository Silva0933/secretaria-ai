import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Clock, User, AlertCircle, GripVertical } from "lucide-react";

const COLUMNS = [
  { key: "novo_contato", label: "Novo Contato", color: "bg-yellow-50 border-yellow-200", badge: "bg-yellow-100 text-yellow-800" },
  { key: "em_atendimento", label: "Em Atendimento", color: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-800" },
  { key: "agendando", label: "Agendando", color: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-800" },
  { key: "agendado", label: "Agendado", color: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-800" },
  { key: "confirmado", label: "Confirmado", color: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-100 text-emerald-800" },
  { key: "aguardando_humano", label: "Aguardando Humano", color: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-800", urgent: true },
  { key: "remarcando", label: "Remarcando", color: "bg-purple-50 border-purple-200", badge: "bg-purple-100 text-purple-800" },
  { key: "atendido", label: "Atendido", color: "bg-slate-50 border-slate-200", badge: "bg-slate-100 text-slate-600" },
];

function timeSince(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000 / 60);
  if (diff < 1) return "agora";
  if (diff < 60) return `${diff}min`;
  return `${Math.floor(diff / 60)}h`;
}

function isUrgent(card) {
  if (card.status !== "aguardando_humano") return false;
  const diff = (Date.now() - new Date(card.tempo_no_status_desde)) / 1000 / 60;
  return diff > 5;
}

function KanbanCard({ card, onDragStart, navigate }) {
  const urgent = isUrgent(card);
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      data-testid={`kanban-card-${card.telefone}`}
      className={`kanban-card bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing select-none
        ${urgent ? "urgent-card border-red-400" : "border-slate-200"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-primary font-bold text-xs">{card.nome_paciente?.charAt(0) || "?"}</span>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-xs leading-tight">{card.nome_paciente || "Paciente"}</p>
            <p className="text-xs text-slate-400 font-mono">{card.telefone}</p>
          </div>
        </div>
        {urgent && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 animate-pulse" />}
      </div>

      {/* Appointment */}
      {card.proximo_agendamento && (
        <div className="flex items-center gap-1 mb-2 text-xs text-slate-500">
          <User className="w-3 h-3" />
          <span className="truncate">{card.profissional_nome || "Profissional"}</span>
          <span className="mx-1">·</span>
          <span>{new Date(card.proximo_agendamento).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
        </div>
      )}

      {/* Last message */}
      {card.ultima_mensagem && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-2 bg-slate-50 p-1.5 rounded">
          "{card.ultima_mensagem}"
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Clock className={`w-3 h-3 ${urgent ? "text-red-500" : "text-slate-400"}`} />
          <span className={`text-xs ${urgent ? "text-red-500 font-bold" : "text-slate-400"}`}>
            {timeSince(card.ultima_atividade)}
          </span>
        </div>
        <button
          onClick={() => navigate(`/conversas/${card.telefone}`)}
          data-testid={`kanban-open-chat-${card.telefone}`}
          className="flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary/80 font-medium"
        >
          <MessageSquare className="w-3 h-3" />
          Chat
        </button>
      </div>

      {urgent && (
        <div className="mt-2 pt-2 border-t border-red-100">
          <button
            onClick={() => navigate(`/conversas/${card.telefone}`)}
            className="w-full bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-1.5 rounded-md transition-colors"
            data-testid={`kanban-assumir-urgente-${card.telefone}`}
          >
            Assumir Agora!
          </button>
        </div>
      )}
    </div>
  );
}

export default function Kanban() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [columns, setColumns] = useState({});
  const [loading, setLoading] = useState(true);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [showCancelado, setShowCancelado] = useState(false);
  const wsRef = useRef(null);

  const loadKanban = useCallback(async () => {
    const res = await api.get("/kanban");
    setColumns(res.data.columns || {});
    setLoading(false);
  }, []);

  useEffect(() => { loadKanban(); }, [loadKanban]);

  // WebSocket real-time
  useEffect(() => {
    if (!user?.tenant_id) return;
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const token = localStorage.getItem("cp_token");
    const wsUrl = BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(`${wsUrl}/api/ws/${user.tenant_id}?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "kanban_atualizado") loadKanban();
    };
    return () => ws.close();
  }, [user?.tenant_id, loadKanban]);

  const handleDragStart = (e, card) => {
    e.dataTransfer.setData("card", JSON.stringify(card));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    setDragOverCol(colKey);
  };

  const handleDragLeave = () => setDragOverCol(null);

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const card = JSON.parse(e.dataTransfer.getData("card"));
    if (card.status === newStatus) return;

    // Optimistic update
    setColumns((prev) => {
      const next = { ...prev };
      const oldCol = [...(next[card.status] || [])].filter((c) => c.id !== card.id);
      const newCard = { ...card, status: newStatus };
      const newCol = [...(next[newStatus] || []), newCard];
      return { ...next, [card.status]: oldCol, [newStatus]: newCol };
    });

    try {
      await api.patch(`/kanban/${card.id}/status`, { status: newStatus });
    } catch (err) {
      console.error(err);
      loadKanban(); // revert on error
    }
  };

  const visibleCols = showCancelado ? COLUMNS : COLUMNS.filter((c) => c.key !== "cancelado");

  if (loading) return (
    <Layout title="Kanban de Atendimento">
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout title="Kanban de Atendimento">
      <div data-testid="kanban-page">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">
              {Object.values(columns).flat().length} pacientes ativos
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showCancelado}
              onChange={(e) => setShowCancelado(e.target.checked)}
              className="rounded"
            />
            Mostrar Cancelados
          </label>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4 kanban-scroll" data-testid="kanban-board">
          {visibleCols.map((col) => {
            const cards = columns[col.key] || [];
            const isDragOver = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                data-testid={`kanban-col-${col.key}`}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.key)}
                className={`flex-shrink-0 w-72 rounded-xl border-2 flex flex-col transition-all duration-150
                  ${isDragOver ? "drag-over-col scale-[1.01]" : col.color}
                  ${col.urgent && cards.length > 0 ? "bg-gradient-to-b from-red-50 to-red-100/50 border-red-200" : ""}`}
              >
                {/* Column Header */}
                <div className={`px-3 py-2.5 flex items-center justify-between border-b ${col.urgent && cards.length > 0 ? "border-red-200" : "border-slate-200/50"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{col.label}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.urgent && cards.length > 0 ? "bg-red-500 text-white animate-pulse" : col.badge}`}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 flex-1 min-h-[100px] overflow-y-auto scrollbar-thin max-h-[calc(100vh-260px)]">
                  {cards.map((card) => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      onDragStart={handleDragStart}
                      navigate={navigate}
                    />
                  ))}
                  {cards.length === 0 && !isDragOver && (
                    <div className="flex items-center justify-center h-16 text-slate-300 text-xs">
                      Sem pacientes
                    </div>
                  )}
                  {isDragOver && (
                    <div className="h-20 border-2 border-dashed border-brand-info/50 rounded-lg flex items-center justify-center">
                      <p className="text-xs text-brand-info font-medium">Soltar aqui</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
