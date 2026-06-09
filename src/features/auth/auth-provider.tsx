import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../../lib/api";
import { tokenStorage } from "../../lib/token-storage";
import type { AuthResponse, User } from "../../lib/types";

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  logout: (all?: boolean) => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const applyAuth = (auth: AuthResponse) => {
    tokenStorage.set(auth.accessToken, auth.refreshToken);
    setUser(auth.user);
  };
  useEffect(() => {
    (async () => {
      try {
        if (await api.bootstrap()) setUser(await api.me());
      } catch {
        tokenStorage.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const login = async (input: { email: string; password: string }) =>
    applyAuth(await api.login(input));
  const register = async (input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => applyAuth(await api.register(input));
  const logout = async (all = false) => {
    try {
      await (all ? api.logoutAll() : api.logout());
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  };
  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
};
