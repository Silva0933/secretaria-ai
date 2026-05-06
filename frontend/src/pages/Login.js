import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", senha: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.senha);
      if (user.role === "super_admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Email ou senha inválidos");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email, senha) => setForm({ email, senha });

  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="w-full lg:w-[480px] flex flex-col justify-center px-10 py-12 bg-white">
        {/* Logo */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center shadow-md">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-brand-primary">ClinicaPanel</h1>
              <p className="text-xs text-slate-400">Atendimento Inteligente</p>
            </div>
          </div>
          <h2 className="font-display font-bold text-3xl text-slate-900">Bem-vindo de volta</h2>
          <p className="text-slate-500 mt-1">Acesse o painel da sua clínica</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="seu@email.com"
              required
              data-testid="login-email"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                placeholder="••••••••"
                required
                data-testid="login-senha"
                className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div data-testid="login-error" className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit"
            className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : "Entrar"}
          </button>
        </form>

        {/* Demo Accounts */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">Contas de Demonstração</p>
          <div className="space-y-2">
            {[
              { label: "Clínica Moreira (Admin)", email: "admin@clinicamoreira.com", senha: "Clinica@123" },
              { label: "Clínica Moreira (Recep)", email: "recep@clinicamoreira.com", senha: "Clinica@123" },
              { label: "Clínica Silva (Admin)", email: "admin@clinicasilva.com", senha: "Clinica@123" },
            ].map(({ label, email, senha }) => (
              <button
                key={email}
                onClick={() => fillDemo(email, senha)}
                data-testid={`demo-${email.split("@")[0]}`}
                className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs text-slate-600 hover:text-slate-900 transition-colors border border-slate-100"
              >
                <span className="font-medium">{label}</span>
                <span className="text-slate-400 ml-1">— {email}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 text-center">
            <a href="/admin/login" className="text-xs text-brand-info hover:underline">
              Acessar Super Admin
            </a>
          </div>
        </div>
      </div>

      {/* Right: Hero */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <img
          src="https://static.prod-images.emergentagent.com/jobs/b90bd42a-6db5-490c-95a0-6d27dbd83125/images/df445cfd3b9b0c310176e5335e7286fede612d109cded4132a9e4d12968c48bd.png"
          alt="ClinicaPanel"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/90 to-brand-info/70" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="font-display font-bold text-4xl mb-4 leading-tight">
            Atendimento inteligente<br />para clínicas modernas
          </h2>
          <p className="text-white/80 text-lg max-w-md">
            Gerencie conversas, agendamentos e escalações com IA em um só lugar.
          </p>
          <div className="flex gap-8 mt-8">
            {[["10x", "Mais rápido"], ["98%", "Satisfação"], ["24/7", "Disponível"]].map(([val, label]) => (
              <div key={label}>
                <p className="font-display font-bold text-3xl">{val}</p>
                <p className="text-white/60 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
