import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Language } from "@nomduchat/shared";
import {
  type AuthApiResponse,
  confirmPasswordReset as confirmPasswordResetApi,
  getCurrentUser,
  loginUser,
  requestPasswordReset as requestPasswordResetApi,
  registerUser,
  setApiAccessToken,
  setApiLocalRoleOverride,
  type UserApiRecord,
} from "./api";
import { reachAnalyticsGoal } from "./analytics";

export type LocalRoleOverride = "real" | "user" | "business_owner" | "business_employee" | "admin";

type AuthSession = {
  user: UserApiRecord;
  accessToken: string;
};

type AuthContextValue = {
  user: UserApiRecord | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  roleOverride: LocalRoleOverride;
  canUseRoleSwitcher: boolean;
  setRoleOverride: (role: LocalRoleOverride) => void;
  login: (input: { email: string; password: string }) => Promise<void>;
  requestPasswordReset: (input: { email: string }) => Promise<{ resetUrl?: string }>;
  confirmPasswordReset: (input: { token: string; password: string }) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    name?: string;
    country?: "KZ" | "RU";
    language?: Language;
    turnstileToken?: string;
  }) => Promise<void>;
  completeOAuth: (session: AuthApiResponse) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const storageKey = "nomduchat-auth-session";
const roleOverrideStorageKey = "nomduchat-local-role-override";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [isLoading, setIsLoading] = useState(() => Boolean(readStoredSession()?.accessToken));
  const canUseRoleSwitcher = isLocalRoleSwitcherEnabled();
  const [roleOverride, setRoleOverrideState] = useState<LocalRoleOverride>(() => readRoleOverride(canUseRoleSwitcher));
  const effectiveRoleOverride = canUseRoleSwitcher ? roleOverride : "real";
  const effectiveUser = useMemo(
    () => applyLocalRoleOverride(session?.user ?? null, effectiveRoleOverride),
    [effectiveRoleOverride, session?.user]
  );

  useEffect(() => {
    setApiAccessToken(session?.accessToken ?? null);
  }, [session?.accessToken]);

  useEffect(() => {
    setApiLocalRoleOverride(canUseRoleSwitcher ? effectiveRoleOverride : "real");
  }, [canUseRoleSwitcher, effectiveRoleOverride]);

  useEffect(() => {
    let active = true;
    const token = session?.accessToken;

    if (!token) {
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    setApiAccessToken(token);
    getCurrentUser()
      .then((response) => {
        if (!active) return;
        updateSession({
          user: response.user,
          accessToken: token,
        });
      })
      .catch(() => {
        if (!active) return;
        clearSession();
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: effectiveUser,
      accessToken: session?.accessToken ?? null,
      isLoading,
      isAuthenticated: Boolean(session?.accessToken && session.user) || effectiveRoleOverride !== "real",
      roleOverride: effectiveRoleOverride,
      canUseRoleSwitcher,
      setRoleOverride(nextRole) {
        if (!canUseRoleSwitcher) return;
        setRoleOverrideState(nextRole);
        if (nextRole === "real") {
          window.localStorage.removeItem(roleOverrideStorageKey);
        } else {
          window.localStorage.setItem(roleOverrideStorageKey, nextRole);
        }
      },
      async login(input) {
        const response = await loginUser(input);
        setRoleOverrideState("real");
        updateSession(response);
      },
      async requestPasswordReset(input) {
        return requestPasswordResetApi(input);
      },
      async confirmPasswordReset(input) {
        const response = await confirmPasswordResetApi(input);
        setRoleOverrideState("real");
        updateSession(response);
      },
      async register(input) {
        const response = await registerUser(input);
        setRoleOverrideState("real");
        updateSession(response);
        reachAnalyticsGoal("registration", {
          country: input.country ?? response.user.country,
          language: input.language ?? response.user.language,
        });
      },
      completeOAuth(nextSession) {
        updateSession(nextSession);
      },
      async refreshUser() {
        const token = session?.accessToken;
        if (!token) return;

        setApiAccessToken(token);
        const response = await getCurrentUser();
        updateSession({
          user: response.user,
          accessToken: token,
        });
      },
      logout() {
        setRoleOverrideState("real");
        window.localStorage.removeItem(roleOverrideStorageKey);
        clearSession();
      },
    }),
    [canUseRoleSwitcher, effectiveRoleOverride, effectiveUser, isLoading, session]
  );

  function updateSession(nextSession: AuthSession) {
    setApiAccessToken(nextSession.accessToken);
    setSession(nextSession);
    window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
  }

  function clearSession() {
    setApiAccessToken(null);
    setSession(null);
    window.localStorage.removeItem(storageKey);
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function applyLocalRoleOverride(user: UserApiRecord | null, role: LocalRoleOverride): UserApiRecord | null {
  if (role === "real") return user;

  const baseUser = user ?? createLocalUser(role);
  const systemRole = role === "admin" ? "admin" : "user";
  const workspaceRole =
    role === "business_owner" ? "business_owner" : role === "business_employee" ? "business_employee" : "personal";
  const businessWorkspace =
    role === "business_owner" || role === "business_employee"
      ? {
          id: "local-business-workspace",
          name: "Локальный Business",
          memberId: role === "business_owner" ? "local-owner-member" : "local-employee-member",
          memberRoleKey: role === "business_owner" ? "owner" : "sales",
          groupId: "local-business-group",
          groupName: "Локальный Business: общая группа",
        }
      : null;

  return {
    ...baseUser,
    name: roleLabel(role),
    email: baseUser.email ?? `${role}@local.nomduchat`,
    systemRole,
    workspaceRole,
    activePlanId: role === "business_owner" || role === "business_employee" ? "business" : null,
    businessWorkspace,
    permissions: permissionsFor(role),
  };
}

function createLocalUser(role: LocalRoleOverride): UserApiRecord {
  return {
    id: `local-${role}`,
    name: roleLabel(role),
    email: `${role}@local.nomduchat`,
    phone: null,
    country: "KZ",
    language: "ru",
    systemRole: role === "admin" ? "admin" : "user",
    workspaceRole: "personal",
    activePlanId: null,
    businessWorkspace: null,
    permissions: permissionsFor(role),
  };
}

function permissionsFor(role: LocalRoleOverride): UserApiRecord["permissions"] {
  if (role === "admin") {
    return {
      adminPanel: true,
      globalMetrics: true,
      mailings: true,
      business: true,
      businessSettings: true,
      employeeReports: true,
    };
  }

  if (role === "business_owner") {
    return {
      adminPanel: false,
      globalMetrics: false,
      mailings: false,
      business: true,
      businessSettings: true,
      employeeReports: true,
    };
  }

  if (role === "business_employee") {
    return {
      adminPanel: false,
      globalMetrics: false,
      mailings: false,
      business: true,
      businessSettings: false,
      employeeReports: true,
    };
  }

  return {
    adminPanel: false,
    globalMetrics: false,
    mailings: false,
    business: false,
    businessSettings: false,
    employeeReports: false,
  };
}

export function roleLabel(role: LocalRoleOverride) {
  switch (role) {
    case "admin":
      return "Админ";
    case "business_owner":
      return "Владелец Business";
    case "business_employee":
      return "Сотрудник";
    case "user":
      return "Обычный пользователь";
    default:
      return "Реальная роль";
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

function readStoredSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.accessToken || !parsed.user?.id) return null;

    setApiAccessToken(parsed.accessToken);
    return parsed as AuthSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function readRoleOverride(canUseRoleSwitcher: boolean): LocalRoleOverride {
  if (typeof window === "undefined" || !canUseRoleSwitcher) return "real";

  const saved = window.localStorage.getItem(roleOverrideStorageKey);
  return isLocalRoleOverride(saved) ? saved : "real";
}

function isLocalRoleOverride(value: string | null): value is LocalRoleOverride {
  return value === "real" || value === "user" || value === "business_owner" || value === "business_employee" || value === "admin";
}

function isLocalRoleSwitcherEnabled() {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;

  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;

  return false;
}
