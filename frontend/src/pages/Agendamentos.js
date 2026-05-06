import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Calendar, ChevronLeft, ChevronRight, User, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_COLOR = {
  confirmado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  agendado: "bg-green-100 text-green-800 border-green-200",
  aguardando_humano: "bg-yellow-100 text-yellow-800 border-yellow-200",
  cancelado: "bg-red-100 text-red-800 border-red-200",
  remarcando: "bg-purple-100 text-purple-800 border-purple-200",
};
const STATUS_ICON = {
  confirmado: CheckCircle, agendado: CheckCircle,
  cancelado: XCircle, aguardando_humano: AlertCircle,
};

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function generateCalendarDays(year, month) {
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < first; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

export default function Agendamentos() {
  const navigate = useNavigate();
  const [profissionais, setProfissionais] = useState([]);
  const [profFiltro, setProfFiltro] = useState("todos");
  const [view, setView] = useState("mensal");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    api.get("/config/profissionais").then((r) => setProfissionais(r.data.profissionais || []));
    api.get("/kanban").then((r) => {
      const allCards = Object.values(r.data.columns || {}).flat();
      const withAppt = allCards.filter((c) => c.proximo_agendamento);
      setAppointments(withAppt);
    });
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const calDays = generateCalendarDays(year, month);

  const getApptForDay = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return appointments.filter((a) => {
      const apptDate = a.proximo_agendamento?.split("T")[0];
      const matchProf = profFiltro === "todos" || a.profissional_id === profFiltro;
      return apptDate === dateStr && matchProf;
    });
  };

  const navigate_month = (dir) => {
    setCurrentDate(new Date(year, month + dir, 1));
  };

  const today = new Date();
  const todayAppts = getApptForDay(today.getDate());
  const selectedAppts = selectedDay ? getApptForDay(selectedDay) : [];

  return (
    <Layout title="Agendamentos">
      <div className="space-y-4" data-testid="agendamentos-page">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
              {["mensal", "semanal"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-2 text-sm font-medium transition-colors
                    ${view === v ? "bg-brand-primary text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {/* Prof filter */}
            <select
              value={profFiltro}
              onChange={(e) => setProfFiltro(e.target.value)}
              data-testid="agenda-prof-filter"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
            >
              <option value="todos">Todos os profissionais</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          {/* Month nav */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate_month(-1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-display font-bold text-slate-900 min-w-[160px] text-center">
              {MONTHS[month]} {year}
            </span>
            <button onClick={() => navigate_month(1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calDays.map((day, i) => {
                const appts = getApptForDay(day);
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const isSelected = day === selectedDay;
                return (
                  <button
                    key={i}
                    onClick={() => day && setSelectedDay(day)}
                    data-testid={day ? `cal-day-${day}` : undefined}
                    className={`relative h-14 rounded-lg text-sm flex flex-col items-center pt-1.5 transition-all
                      ${!day ? "cursor-default" : "hover:bg-slate-50 cursor-pointer"}
                      ${isToday ? "ring-2 ring-brand-primary/30" : ""}
                      ${isSelected ? "bg-brand-primary/10" : ""}`}
                  >
                    {day && (
                      <>
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium
                          ${isToday ? "bg-brand-primary text-white" : "text-slate-700"}`}>
                          {day}
                        </span>
                        {appts.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {appts.slice(0, 3).map((_, idx) => (
                              <div key={idx} className="w-1.5 h-1.5 rounded-full bg-brand-secondary" />
                            ))}
                          </div>
                        )}
                        {appts.length > 0 && (
                          <span className="text-xs text-brand-secondary font-medium">{appts.length}</span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Detail */}
          <div className="space-y-4">
            {/* Selected Day */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="font-display font-bold text-sm text-slate-900 mb-3">
                {selectedDay
                  ? `${String(selectedDay).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`
                  : "Hoje"} — {selectedAppts.length || todayAppts.length} consulta(s)
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                {(selectedDay ? selectedAppts : todayAppts).map((a) => {
                  const StatusIcon = STATUS_ICON[a.status] || CheckCircle;
                  return (
                    <div
                      key={a.id}
                      onClick={() => navigate(`/conversas/${a.telefone}`)}
                      className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-brand-primary font-bold text-xs">{a.nome_paciente?.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.nome_paciente}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(a.proximo_agendamento).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {a.profissional_nome && ` · ${a.profissional_nome}`}
                        </p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${STATUS_COLOR[a.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {a.status === "confirmado" ? "✓" : a.status === "cancelado" ? "✗" : "~"}
                      </span>
                    </div>
                  );
                })}
                {(selectedDay ? selectedAppts : todayAppts).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">Nenhuma consulta neste dia</p>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="font-display font-bold text-sm text-slate-900 mb-3">Resumo do Mês</h3>
              {profissionais.map((p) => {
                const count = appointments.filter((a) => a.profissional_id === p.id).length;
                return (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-sm text-slate-700">{p.nome}</span>
                    </div>
                    <span className="font-bold text-sm text-brand-primary">{count}</span>
                  </div>
                );
              })}
              {profissionais.length === 0 && (
                <p className="text-xs text-slate-400">Nenhum profissional cadastrado</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
