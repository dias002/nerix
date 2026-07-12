import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router";
import { motion } from "motion/react";
import {
  Check,
  Copy,
  FileText,
  MessageSquarePlus,
  Mic,
  Paperclip,
  RotateCcw,
  Send,
  Share2,
  Star,
  X,
} from "lucide-react";
import { useLanguage } from "../i18n";
import AuthPromptDialog from "../components/AuthPromptDialog";
import ShareSheet, { type SharePayload } from "../components/ShareSheet";
import {
  cancelGenerationJob,
  getChatConversation,
  getAiProviders,
  fetchGenerationArtifact,
  regenerateChatMessage,
  refreshGenerationJob,
  selectBestChatAnswer,
  sendChatMessage,
  toPublicApiError,
  type AiModelOptionApiRecord,
  type MediaGenerationJobApiRecord,
} from "../api";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { readResponseStyle, responseStyleLabel, responseStyles, writeResponseStyle, type ResponseStyleId } from "../responsePreferences";
import { formatFileSize, maxAttachedFileSize, maxAttachedFiles, readAttachment, speechLocale } from "./chat/attachments";
import { GenerationJobCard, generationStatusText, mediaExtension, mediaTitle } from "./chat/generation";
import { toApiAttachment, toAssistantMessage, toChatMessage } from "./chat/messageMappers";
import type { AttachedFile, Message } from "./chat/types";

const guestRequestStorageKey = "nomduchat-guest-chat-requests";
const modelSelectionStorageKey = "nomduchat-chat-model-id";
const fallbackModelOptions: AiModelOptionApiRecord[] = [
  {
    id: "openai:gpt-4.1",
    providerCode: "openai",
    providerName: "OpenAI",
    label: "OpenAI GPT-4.1",
    description: "Сильная универсальная модель для текста, файлов и кода.",
    tier: "pro",
    modalities: ["text", "code", "file"],
  },
  {
    id: "openai:gpt-4.1-mini",
    providerCode: "openai",
    providerName: "OpenAI",
    label: "OpenAI GPT-4.1 mini",
    description: "Быстрый режим OpenAI для повседневных рабочих запросов.",
    tier: "balanced",
    modalities: ["text", "code", "file"],
  },
  {
    id: "openai:gpt-4o",
    providerCode: "openai",
    providerName: "OpenAI",
    label: "OpenAI GPT-4o",
    description: "Мультимодальная модель OpenAI для текста и файлов.",
    tier: "balanced",
    modalities: ["text", "code", "file"],
  },
  {
    id: "openai:o3",
    providerCode: "openai",
    providerName: "OpenAI",
    label: "OpenAI o3",
    description: "Режим рассуждений для сложного анализа и логики.",
    tier: "pro",
    modalities: ["text", "code", "file"],
  },
  {
    id: "openai:o4-mini",
    providerCode: "openai",
    providerName: "OpenAI",
    label: "OpenAI o4-mini",
    description: "Быстрый reasoning-режим для кода, анализа и рабочих задач.",
    tier: "fast",
    modalities: ["text", "code", "file"],
  },
  {
    id: "anthropic:claude-opus-4-20250514",
    providerCode: "anthropic",
    providerName: "Anthropic",
    label: "Claude Opus 4",
    description: "Сильный режим Claude для сложных рассуждений и кода.",
    tier: "pro",
    modalities: ["text", "code", "file"],
  },
  {
    id: "anthropic:claude-sonnet-4-20250514",
    providerCode: "anthropic",
    providerName: "Anthropic",
    label: "Claude Sonnet 4",
    description: "Баланс качества, скорости и цены для рабочих запросов.",
    tier: "balanced",
    modalities: ["text", "code", "file"],
  },
  {
    id: "anthropic:claude-3-7-sonnet-20250219",
    providerCode: "anthropic",
    providerName: "Anthropic",
    label: "Claude 3.7 Sonnet",
    description: "Сильный режим Claude для кода, анализа и документов.",
    tier: "balanced",
    modalities: ["text", "code", "file"],
  },
  {
    id: "anthropic:claude-3-5-haiku-20241022",
    providerCode: "anthropic",
    providerName: "Anthropic",
    label: "Claude 3.5 Haiku",
    description: "Быстрый режим Claude для коротких ответов.",
    tier: "fast",
    modalities: ["text", "code", "file"],
  },
  {
    id: "gemini:gemini-2.5-pro",
    providerCode: "gemini",
    providerName: "Google Gemini",
    label: "Gemini 2.5 Pro",
    description: "Pro-режим Gemini для анализа, текста и кода.",
    tier: "pro",
    modalities: ["text", "code", "file"],
  },
  {
    id: "gemini:gemini-2.5-flash",
    providerCode: "gemini",
    providerName: "Google Gemini",
    label: "Gemini 2.5 Flash",
    description: "Быстрый режим Gemini для повседневных задач.",
    tier: "balanced",
    modalities: ["text", "code", "file"],
  },
  {
    id: "gemini:gemini-2.5-flash-lite",
    providerCode: "gemini",
    providerName: "Google Gemini",
    label: "Gemini 2.5 Flash-Lite",
    description: "Экономичный режим Gemini для коротких запросов.",
    tier: "fast",
    modalities: ["text", "code", "file"],
  },
  {
    id: "gemini:gemini-2.0-flash",
    providerCode: "gemini",
    providerName: "Google Gemini",
    label: "Gemini 2.0 Flash",
    description: "Стабильный быстрый режим Gemini для текста и файлов.",
    tier: "fast",
    modalities: ["text", "code", "file"],
  },
];

export default function Chat() {
  const { language, t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedBestAnswerId, setSelectedBestAnswerId] = useState<string | null>(null);
  const [unavailableNotice, setUnavailableNotice] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [mediaObjectUrls, setMediaObjectUrls] = useState<Record<string, string>>({});
  const [cancellingGenerationIds, setCancellingGenerationIds] = useState<Set<string>>(() => new Set());
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [modelOptions, setModelOptions] = useState<AiModelOptionApiRecord[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(() => {
    if (typeof window === "undefined") return "auto";
    return window.localStorage.getItem(modelSelectionStorageKey) ?? "auto";
  });
  const [responseStyleId, setResponseStyleId] = useState<ResponseStyleId>(() => readResponseStyle());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceBaseInputRef = useRef("");
  const mediaObjectUrlsRef = useRef<Record<string, string>>({});
  const promptParam = searchParams.get("prompt");
  const newChatParam = searchParams.get("new");
  const conversationParam = searchParams.get("conversationId");

  const canSend = Boolean(inputValue.trim()) || attachedFiles.length > 0;
  const selectedModelForRequest = selectedModelId === "auto" ? undefined : selectedModelId;
  const displayModelOptions = modelOptions.length > 0 ? modelOptions : fallbackModelOptions;
  const modelGroups = useMemo(() => {
    const groups = new Map<string, { providerName: string; models: AiModelOptionApiRecord[] }>();

    for (const option of displayModelOptions) {
      const group = groups.get(option.providerCode) ?? {
        providerName: option.providerName,
        models: [],
      };
      group.models.push(option);
      groups.set(option.providerCode, group);
    }

    return Array.from(groups.entries()).map(([providerCode, group]) => ({
      providerCode,
      providerName: group.providerName,
      models: group.models,
    }));
  }, [displayModelOptions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const loadProviders = () => {
      getAiProviders()
        .then((response) => {
          if (!active) return;
          setModelOptions(response.models ?? []);
        })
        .catch(() => {
          if (!active) return;
          setModelOptions([]);
          retryTimer = setTimeout(loadProviders, 5_000);
        });
    };

    loadProviders();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(modelSelectionStorageKey, selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    writeResponseStyle(responseStyleId);
  }, [responseStyleId]);

  useEffect(() => {
    if (selectedModelId === "auto") return;
    if (!displayModelOptions.some((option) => option.id === selectedModelId)) {
      setSelectedModelId("auto");
    }
  }, [displayModelOptions, selectedModelId]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0 || (prev.length === 1 && prev[0].id === "intro")) {
        return [{ id: "intro", text: "nomduchat", sender: "ai" }];
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (!promptParam) return;

    setInputValue(promptParam);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("prompt");
      return next;
    }, { replace: true });
  }, [promptParam, setSearchParams]);

  useEffect(() => {
    if (!newChatParam) return;

    Object.values(mediaObjectUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    mediaObjectUrlsRef.current = {};
    setMediaObjectUrls({});
    setMessages([{ id: "intro", text: "nomduchat", sender: "ai" }]);
    setInputValue("");
    setAttachedFiles([]);
    setConversationId(undefined);
    setUnavailableNotice(null);
    setIsThinking(false);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("new");
      next.delete("conversationId");
      return next;
    }, { replace: true });
  }, [newChatParam, setSearchParams]);

  useEffect(() => {
    if (!conversationParam || newChatParam) return;

    let active = true;
    setUnavailableNotice(null);

    getChatConversation(conversationParam)
      .then((response) => {
        if (!active) return;
        setConversationId(response.conversation.id);
        setMessages(response.conversation.messages.map(toChatMessage));
        setSelectedBestAnswerId(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setUnavailableNotice(toPublicApiError(loadError, "Не удалось открыть чат."));
      });

    return () => {
      active = false;
    };
  }, [conversationParam, newChatParam]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      Object.values(mediaObjectUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const updateGenerationJob = (job: MediaGenerationJobApiRecord) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.generationJob?.id === job.id
          ? {
              ...message,
              generationJob: job,
              text: generationStatusText(job),
            }
          : message
      )
    );
  };

  const loadGenerationArtifact = async (job: MediaGenerationJobApiRecord) => {
    if (mediaObjectUrlsRef.current[job.id]) return;

    const blob = await fetchGenerationArtifact(job.id);
    const objectUrl = URL.createObjectURL(blob);
    mediaObjectUrlsRef.current[job.id] = objectUrl;
    setMediaObjectUrls((prev) => ({
      ...prev,
      [job.id]: objectUrl,
    }));
  };

  const handleCancelGeneration = async (job: MediaGenerationJobApiRecord) => {
    if (job.status !== "queued" && job.status !== "running") return;

    setCancellingGenerationIds((prev) => new Set(prev).add(job.id));

    try {
      const response = await cancelGenerationJob(job.id);
      updateGenerationJob(response.job);
      window.dispatchEvent(new Event("nomduchat-usage-updated"));
    } catch (error) {
      setUnavailableNotice(toPublicApiError(error, "Не удалось остановить генерацию."));
    } finally {
      setCancellingGenerationIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  };

  const activeGenerationJobs = useMemo(
    () =>
      messages
        .map((message) => message.generationJob)
        .filter((job): job is MediaGenerationJobApiRecord => Boolean(job))
        .filter((job) => job.status === "queued" || job.status === "running"),
    [messages]
  );

  const readyGenerationJobs = useMemo(
    () =>
      messages
        .map((message) => message.generationJob)
        .filter((job): job is MediaGenerationJobApiRecord => Boolean(job))
        .filter((job) => job.status === "succeeded"),
    [messages]
  );

  useEffect(() => {
    if (activeGenerationJobs.length === 0) return;

    let cancelled = false;
    const refreshJobs = async () => {
      await Promise.all(
        activeGenerationJobs.map(async (job) => {
          try {
            const response = await refreshGenerationJob(job.id);
            if (cancelled) return;
            updateGenerationJob(response.job);
            if (response.job.status === "succeeded") {
              await loadGenerationArtifact(response.job);
            }
          } catch {
            // Keep the pending card visible; the next interval may still succeed.
          }
        })
      );
    };

    void refreshJobs();
    const intervalId = window.setInterval(refreshJobs, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeGenerationJobs.map((job) => `${job.id}:${job.status}:${job.updatedAt}`).join("|")]);

  useEffect(() => {
    readyGenerationJobs.forEach((job) => {
      void loadGenerationArtifact(job).catch(() => undefined);
    });
  }, [readyGenerationJobs.map((job) => `${job.id}:${job.updatedAt}`).join("|")]);

  useEffect(() => {
    if (!isAuthenticated) return;
    window.localStorage.removeItem(guestRequestStorageKey);
    setIsAuthPromptOpen(false);
  }, [isAuthenticated]);

  const handleSend = async () => {
    if (!canSend) return;

    const messageText = inputValue.trim() || t.chat.filePrompt;
    const filesForMessage = attachedFiles;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: "user",
      attachments: filesForMessage,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setAttachedFiles([]);
    setUnavailableNotice(null);
    setIsThinking(true);

    try {
      const response = await sendChatMessage({
        message: messageText,
        conversationId,
        selectedModelId: selectedModelForRequest,
        responseStyle: responseStyleId,
        language: language === "kk" ? "kz" : language,
        attachments: filesForMessage.map(toApiAttachment),
      });

      setConversationId(response.conversationId);
      setMessages((prev) => [...prev, toAssistantMessage(response, t.chat.response)]);
      window.dispatchEvent(new Event("nomduchat-usage-updated"));
    } catch (sendError) {
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: toPublicApiError(sendError, t.chat.response),
        sender: "ai",
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsThinking(false);
      promptGuestToRegister();
    }
  };

  const promptGuestToRegister = () => {
    if (isAuthenticated || typeof window === "undefined") return;

    const currentCount = Number(window.localStorage.getItem(guestRequestStorageKey) ?? "0");
    const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;
    window.localStorage.setItem(guestRequestStorageKey, String(nextCount));

    if (nextCount === 1 || (nextCount > 1 && (nextCount - 1) % 2 === 0)) {
      setIsAuthPromptOpen(true);
    }
  };

  const handleCopy = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {
      setCopiedId(null);
    }
  };

  const handleShareMessage = (message: Message) => {
    setSharePayload({
      title: "Ответ nomduchat",
      text: message.text,
    });
  };

  const handleShareGenerationJob = (job: MediaGenerationJobApiRecord, artifactUrl?: string) => {
    setSharePayload({
      title: mediaTitle(job.modality, job.status),
      text: [job.prompt, job.resultUrl ? "Файл готов:" : "Медиа из nomduchat"].filter(Boolean).join("\n"),
      url: job.resultUrl,
      fileUrl: artifactUrl,
      fileName: `nomduchat-${job.modality}-${job.id.slice(0, 8)}${mediaExtension(job.resultMimeType)}`,
      fileMimeType: job.resultMimeType,
    });
  };

  const handleRegenerate = async (message?: Message) => {
    if (message?.generationJob) {
      setUnavailableNotice(t.chat.mediaRegenerateUnavailable);
      return;
    }

    if (!conversationId) {
      setUnavailableNotice(t.chat.regenerateUnavailable);
      return;
    }

    setUnavailableNotice(null);
    setIsThinking(true);

    try {
      const response = await regenerateChatMessage({
        conversationId,
        selectedModelId: selectedModelForRequest,
        responseStyle: responseStyleId,
        language: language === "kk" ? "kz" : language,
      });
      setMessages((prev) => [...prev, toAssistantMessage(response, t.chat.regeneratedResponse)]);
    } catch (error) {
      setUnavailableNotice(toPublicApiError(error, t.chat.regenerateUnavailable));
    } finally {
      setIsThinking(false);
    }
  };

  const handleSelectBestAnswer = async (message: Message) => {
    if (!conversationId) {
      setUnavailableNotice(t.chat.feedbackUnavailable);
      return;
    }

    setUnavailableNotice(null);
    setSelectedBestAnswerId(message.id);

    try {
      await selectBestChatAnswer({
        conversationId,
        assistantMessageId: message.id,
      });
      setMessages((prev) =>
        prev.map((candidate) =>
          candidate.sender === "ai"
            ? {
                ...candidate,
                selectedBest: candidate.id === message.id,
              }
            : candidate
        )
      );
    } catch {
      setUnavailableNotice(t.chat.feedbackUnavailable);
      setSelectedBestAnswerId(null);
    }
  };

  const handleNewChat = () => {
    setMessages([{ id: "intro", text: "nomduchat", sender: "ai" }]);
    Object.values(mediaObjectUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    mediaObjectUrlsRef.current = {};
    setMediaObjectUrls({});
    setInputValue("");
    setAttachedFiles([]);
    setConversationId(undefined);
    setUnavailableNotice(null);
    setIsThinking(false);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("conversationId");
      next.delete("new");
      next.delete("prompt");
      return next;
    }, { replace: true });
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const canAttachMore = maxAttachedFiles - attachedFiles.length;
    if (canAttachMore <= 0) {
      setUnavailableNotice(t.chat.fileAttachmentLimitReached);
      event.target.value = "";
      return;
    }

    const filesWithinLimit = selectedFiles.filter((file) => file.size <= maxAttachedFileSize);
    const oversizedFiles = selectedFiles.filter((file) => file.size > maxAttachedFileSize);
    const selectedFilesLimited = filesWithinLimit.slice(0, canAttachMore);

    event.target.value = "";
    if (selectedFilesLimited.length === 0) {
      if (oversizedFiles.length > 0) {
        setUnavailableNotice(
          t.chat.fileTooLarge.replace("{maxSize}", formatFileSize(maxAttachedFileSize))
        );
      }
      return;
    }

    const files = await Promise.all(selectedFilesLimited.map(readAttachment));
    setAttachedFiles((prev) => [...prev, ...files].slice(0, maxAttachedFiles));

    const hasReadableContent = files.some((file) => Boolean(file.content));
    const oversizedNotice = oversizedFiles.length
      ? t.chat.fileTooLarge.replace("{maxSize}", formatFileSize(maxAttachedFileSize))
      : null;
    const fileNotice = hasReadableContent ? t.chat.fileReadLimit : t.chat.fileUnsupported;
    setUnavailableNotice(oversizedNotice ?? fileNotice);
  };

  const removeFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const handleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      setUnavailableNotice(t.chat.voiceUnsupported);
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognitionRef.current = recognition;
    voiceBaseInputRef.current = inputValue.trimEnd();
    recognition.lang = speechLocale(language);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? "";
      }
      const separator = voiceBaseInputRef.current && transcript ? " " : "";
      setInputValue(`${voiceBaseInputRef.current}${separator}${transcript}`.trimStart());
    };
    recognition.onerror = () => {
      setIsListening(false);
      setUnavailableNotice(t.chat.voiceUnsupported);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.start();
    setIsListening(true);
    setUnavailableNotice(t.chat.voiceListening);
  };

  const showEmptyState = messages.length <= 1 && messages[0]?.id === "intro" && !conversationParam;
  const modelSelectorTitle =
    modelOptions.length === 0 ? "Локальный список моделей. Доступность проверит API." : "Модель ответа";

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] relative">
      <AuthPromptDialog open={isAuthPromptOpen} onClose={() => setIsAuthPromptOpen(false)} />
      <ShareSheet open={Boolean(sharePayload)} payload={sharePayload} onClose={() => setSharePayload(null)} />

      <header className="h-14 border-b border-white/10 flex items-center justify-between gap-3 px-4 md:px-6 shrink-0 bg-[#0A0A0A]/80 backdrop-blur-md absolute top-0 w-full z-10">
        <div className="text-sm font-medium text-gray-300">nomduchat</div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="chat-model-selector">
            Модель ответа
          </label>
          <label className="sr-only" htmlFor="chat-style-selector">
            Стиль ответа
          </label>
          <select
            id="chat-style-selector"
            value={responseStyleId}
            onChange={(event) => setResponseStyleId(event.target.value as ResponseStyleId)}
            className="hidden h-9 w-[9.5rem] rounded-full border border-white/10 bg-[#111111] px-3 text-xs font-medium text-gray-300 outline-none transition-colors hover:border-white/20 hover:text-white focus:border-white/30 md:block"
            title={`Стиль ответа: ${responseStyleLabel(responseStyleId)}`}
          >
            {responseStyles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
          <select
            id="chat-model-selector"
            value={selectedModelId}
            onChange={(event) => setSelectedModelId(event.target.value)}
            className="h-9 w-[8.5rem] rounded-full border border-white/10 bg-[#111111] px-3 text-xs font-medium text-gray-300 outline-none transition-colors hover:border-white/20 hover:text-white focus:border-white/30 sm:w-[13rem]"
            title={modelSelectorTitle}
          >
            <option value="auto">Авто</option>
            {modelGroups.map((group) => (
              <optgroup key={group.providerCode} label={group.providerName}>
                {group.models.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-400 transition-colors hover:border-white/20 hover:text-white"
            aria-label={t.chat.newChat}
            title={t.chat.newChat}
          >
            <MessageSquarePlus className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pt-20 pb-40 px-4 md:px-8 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {showEmptyState ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex min-h-[42vh] items-center justify-center text-4xl font-medium text-white md:text-5xl"
            >
              nomduchat
            </motion.div>
          ) : null}
          {messages.filter((msg) => !(showEmptyState && msg.id === "intro")).map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`group flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`${msg.generationJob ? "w-full max-w-[42rem]" : "max-w-[85%]"}`}>
                <div
                  className={`rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed border ${
                    msg.sender === "user"
                      ? "bg-[#1A1A1A] border-white/10 text-white"
                      : "bg-transparent border-transparent text-gray-200"
                  }`}
                >
                  {msg.generationJob ? (
                    <GenerationJobCard
                      job={msg.generationJob}
                      artifactUrl={mediaObjectUrls[msg.generationJob.id]}
                      isCancelling={cancellingGenerationIds.has(msg.generationJob.id)}
                      onCancel={() => handleCancelGeneration(msg.generationJob!)}
                      onShare={() => handleShareGenerationJob(msg.generationJob!, mediaObjectUrls[msg.generationJob!.id])}
                    />
                  ) : (
                    <FormattedMessageText text={msg.text} sender={msg.sender} />
                  )}
                  {msg.attachments?.length ? (
                    <div className="mt-3 space-y-2">
                      {msg.attachments.map((file) => (
                        <div key={file.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400">
                          <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
                          <span className="truncate">{file.name}</span>
                          <span className="shrink-0 text-gray-600">{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {msg.sender === "ai" && msg.id !== "intro" && (
                  <div className="mt-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      {copiedId === msg.id ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
                      ) : (
                        <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
                      )}
                      {copiedId === msg.id ? t.chat.copied : t.chat.copy}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareMessage(msg)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <Share2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Поделиться
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRegenerate(msg)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {t.chat.regenerate}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectBestAnswer(msg)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs transition-colors ${
                        msg.selectedBest || selectedBestAnswerId === msg.id
                          ? "bg-white text-black hover:bg-gray-200"
                          : "text-gray-500 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Star className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {msg.selectedBest || selectedBestAnswerId === msg.id ? t.chat.bestAnswerSelected : t.chat.bestAnswer}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-gray-500"
            >
              {t.chat.thinking}
            </motion.div>
          )}
          {unavailableNotice ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-400"
            >
              {unavailableNotice}
            </motion.div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div
        className={`absolute bottom-0 w-full bg-gradient-to-t pt-10 pb-6 px-4 md:px-8 ${
          theme === "light" ? "from-[#F4F6FA] via-[#F4F6FA] to-transparent" : "from-[#050505] via-[#050505] to-transparent"
        }`}
      >
        <div className="max-w-3xl mx-auto relative">
          {attachedFiles.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachedFiles.map((file) => (
                <div key={file.id} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-gray-300">
                  <FileText className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.7} />
                  <span className="max-w-[13rem] truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-gray-600">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    aria-label={t.chat.removeFile}
                    className="rounded-md p-1 text-gray-600 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="relative flex items-end bg-[#111111] border border-white/10 rounded-2xl overflow-hidden focus-within:border-white/20 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={handleFileButtonClick}
              aria-label={t.chat.attachFile}
              className="p-3.5 text-gray-400 hover:text-white transition-colors"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t.chat.placeholder}
              className="flex-1 max-h-48 min-h-[52px] resize-none border-none bg-transparent px-2 py-3.5 text-[15px] text-white outline-none ring-0 custom-scrollbar focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              rows={1}
            />
            <button
              type="button"
              onClick={handleVoiceInput}
              aria-label={isListening ? t.chat.stopVoice : t.chat.voiceInput}
              className={`p-3.5 transition-colors ${
                isListening ? "text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Mic className="h-5 w-5" />
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="p-3.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:hover:text-gray-400 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center mt-3 text-xs text-gray-500">
            {t.chat.disclaimer}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormattedMessageText({ text, sender }: { text: string; sender: Message["sender"] }) {
  const items = toReadableMessageItems(text);

  if (items.length === 0) return null;

  return (
    <div className={`space-y-3 ${sender === "user" ? "text-white" : "text-gray-200"}`}>
      {items.map((item, index) => {
        if (item.type === "heading") {
          return (
            <h3 key={`${item.text}-${index}`} className="text-base font-medium text-white">
              {item.text}
            </h3>
          );
        }

        if (item.type === "list") {
          return (
            <ol key={`${item.items.join("|")}-${index}`} className="space-y-1.5 pl-5">
              {item.items.map((line, lineIndex) => (
                <li key={`${line}-${lineIndex}`} className="list-decimal">
                  {line}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={`${item.text}-${index}`} className="whitespace-pre-wrap break-words">
            {item.text}
          </p>
        );
      })}
    </div>
  );
}

type ReadableMessageItem =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function toReadableMessageItems(text: string): ReadableMessageItem[] {
  const items: ReadableMessageItem[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    items.push({ type: "list", items: listBuffer });
    listBuffer = [];
  };

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      flushList();
      items.push({ type: "heading", text: cleanInlineMarkdown(line.replace(/^#{1,6}\s+/, "")) });
      continue;
    }

    if (/^([-*•]|\d+[.)])\s+/.test(line)) {
      listBuffer.push(cleanInlineMarkdown(line.replace(/^([-*•]|\d+[.)])\s+/, "")));
      continue;
    }

    flushList();
    items.push({ type: "paragraph", text: cleanInlineMarkdown(line) });
  }

  flushList();
  return items;
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}
