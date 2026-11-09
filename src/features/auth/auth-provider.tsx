import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, onSessionExpired } from "../../lib/api";
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
  /** Replaces the signed-in user after a profile change. */
  updateUser: (user: User) => void;
  /** Grows after each avatar upload or removal, so avatar URLs reload. */
  avatarVersion: number;
  avatarChanged: () => void;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarVersion, setAvatarVersion] = useState(0);
  // Cached queries belong to the previous session, so they never outlive it.
  const endSession = () => {
    tokenStorage.clear();
    client.clear();
    setUser(null);
  };
  const applyAuth = (auth: AuthResponse) => {
    client.clear();
    tokenStorage.set(auth.accessToken, auth.refreshToken);
    setUser(auth.user);
  };
  useEffect(
    () =>
      onSessionExpired(() => {
        client.clear();
        setUser(null);
      }),
    [client],
  );
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        // StrictMode runs this effect twice; api.bootstrap shares one refresh
        // between the runs, and the refresh response already carries the user.
        const restored = await api.bootstrap();
        if (active) setUser(restored);
      } catch (error) {
        // Keep the refresh token on network or server errors so a reload
        // can restore the session once the backend is reachable again.
        if (error instanceof ApiError && error.status === 401)
          tokenStorage.clear();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
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
    } catch {
      // The local session ends either way; a failed server-side revoke
      // must not leave the user signed in or surface as an unhandled error.
    } finally {
      endSession();
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateUser: setUser,
        avatarVersion,
        avatarChanged: () => setAvatarVersion((value) => value + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
};
