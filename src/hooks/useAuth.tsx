import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

type UserRole = "admin" | "gestor_conta";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  loading: boolean;
  isAdmin: boolean;
  isGestorConta: boolean;
  isInternalUser: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const ROLE_FETCH_TIMEOUT_MS = 12000;

const withTimeout = <T,>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error("Tempo limite ao carregar permissões")), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const authRequestRef = useRef(0);
  const initialSessionResolvedRef = useRef(false);
  const resolvedUserIdRef = useRef<string | null>(null);

  const fetchRoles = async (userId: string): Promise<UserRole[]> => {
    const { data, error } = await withTimeout(supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId), ROLE_FETCH_TIMEOUT_MS);
    if (error) throw error;
    return (data || []).map((r: any) => r.role as UserRole);
  };

  useEffect(() => {
    let active = true;

    const resolveRoles = async (userId: string, requestId: number) => {
      try {
        const nextRoles = await fetchRoles(userId);
        if (active && requestId === authRequestRef.current) {
          resolvedUserIdRef.current = userId;
          setRoles(nextRoles);
        }
      } catch (error) {
        console.error("[AuthProvider] Não foi possível carregar as permissões", error);
      } finally {
        if (active && requestId === authRequestRef.current) setLoading(false);
      }
    };

    const applySession = (nextSession: Session | null) => {
      initialSessionResolvedRef.current = true;
      const requestId = ++authRequestRef.current;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        if (resolvedUserIdRef.current === nextSession.user.id) {
          setLoading(false);
          return;
        }
        setLoading(true);
        void resolveRoles(nextSession.user.id, requestId);
      } else {
        resolvedUserIdRef.current = null;
        setRoles([]);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        // A consulta de permissões precisa começar fora do callback de autenticação.
        window.setTimeout(() => applySession(nextSession), 0);
      },
    );

    const initialSessionTimeout = window.setTimeout(() => {
      if (!active || initialSessionResolvedRef.current) return;
      console.error("[AuthProvider] Tempo limite ao restaurar a sessão");
      setLoading(false);
    }, ROLE_FETCH_TIMEOUT_MS);

    return () => {
      active = false;
      window.clearTimeout(initialSessionTimeout);
      authRequestRef.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        loading,
        isAdmin: roles.includes("admin"),
        isGestorConta: roles.includes("gestor_conta"),
        isInternalUser: roles.some((r) => r === "admin" || r === "gestor_conta"),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
