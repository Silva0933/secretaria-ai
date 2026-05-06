import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const MAX_POLLS = 6;
const POLL_INTERVAL = 2500;

export default function BillingSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState("polling"); // polling | paid | failed | expired | error
  const [details, setDetails] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const stopped = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setDetails({ error: "Session ID ausente" });
      return;
    }

    let cancelled = false;

    const poll = async (n) => {
      if (cancelled || stopped.current) return;
      try {
        const { data } = await api.get(`/billing/checkout/status/${sessionId}`);
        setDetails(data);
        if (data.payment_status === "paid") {
          setStatus("paid");
          stopped.current = true;
          return;
        }
        if (data.status === "expired" || data.payment_status === "expired") {
          setStatus("expired");
          stopped.current = true;
          return;
        }
        if (n + 1 >= MAX_POLLS) {
          setStatus("error");
          stopped.current = true;
          return;
        }
        setAttempt(n + 1);
        setTimeout(() => poll(n + 1), POLL_INTERVAL);
      } catch (e) {
        setStatus("error");
        setDetails({ error: e.response?.data?.detail || e.message });
      }
    };

    poll(0);
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8" data-testid="billing-success-page">
        {status === "polling" && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto text-brand-primary animate-spin mb-4" />
            <h1 className="font-display font-bold text-2xl text-slate-900 mb-2">Confirmando pagamento...</h1>
            <p className="text-slate-500">Tentativa {attempt + 1} de {MAX_POLLS}</p>
          </div>
        )}

        {status === "paid" && (
          <div className="text-center" data-testid="billing-paid">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="font-display font-bold text-2xl text-slate-900 mb-2">Pagamento confirmado!</h1>
            <p className="text-slate-600 mb-6">Seu plano <strong className="capitalize">{details?.plano}</strong> foi ativado com sucesso.</p>
            <button
              onClick={() => navigate("/configuracoes")}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
              data-testid="btn-back-to-config"
            >
              Voltar para Configurações
            </button>
          </div>
        )}

        {(status === "expired" || status === "failed" || status === "error") && (
          <div className="text-center" data-testid="billing-error">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="font-display font-bold text-2xl text-slate-900 mb-2">
              {status === "expired" ? "Sessão expirada" : "Pagamento não confirmado"}
            </h1>
            <p className="text-slate-600 mb-6">
              {details?.error || "Não conseguimos confirmar seu pagamento. Tente novamente."}
            </p>
            <button
              onClick={() => navigate("/configuracoes")}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
