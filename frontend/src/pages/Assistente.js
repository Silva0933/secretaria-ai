import { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Bot, Send, User, Loader2, Zap } from "lucide-react";

const CHIPS = [
  { label: "Ver agenda de hoje", text: "Me mostra a agenda de hoje completa" },
  { label: "Resumir conversas", text: "Quantas conversas ativas temos hoje e qual o status de cada uma?" },
  { label: "Escalações pendentes", text: "Quais escalações estão pendentes no momento?" },
  { label: "Dicas de atendimento", text: "Dê dicas para melhorar o atendimento ao paciente" },
];

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*)/gm, '<h3 class="font-bold text-slate-800 mt-3 mb-1 text-sm">$1</h3>')
    .replace(/^## (.*)/gm, '<h2 class="font-bold text-slate-900 mt-4 mb-2">$1</h2>')
    .replace(/^- (.*)/gm, '<li class="ml-4 list-disc text-slate-700">$1</li>')
    .replace(/\n/g, '<br/>');
}

export default function Assistente() {
  const [mensagens, setMensagens] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    api.get("/assistente/historico").then((r) => {
      const hist = r.data.historico || [];
      const msgs = [];
      for (const h of hist) {
        msgs.push({ tipo: "user", conteudo: h.mensagem, ts: h.timestamp });
        if (h.resposta) msgs.push({ tipo: "bot", conteudo: h.resposta, ts: h.timestamp });
      }
      setMensagens(msgs);
    }).catch(() => {}).finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, loading]);

  const sendMessage = async (texto) => {
    const msg = texto || input;
    if (!msg.trim()) return;
    setInput("");
    const userMsg = { tipo: "user", conteudo: msg, ts: new Date().toISOString() };
    setMensagens((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await api.post("/assistente", { mensagem: msg });
      setMensagens((prev) => [...prev, {
        tipo: "bot", conteudo: res.data.resposta, ts: res.data.timestamp,
      }]);
    } catch (err) {
      setMensagens((prev) => [...prev, {
        tipo: "bot", conteudo: "Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.", ts: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Assistente IA Interno">
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto" data-testid="assistente-page">
        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Bot className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="font-display font-bold text-slate-900">Assistente IA</p>
            <p className="text-xs text-slate-400">Powered by Google Gemini · Responde em português</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-600 font-medium">Online</span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex-1 p-4 overflow-y-auto space-y-4 chat-scroll">
            {loadingHistory && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}

            {!loadingHistory && mensagens.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-indigo-500" />
                </div>
                <p className="font-display font-bold text-slate-700 mb-2">Como posso ajudar?</p>
                <p className="text-sm text-slate-400 mb-6">Use os comandos rápidos ou escreva sua pergunta.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {CHIPS.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => sendMessage(c.text)}
                      data-testid={`chip-${c.label.replace(/\s/g, '-')}`}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full transition-colors border border-indigo-200"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensagens.map((m, i) => (
              <div key={i} className={`flex gap-3 slide-in ${m.tipo === "user" ? "justify-end" : "justify-start"}`}>
                {m.tipo === "bot" && (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-indigo-600" />
                  </div>
                )}
                <div className={`max-w-[80%] px-4 py-3 rounded-xl text-sm
                  ${m.tipo === "user"
                    ? "bg-brand-primary text-white rounded-br-sm"
                    : "bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  {m.tipo === "bot" ? (
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.conteudo) }} />
                  ) : (
                    <p>{m.conteudo}</p>
                  )}
                  <p className={`text-xs mt-1.5 ${m.tipo === "user" ? "text-white/60" : "text-slate-400"}`}>
                    {new Date(m.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {m.tipo === "user" && (
                  <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-brand-primary" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start slide-in">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick Chips */}
          {mensagens.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto scrollbar-thin">
              {CHIPS.map((c) => (
                <button
                  key={c.label}
                  onClick={() => sendMessage(c.text)}
                  disabled={loading}
                  className="flex-shrink-0 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-full transition-colors disabled:opacity-50"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="p-3 border-t border-slate-100 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreva um comando ou pergunta..."
              disabled={loading}
              data-testid="assistente-input"
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary focus:bg-white transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              data-testid="assistente-send-btn"
              className="bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg transition-all flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
