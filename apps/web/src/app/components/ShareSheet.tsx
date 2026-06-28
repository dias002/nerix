import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Mail, MessageCircle, PhoneCall, Send, Share2, Smartphone, UserRound, X } from "lucide-react";

export type SharePayload = {
  title: string;
  text?: string;
  url?: string;
  fileUrl?: string;
  fileName?: string;
  fileMimeType?: string;
};

type ShareSheetProps = {
  open: boolean;
  payload: SharePayload | null;
  onClose: () => void;
  onShared?: (message: string) => void;
};

type NavigatorWithFileShare = Navigator & {
  canShare?: (data: ShareData & { files?: File[] }) => boolean;
  share?: (data: ShareData & { files?: File[] }) => Promise<void>;
};

type ContactPickerContact = {
  name?: string[];
  email?: string[];
  tel?: string[];
};

type NavigatorWithShareContacts = NavigatorWithFileShare & {
  contacts?: {
    getProperties?: () => Promise<string[]>;
    select: (properties: string[], options?: { multiple?: boolean }) => Promise<ContactPickerContact[]>;
  };
};

export default function ShareSheet({ open, payload, onClose, onShared }: ShareSheetProps) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setStatus(null);
  }, [open, payload]);

  const shareText = useMemo(() => buildShareText(payload), [payload]);
  const encodedText = encodeURIComponent(shareText);
  const encodedTitle = encodeURIComponent(payload?.title ?? "nomduchat");
  const encodedUrl = encodeURIComponent(payload?.url ?? "");
  const encodedTelegramText = encodeURIComponent(payload?.url ? payload.text ?? payload.title : shareText);

  if (!open || !payload || typeof document === "undefined") return null;

  const nav = navigator as NavigatorWithShareContacts;
  const supportsContactPicker = Boolean(nav.contacts?.select);

  const setDone = (message: string) => {
    setStatus(message);
    onShared?.(message);
  };

  const shareNative = async () => {
    try {
      const files = await buildShareFiles(payload);
      if (files?.length && nav.canShare?.({ files })) {
        await nav.share?.({
          title: payload.title,
          text: payload.text,
          files,
        });
        setDone("Открыто системное меню.");
        onClose();
        return;
      }

      if (nav.share) {
        await nav.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        });
        setDone("Открыто системное меню.");
        onClose();
        return;
      }

      await copyShareText(shareText);
      setDone("Системное меню недоступно, текст скопирован.");
    } catch (error) {
      if (isAbortError(error)) return;
      await copyShareText(shareText);
      setDone("Не удалось открыть системное меню, текст скопирован.");
    }
  };

  const shareToContact = async () => {
    if (!nav.contacts?.select) {
      setDone("Выбор контакта недоступен в этом браузере. Используйте системное меню или скопируйте текст.");
      return;
    }

    try {
      const supportedProperties = await nav.contacts.getProperties?.().catch(() => []);
      const properties = ["name", "email", "tel"].filter((property) =>
        supportedProperties?.length ? supportedProperties.includes(property) : true
      );
      const contacts = await nav.contacts.select(properties.length ? properties : ["email", "tel"], { multiple: false });
      const contact = contacts[0];
      if (!contact) return;

      const phone = contact.tel?.find(Boolean);
      if (phone) {
        window.location.href = `sms:${encodeURIComponent(phone)}?&body=${encodedText}`;
        onClose();
        return;
      }

      const email = contact.email?.find(Boolean);
      if (email) {
        openExternal(`mailto:${encodeURIComponent(email)}?subject=${encodedTitle}&body=${encodedText}`);
        return;
      }

      await copyShareText(shareText);
      setDone("В контакте нет телефона или email, текст скопирован.");
    } catch (error) {
      if (isAbortError(error)) return;
      await copyShareText(shareText);
      setDone("Не удалось открыть контакты, текст скопирован.");
    }
  };

  const copy = async () => {
    await copyShareText(shareText);
    setDone("Скопировано.");
  };

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  const navigateExternal = (url: string) => {
    window.location.href = url;
    onClose();
  };

  const openInstalledMessenger = (appUrl: string, fallback: () => void | Promise<void>) => {
    let openedAnotherApp = false;
    let fallbackTimer: number | undefined;

    const cleanup = () => {
      window.removeEventListener("pagehide", handleLeavePage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
    };

    const leavePage = () => {
      openedAnotherApp = true;
      cleanup();
      onClose();
    };

    function handleLeavePage() {
      leavePage();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") leavePage();
    }

    window.addEventListener("pagehide", handleLeavePage, { once: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.location.href = appUrl;

    fallbackTimer = window.setTimeout(() => {
      cleanup();
      if (!openedAnotherApp && document.visibilityState === "visible") {
        void fallback();
      }
    }, 900);
  };

  const openTelegram = () => {
    const webUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedTelegramText}`;
    openInstalledMessenger(`tg://msg_url?url=${encodedUrl}&text=${encodedTelegramText}`, () => navigateExternal(webUrl));
  };

  const openWhatsApp = () => {
    const webUrl = `https://wa.me/?text=${encodedText}`;
    openInstalledMessenger(`whatsapp://send?text=${encodedText}`, () => navigateExternal(webUrl));
  };

  const openViber = () => {
    openInstalledMessenger(`viber://forward?text=${encodedText}`, async () => {
      await copyShareText(shareText);
      setDone("Viber не открылся, текст скопирован.");
    });
  };

  const openSms = () => {
    window.location.href = `sms:?&body=${encodedText}`;
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 px-3 pb-3 pt-16 backdrop-blur-sm">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative w-full max-w-xl rounded-[28px] border border-white/10 bg-[#090909] p-4 text-white shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-medium">Поделиться</div>
            <div className="mt-1 truncate text-sm text-gray-500">{payload.title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-gray-400 transition-colors hover:border-white/20 hover:text-white"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          <ShareAction icon={Share2} label="Приложения" onClick={() => void shareNative()} />
          <ShareAction
            icon={UserRound}
            label="Контакты"
            onClick={() => void shareToContact()}
            muted={!supportsContactPicker}
          />
          <ShareAction
            icon={Send}
            label="Telegram"
            onClick={openTelegram}
          />
          <ShareAction icon={MessageCircle} label="WhatsApp" onClick={openWhatsApp} />
          <ShareAction icon={PhoneCall} label="Viber" onClick={openViber} />
          <ShareAction icon={Mail} label="Email" onClick={() => openExternal(`mailto:?subject=${encodedTitle}&body=${encodedText}`)} />
          <ShareAction icon={Smartphone} label="SMS" onClick={openSms} />
          <ShareAction icon={Copy} label="Копировать" onClick={() => void copy()} />
        </div>

        {payload.fileUrl && !payload.url ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-gray-500">
            Файл можно отправить через системное меню. Telegram, WhatsApp, Email и SMS получают текст, потому что у файла нет публичной ссылки.
          </div>
        ) : null}

        {status ? <div className="mt-4 text-sm text-gray-400">{status}</div> : null}
      </section>
    </div>,
    document.body
  );
}

function ShareAction({
  icon: Icon,
  label,
  onClick,
  muted = false,
}: {
  icon: typeof Share2;
  label: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-2 text-sm transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white ${
        muted ? "text-gray-600" : "text-gray-300"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.7} />
      <span className="text-xs">{label}</span>
    </button>
  );
}

function buildShareText(payload: SharePayload | null) {
  if (!payload) return "";
  return [payload.text, payload.url].filter(Boolean).join("\n").trim() || payload.title;
}

async function buildShareFiles(payload: SharePayload) {
  if (!payload.fileUrl) return null;

  const response = await fetch(payload.fileUrl);
  const blob = await response.blob();
  const file = new File([blob], payload.fileName ?? "nomduchat-file", {
    type: payload.fileMimeType || blob.type || "application/octet-stream",
  });
  return [file];
}

async function copyShareText(value: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
