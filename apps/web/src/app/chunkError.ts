const CHUNK_RELOAD_STORAGE_KEY = "nomduchat:chunk-reload-at";
const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

export function installChunkErrorHandlers() {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("vite:preloadError", (event) => {
    const preloadEvent = event as Event & { payload?: unknown };
    if (!isChunkLoadError(preloadEvent.payload)) {
      return;
    }

    event.preventDefault();
    reloadAfterChunkError();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isChunkLoadError(event.reason)) {
      return;
    }

    event.preventDefault();
    reloadAfterChunkError();
  });
}

export function isChunkLoadError(reason: unknown) {
  const message = getErrorMessage(reason).toLowerCase();
  return (
    message.includes("dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("failed to fetch module script") ||
    message.includes("failed to load module script") ||
    message.includes("loading chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("modulepreload") ||
    message.includes("valid javascript mime type") ||
    message.includes("unsupported mime type") ||
    (message.includes("mime type") && message.includes("javascript")) ||
    message.includes("cannot read properties of undefined (reading 'default')")
  );
}

export function reloadAfterChunkError() {
  if (typeof window === "undefined") {
    return false;
  }

  const now = Date.now();
  const lastReloadAt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY));
  if (Number.isFinite(lastReloadAt) && now - lastReloadAt < CHUNK_RELOAD_COOLDOWN_MS) {
    return false;
  }

  window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
  window.location.reload();
  return true;
}

export function getErrorMessage(reason: unknown) {
  if (reason instanceof Error) {
    return `${reason.name}: ${reason.message}`;
  }

  if (typeof reason === "object" && reason !== null && "message" in reason) {
    return String((reason as { message?: unknown }).message ?? reason);
  }

  return String(reason ?? "");
}
