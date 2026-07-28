import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Language } from "@nomduchat/shared";
import type { AuthApiResponse, UserApiRecord } from "./api-client";
import {
  confirmPasswordReset as confirmPasswordResetApi,
  getCurrentUser,
  loginUser,
  requestPasswordReset as requestPasswordResetApi,
  registerUser,
  updateCurrentUserProfile,
} from "./api-client/auth";
import { createGenerationJob, fetchGenerationArtifact } from "./api-client/generation";
import { setApiAccessToken, setApiLocalRoleOverride } from "./api-client/transport";
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
    country?: string;
    language?: Language;
    avatarDataUrl?: string | null;
    generateAiAvatar?: boolean;
    turnstileToken?: string;
  }) => Promise<void>;
  updateProfile: (input: {
    name?: string;
    country?: string;
    language?: Language;
    avatarDataUrl?: string | null;
  }) => Promise<UserApiRecord>;
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
        const response = await registerUser({
          ...input,
          avatarDataUrl: input.generateAiAvatar ? undefined : input.avatarDataUrl,
        });
        setRoleOverrideState("real");
        setApiAccessToken(response.accessToken);
        let nextSession = response;
        if (input.generateAiAvatar && input.avatarDataUrl) {
          const generatedAvatar = await createRegistrationAiAvatar(input.avatarDataUrl).catch(() => null);
          if (generatedAvatar) {
            const profile = await updateCurrentUserProfile({ avatarDataUrl: generatedAvatar }).catch(() => null);
            if (profile) {
              nextSession = {
                user: profile.user,
                accessToken: response.accessToken,
              };
            }
          }
        }
        updateSession(nextSession);
        reachAnalyticsGoal("registration", {
          country: input.country ?? nextSession.user.country,
          language: input.language ?? nextSession.user.language,
        });
      },
      async updateProfile(input) {
        const token = session?.accessToken;
        if (!token) throw new Error("Войдите в аккаунт, чтобы сохранить профиль.");
        if (token) setApiAccessToken(token);
        const response = await updateCurrentUserProfile(input);
        updateSession({
          user: response.user,
          accessToken: token,
        });
        return response.user;
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
    avatarUrl: null,
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

async function createRegistrationAiAvatar(photoDataUrl: string) {
  const identityReference = {
    ...dataUrlToReferenceImage(photoDataUrl),
    filename: "identity-reference.jpg",
    consentConfirmed: true,
  };
  const styleReference = await imageUrlToReferenceImage(
    "/avatar/references/memoji-wave-boy.png",
    "nomduchat-3d-avatar-style.png"
  ).catch(() => null);

  const response = await createGenerationJob({
    agentId: "avatar",
    modality: "image",
    purpose: "avatar_profile",
    prompt: [
      "Create a beautiful premium AI avatar for nomduchat from the uploaded portrait.",
      "The first uploaded image is the identity reference. Preserve the person's recognizable facial features, face shape, hairstyle direction, glasses if present, and friendly personality.",
      "If a second uploaded image is present, it is a style reference only. Use it for 3D cartoon quality, soft materials, crop, lighting, and expression language. Do not copy the exact person from the style reference.",
      "Visual target: high-end 3D cartoon profile avatar, memoji-like quality without copying any brand, rounded soft forms, clean square 1:1 portrait, large expressive glossy eyes, detailed sculpted hair, soft studio lighting, elegant simple clothing, subtle warm background.",
      "Quality bar: polished product avatar, symmetrical face, natural smile, clean edges, no awkward geometry, no flat vector look, no rough low-poly style.",
      "No text, no logos, no watermark, no UI, no extra people, no realistic photo output.",
    ].join("\n"),
    referenceImage: styleReference ? undefined : identityReference,
    referenceImages: styleReference ? [identityReference, { ...styleReference, consentConfirmed: true }] : undefined,
  });

  if (response.job.status !== "succeeded") return null;
  const artifact = await fetchGenerationArtifact(response.job.id);
  if (!artifact.type.startsWith("image/")) return null;

  return blobToProfileAvatarDataUrl(artifact);
}

function dataUrlToReferenceImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Фото должно быть в формате JPG, PNG или WebP.");
  }

  return {
    dataBase64: match[2],
    mimeType: match[1].toLowerCase() as "image/jpeg" | "image/png" | "image/webp",
    filename: `nomduchat-registration-avatar.${imageExtension(match[1])}`,
  };
}

async function imageUrlToReferenceImage(imageUrl: string, filename: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Не удалось загрузить референс аватара.");
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("Референс аватара должен быть изображением.");
  }

  return {
    ...dataUrlToReferenceImage(await blobToDataUrl(blob)),
    filename,
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    reader.readAsDataURL(blob);
  });
}

async function blobToProfileAvatarDataUrl(blob: Blob) {
  const sourceUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImageFromUrl(sourceUrl);
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable.");
    context.fillStyle = "#050505";
    context.fillRect(0, 0, size, size);
    drawImageCover(context, image, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImageFromUrl(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось загрузить изображение."));
    image.src = source;
  });
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const { width: imageWidth, height: imageHeight } = canvasSourceSize(image);
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function canvasSourceSize(image: CanvasImageSource) {
  if ("naturalWidth" in image) return { width: image.naturalWidth, height: image.naturalHeight };
  if ("videoWidth" in image) return { width: image.videoWidth, height: image.videoHeight };
  if ("displayWidth" in image) return { width: image.displayWidth, height: image.displayHeight };

  const source = image as CanvasImageSource & { width: number; height: number };
  return { width: Number(source.width), height: Number(source.height) };
}

function imageExtension(mimeType: string) {
  if (mimeType.toLowerCase() === "image/png") return "png";
  if (mimeType.toLowerCase() === "image/webp") return "webp";
  return "jpg";
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
