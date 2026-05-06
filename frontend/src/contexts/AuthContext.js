import { createContext, useContext, useState, useEffect } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cp_user")); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, senha) => {
    const res = await api.post("/auth/login", { email, senha });
    const { access_token, user: u } = res.data;
    localStorage.setItem("cp_token", access_token);
    localStorage.setItem("cp_user", JSON.stringify(u));
    setUser(u);
    return u;
  };

  const adminLogin = async (email, senha, totp_code) => {
    const res = await api.post("/auth/admin/login", { email, senha, totp_code });
    const { access_token, user: u } = res.data;
    localStorage.setItem("cp_token", access_token);
    localStorage.setItem("cp_user", JSON.stringify(u));
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem("cp_token");
    localStorage.removeItem("cp_user");
    setUser(null);
  };

  const isSuperAdmin = () => user?.role === "super_admin";
  const isAdmin = () => user?.role === "admin" || user?.role === "super_admin";

  return (
    <AuthContext.Provider value={{ user, loading, login, adminLogin, logout, isSuperAdmin, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
