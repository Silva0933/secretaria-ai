import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Eye, EyeOff, AlertCircle, KeyRound } from "lucide-react";

export default function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", senha: "", totp_code: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminLogin(form.email, form.senha, form.totp_code);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-info/20 border border-brand-info/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-brand-info" />
          </div>
          <h1 className="font-display font-bold text-2xl text-white">Super Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Acesso restrito — ClinicaPanel</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-5" data-testid="admin-login-form">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@clinicapanel.com"
                required
                data-testid="admin-login-email"
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-info/40 focus:border-brand-info transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  placeholder="••••••••"
                  required
                  data-testid="admin-login-senha"
                  className="w-full px-4 py-2.5 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-info/40 focus:border-brand-info transition-all"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <KeyRound className="w-3.5 h-3.5 inline mr-1" />
                Código 2FA (TOTP)
              </label>
              <input
                type="text"
                value={form.totp_code}
                onChange={(e) => setForm({ ...form, totp_code: e.target.value })}
                placeholder="000000"
                maxLength={6}
                data-testid="admin-login-totp"
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono text-lg text-center tracking-widest placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-info/40 focus:border-brand-info transition-all"
              />
            </div>

            {error && (
              <div data-testid="admin-login-error" className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="admin-login-submit"
              className="w-full bg-brand-info hover:bg-brand-info/90 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Acessar Painel Admin"}
            </button>
          </form>

          <div className="mt-5 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
            <p className="text-xs text-slate-400 font-medium mb-1">Demo:</p>
            <p className="text-xs text-slate-300 font-mono">jailson.silva0933@gmail.com</p>
            <p className="text-xs text-slate-300 font-mono">Senha: Admin@2026</p>
            <p className="text-xs text-slate-400 mt-1">TOTP Secret: JBSWY3DPEHPK3PXP</p>
            <p className="text-xs text-slate-500 mt-0.5">Use totp.app ou Google Authenticator</p>
          </div>
        </div>

        <p className="text-center mt-4">
          <a href="/login" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            Voltar ao login da clínica
          </a>
        </p>
      </div>
    </div>
  );
}
