import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { motion } from "motion/react";
import {
  Bot,
  Check,
  Copy,
  FileText,
  ImageIcon,
  LoaderCircle,
  MessageSquarePlus,
  Mic,
  Paperclip,
  RotateCcw,
  Send,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Wand2,
  X,
} from "lucide-react";
import { useLanguage } from "../i18n";
import AuthPromptDialog from "../components/AuthPromptDialog";
import ShareSheet, { type SharePayload } from "../components/ShareSheet";
import TaskProgress, { type TaskProgressStep } from "../components/TaskProgress";
import TaskDock, { type TaskDockItem } from "../components/workspace/TaskDock";
import type { AiModelOptionApiRecord, MediaGenerationJobApiRecord, PlanId } from "../api-client";
import { getAiProviders } from "../api-client/agents";
import {
  getChatConversation,
  regenerateChatMessage,
  selectBestChatAnswer,
  sendChatMessageStream,
} from "../api-client/chat";
import {
  cancelGenerationJob,
  fetchGenerationArtifact,
  refreshGenerationJob,
} from "../api-client/generation";
import { toPublicApiError } from "../api-client/transport";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { formatFileSize, maxAttachedFileSize, maxAttachedFiles, readAttachment, speechLocale } from "./chat/attachments";
import { GenerationJobCard, generationStatusText, mediaExtension, mediaTitle } from "./chat/generation";
import { toApiAttachment, toAssistantMessage, toChatMessage } from "./chat/messageMappers";
import type { AttachedFile, Message } from "./chat/types";

const guestRequestStorageKey = "nomduchat-guest-chat-requests";
const modelSelectionStorageKey = "nomduchat-chat-model-id";
const agentStarterPrompts: Record<string, string> = {
  general: "Помоги разобраться с задачей. Сначала уточни, что важно, затем предложи короткий план действий.",
  business: "Разбери бизнес-задачу: цель, аудитория, оффер, следующий шаг и риски.",
  code: "Помоги с кодом. Сначала найди проблему, затем предложи минимальное исправление и проверку.",
  study: "Объясни тему простыми словами, затем дай пример и 3 вопроса для самопроверки.",
  documents: "Проанализируй документ: сделай краткое резюме, выдели риски и предложи правки.",
  presentations: "Собери презентацию: цель, аудитория, структура слайдов, тезисы и визуальные идеи.",
  image: "Собери промпт для изображения: стиль, композиция, объект, фон, свет и негативные ограничения.",
  video: "Сделай сценарий короткого видео: хук, сцены, текст ведущего и финальный призыв.",
  avatar: "Подготовь сценарий для avatar-video: кто говорит, тон, текст, фон и длительность.",
  music: "Подготовь идею песни или джингла: настроение, жанр, куплет, припев и варианты названия.",
  voice: "Подготовь текст для озвучки: темп, интонация, паузы и финальная версия дикторского текста.",
  marketing: "Собери маркетинговый план: аудитория, сообщение, каналы, креативы и быстрый тест.",
  support: "Подготовь ответ клиенту: спокойно, по делу, с решением и следующим шагом.",
};

type TaskChip = {
  label: string;
  prompt: string;
  icon: typeof Bot;
};

const taskChips: TaskChip[] = [
  {
    label: "Разобрать задачу",
    prompt: "Помоги решить задачу. Сначала уточни контекст, затем дай короткий план и готовый результат.",
    icon: Bot,
  },
  {
    label: "Разобрать документ",
    prompt: "Помоги разобрать документ: выдели главное, риски, спорные места и следующие действия.",
    icon: FileText,
  },
  {
    label: "Исследовать тему",
    prompt: "Проведи исследование темы: сравни факты, покажи источники, сделай вывод и предложи следующий шаг.",
    icon: Sparkles,
  },
];
const fallbackModelOptions: AiModelOptionApiRecord[] = withModelAccess([
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
    id: "openai:gpt-4o-mini",
    providerCode: "openai",
    providerName: "OpenAI",
    label: "OpenAI GPT-4o mini",
    description: "Экономичный режим OpenAI для быстрых ответов.",
    tier: "fast",
    minPlanId: null,
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
]);

function withModelAccess(
  options: Array<Omit<AiModelOptionApiRecord, "minPlanId" | "minPlanName"> & { minPlanId?: PlanId | null }>
): AiModelOptionApiRecord[] {
  return options.map((option) => {
    const minPlanId = "minPlanId" in option ? option.minPlanId ?? null : minimumPlanForModelOption(option);
    return {
      ...option,
      minPlanId,
      minPlanName: planDisplayName(minPlanId),
    };
  });
}

function minimumPlanForModelOption(option: Pick<AiModelOptionApiRecord, "id" | "label" | "tier">): PlanId | null {
  const normalizedLabel = option.label.toLowerCase();
  if (option.id === "openai:gpt-4o-mini") return null;
  if (option.id === "openai:configured" && normalizedLabel.includes("gpt-4o-mini")) return null;
  if (option.id === "openai:configured" && normalizedLabel.includes("o4-mini")) return "base";
  if (option.tier === "fast") return "base";
  if (option.tier === "balanced") return "ultra";
  return "pro";
}

function planDisplayName(planId: PlanId | null) {
  if (planId === null) return "Free";
  if (planId === "base") return "Easy Start";
  if (planId === "ultra") return "Active Work";
  if (planId === "pro") return "Team Mode";
  return "Business Cabinet";
}

function canUseModelOption(
  option: AiModelOptionApiRecord,
  currentPlanId: PlanId | string | null | undefined,
  hasAdminModelAccess = false,
) {
  if (hasAdminModelAccess) return true;
  if (!option.minPlanId) return true;
  return planRank(currentPlanId) >= planRank(option.minPlanId);
}

function modelOptionLabel(
  option: AiModelOptionApiRecord,
  currentPlanId: PlanId | string | null | undefined,
  hasAdminModelAccess = false,
) {
  if (canUseModelOption(option, currentPlanId, hasAdminModelAccess)) return option.label;
  return `${option.label} — с ${option.minPlanName}`;
}

function planRank(planId: PlanId | string | null | undefined) {
  if (planId === "base") return 1;
  if (planId === "ultra") return 2;
  if (planId === "pro") return 3;
  if (planId === "business") return 4;
  return 0;
}

export default function Chat() {
  const { language, t } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [taskStartedAt, setTaskStartedAt] = useState<number | undefined>();
  const [activeTaskFilesCount, setActiveTaskFilesCount] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedBestAnswerId, setSelectedBestAnswerId] = useState<string | null>(null);
  const [unavailableNotice, setUnavailableNotice] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [mediaObjectUrls, setMediaObjectUrls] = useState<Record<string, string>>({});
  const [imageReferenceJob, setImageReferenceJob] = useState<MediaGenerationJobApiRecord | null>(null);
  const [cancellingGenerationIds, setCancellingGenerationIds] = useState<Set<string>>(() => new Set());
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [modelOptions, setModelOptions] = useState<AiModelOptionApiRecord[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(() => {
    if (typeof window === "undefined") return "auto";
    return window.localStorage.getItem(modelSelectionStorageKey) ?? "auto";
  });
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceBaseInputRef = useRef("");
  const mediaObjectUrlsRef = useRef<Record<string, string>>({});
  const promptParam = searchParams.get("prompt");
  const agentParam = searchParams.get("agent");
  const networkParam = searchParams.get("network") ?? searchParams.get("model");
  const newChatParam = searchParams.get("new");
  const conversationParam = searchParams.get("conversationId");

  const currentPlanId = user?.activePlanId ?? null;
  const hasAdminModelAccess = Boolean(user?.permissions.adminPanel || user?.email?.trim().toLowerCase() === "dias.sunnatilla@gmail.com");
  const displayModelOptions = modelOptions.length > 0 ? modelOptions : fallbackModelOptions;
  const selectedModelOption = useMemo(
    () => displayModelOptions.find((option) => option.id === selectedModelId) ?? null,
    [displayModelOptions, selectedModelId]
  );
  const selectedModelLocked = Boolean(selectedModelOption && !canUseModelOption(selectedModelOption, currentPlanId, hasAdminModelAccess));
  const canSend = (Boolean(inputValue.trim()) || attachedFiles.length > 0) && !isThinking && !selectedModelLocked;
  const selectedModelForRequest = selectedModelId === "auto" || selectedModelLocked ? undefined : selectedModelId;
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
    if (messages.length <= 1 && messages[0]?.id === "intro") return;
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const loadProviders = () => {
      getAiProviders()
        .then((response) => {
          if (!active) return;
          setModelOptions(withModelAccess(response.models ?? []));
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
    if (selectedModelId === "auto") return;
    if (isAuthenticated && !user) return;

    const selectedOption = displayModelOptions.find((option) => option.id === selectedModelId);
    if (!selectedOption || !canUseModelOption(selectedOption, currentPlanId, hasAdminModelAccess)) {
      setSelectedModelId("auto");
    }
  }, [currentPlanId, displayModelOptions, hasAdminModelAccess, isAuthenticated, selectedModelId, user]);

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
    if (!networkParam) return;

    setSelectedModelId(networkParam === "auto" ? "auto" : networkParam);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("network");
      next.delete("model");
      return next;
    }, { replace: true });
  }, [networkParam, setSearchParams]);

  useEffect(() => {
    if (!agentParam) return;

    const starterPrompt = agentStarterPrompts[agentParam];
    if (starterPrompt && !promptParam) {
      setInputValue((current) => current.trim() ? current : starterPrompt);
    }
  }, [agentParam, promptParam]);

  useEffect(() => {
    if (!newChatParam) return;

    Object.values(mediaObjectUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    mediaObjectUrlsRef.current = {};
    setMediaObjectUrls({});
    setImageReferenceJob(null);
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

  const handleSend = async (prompt?: string) => {
    const repeatedPrompt = prompt?.trim();
    if ((!repeatedPrompt && !canSend) || isThinking) return;

    if (!isAuthenticated) {
      setIsAuthPromptOpen(true);
      return;
    }

    const messageText = repeatedPrompt || inputValue.trim() || t.chat.filePrompt;
    const filesForMessage = repeatedPrompt ? [] : attachedFiles;
    const referencedImageJob = imageReferenceJob ?? inferImageReferenceJob(messages, messageText);
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: "user",
      attachments: filesForMessage,
      imageReferenceJob: referencedImageJob ?? undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!repeatedPrompt) {
      setInputValue("");
      setAttachedFiles([]);
      setImageReferenceJob(null);
    }
    setUnavailableNotice(null);
    setIsThinking(true);
    setTaskStartedAt(Date.now());
    setActiveTaskFilesCount(filesForMessage.length);

    try {
      const assistantMessageId = `stream-${Date.now() + 1}`;
      let hasStreamingMessage = false;

      const response = await sendChatMessageStream({
        message: messageText,
        conversationId,
        agentId: agentParam ?? undefined,
        selectedModelId: selectedModelForRequest,
        language: language === "kk" ? "kz" : language,
        imageReferenceJobId: referencedImageJob?.id,
        attachments: filesForMessage.map(toApiAttachment),
      }, {
        onStart: (event) => {
          setConversationId(event.conversationId);
        },
        onDelta: (delta) => {
          setIsThinking(false);
          setTaskStartedAt(undefined);
          if (!hasStreamingMessage) {
            hasStreamingMessage = true;
            setMessages((prev) => [...prev, { id: assistantMessageId, text: delta, sender: "ai" }]);
            return;
          }

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? { ...message, text: `${message.text}${delta}` }
                : message
            )
          );
        },
      });

      setConversationId(response.conversationId);
      const assistantMessage = toAssistantMessage(response, t.chat.response);
      setMessages((prev) => {
        if (hasStreamingMessage) {
          return prev.map((message) => (message.id === assistantMessageId ? assistantMessage : message));
        }

        return [...prev, assistantMessage];
      });
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
      setTaskStartedAt(undefined);
      setActiveTaskFilesCount(0);
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

  const handleEditGenerationJob = (job: MediaGenerationJobApiRecord) => {
    setImageReferenceJob(job);
    setUnavailableNotice(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
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
    setTaskStartedAt(Date.now());
    setActiveTaskFilesCount(0);

    try {
      const response = await regenerateChatMessage({
        conversationId,
        agentId: agentParam ?? undefined,
        selectedModelId: selectedModelForRequest,
        language: language === "kk" ? "kz" : language,
      });
      setMessages((prev) => [...prev, toAssistantMessage(response, t.chat.regeneratedResponse)]);
    } catch (error) {
      setUnavailableNotice(toPublicApiError(error, t.chat.regenerateUnavailable));
    } finally {
      setIsThinking(false);
      setTaskStartedAt(undefined);
      setActiveTaskFilesCount(0);
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
    setImageReferenceJob(null);
    setInputValue("");
    setAttachedFiles([]);
    setConversationId(undefined);
    setUnavailableNotice(null);
    setIsThinking(false);
    setTaskStartedAt(undefined);
    setActiveTaskFilesCount(0);
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

  const applyTaskChip = (chip: TaskChip) => {
    setInputValue(chip.prompt);
    setUnavailableNotice(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const applyFollowUp = (prompt: string) => {
    setInputValue(prompt);
    setUnavailableNotice(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const showEmptyState = messages.length <= 1 && messages[0]?.id === "intro" && !conversationParam;
  const modelSelectorTitle =
    selectedModelLocked && selectedModelOption
      ? `Модель ${selectedModelOption.label} доступна с тарифа ${selectedModelOption.minPlanName}.`
      : hasAdminModelAccess
        ? "Админ-доступ: доступны все модели."
      : modelOptions.length === 0
        ? "Локальный список моделей. Доступность проверит API."
        : "Модель ответа";
  const selectedModelShortLabel = selectedModelId === "auto" ? "Авто" : selectedModelOption?.label ?? "Сеть";
  const progressSteps = useMemo(
    () => buildProgressSteps(selectedModelId, selectedModelOption, activeTaskFilesCount),
    [activeTaskFilesCount, selectedModelId, selectedModelOption]
  );
  const taskDockItems: TaskDockItem[] = [
    ...(isThinking
      ? [
          {
            id: "chat-response",
            title: "Готовлю ответ",
            subtitle: "NomduChat подбирает модель и собирает результат.",
            status: "running" as const,
            model: selectedModelShortLabel,
            steps: progressSteps,
          },
        ]
      : []),
    ...activeGenerationJobs.slice(0, 1).map((job) => ({
      id: job.id,
      title: mediaTitle(job.modality, job.status),
      subtitle: generationStatusText(job),
      status: job.status === "queued" ? ("queued" as const) : ("running" as const),
      model: job.model ?? job.provider,
      progress: job.status === "queued" ? 14 : undefined,
      onCancel: cancellingGenerationIds.has(job.id) ? undefined : () => void handleCancelGeneration(job),
    })),
  ];

  return (
    <div className="nd-chat-shell nd-shell-surface relative flex h-full flex-1 flex-col bg-[var(--canvas)]">
      <AuthPromptDialog open={isAuthPromptOpen} onClose={() => setIsAuthPromptOpen(false)} />
      <ShareSheet open={Boolean(sharePayload)} payload={sharePayload} onClose={() => setSharePayload(null)} />
      <TaskDock items={taskDockItems} />

      <header className="nd-chat-topbar nd-topbar absolute top-0 z-10 flex h-14 w-full shrink-0 items-center justify-between gap-3 bg-[#0A0A0A]/80 px-4 pr-28 backdrop-blur-md sm:pr-36 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="nd-icon-tile h-8 w-8" data-accent="orange">
            <Wand2 className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-200">nomduchat</div>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <label className="hidden text-xs font-medium text-[var(--nd-orange)] md:inline" htmlFor="chat-model-selector">
            Сеть
          </label>
          <select
            id="chat-model-selector"
            value={selectedModelId}
            onChange={(event) => setSelectedModelId(event.target.value)}
            className="nd-select h-9 w-[9.5rem] px-3 text-xs font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white sm:w-[18rem]"
            title={modelSelectorTitle}
          >
            <option value="auto">Авто · подобрать сеть</option>
            {modelGroups.map((group) => (
              <optgroup key={group.providerCode} label={group.providerName}>
                {group.models.map((option) => {
                  const isLocked = !canUseModelOption(option, currentPlanId, hasAdminModelAccess);

                  return (
                    <option key={option.id} value={option.id} disabled={isLocked}>
                      {modelOptionLabel(option, currentPlanId, hasAdminModelAccess)}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            onClick={handleNewChat}
            className="nd-secondary-action inline-flex h-9 w-9 items-center justify-center"
            aria-label={t.chat.newChat}
            title={t.chat.newChat}
          >
            <MessageSquarePlus className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>
      </header>

      {mobileControlsOpen ? (
        <div
          id="mobile-chat-controls"
          className="nd-chat-mobile-controls absolute left-3 right-3 z-20 rounded-2xl border border-white/10 bg-[#080808]/95 p-3 text-white shadow-2xl shadow-black/60 backdrop-blur sm:hidden"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs text-[var(--nd-orange)]">Сеть</span>
            <select
              value={selectedModelId}
              onChange={(event) => setSelectedModelId(event.target.value)}
              className="nd-select h-10 w-full px-3 text-sm"
              title={modelSelectorTitle}
            >
              <option value="auto">Авто · подобрать сеть</option>
              {modelGroups.map((group) => (
                <optgroup key={group.providerCode} label={group.providerName}>
                  {group.models.map((option) => {
                    const isLocked = !canUseModelOption(option, currentPlanId, hasAdminModelAccess);

                    return (
                      <option key={option.id} value={option.id} disabled={isLocked}>
                        {modelOptionLabel(option, currentPlanId, hasAdminModelAccess)}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="nd-chat-messages custom-scrollbar flex-1 overflow-y-auto px-4 pb-40 pt-20 md:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {showEmptyState ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="nd-chat-empty mx-auto flex min-h-[38vh] flex-col items-center justify-center py-6 text-center"
            >
              <h1 className="text-2xl font-medium leading-tight text-white md:text-3xl">Что сделаем?</h1>
              <div className="nd-chat-task-chips mt-5 flex flex-wrap justify-center gap-2">
                {taskChips.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => applyTaskChip(chip)}
                      className="nd-secondary-action inline-flex h-10 items-center gap-2 px-3.5 text-sm"
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
          {messages.filter((msg) => !(showEmptyState && msg.id === "intro")).map((msg) => {
            const isGenerationMessage = Boolean(msg.generationJob);

            return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`group flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`${isGenerationMessage ? "w-full max-w-[46rem]" : "max-w-[85%]"}`}>
                <div
                  className={
                    isGenerationMessage
                      ? "text-[15px] leading-relaxed"
                      : `rounded-2xl border px-5 py-3.5 text-[15px] leading-relaxed ${
                          msg.sender === "user"
                            ? "border-white/10 bg-[#1A1A1A] text-white"
                            : "border-transparent bg-transparent text-gray-200"
                        }`
                  }
                >
                  {msg.generationJob ? (
                    <GenerationJobCard
                      job={msg.generationJob}
                      artifactUrl={mediaObjectUrls[msg.generationJob.id]}
                      isCancelling={cancellingGenerationIds.has(msg.generationJob.id)}
                      onCancel={() => handleCancelGeneration(msg.generationJob!)}
                      onEdit={
                        msg.generationJob.modality === "image" && msg.generationJob.status === "succeeded"
                          ? () => handleEditGenerationJob(msg.generationJob!)
                          : undefined
                      }
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
                  {msg.imageReferenceJob ? (
                    <ImageReferenceBadge
                      job={msg.imageReferenceJob}
                      artifactUrl={mediaObjectUrls[msg.imageReferenceJob.id]}
                    />
                  ) : null}
                </div>

                {msg.sender === "ai" && msg.id !== "intro" && !msg.generationJob && (
                  <>
                  <div className="nd-message-actions mt-2 flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                      aria-label="Копировать ответ"
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
                      aria-label="Поделиться ответом"
                    >
                      <Share2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Поделиться
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRegenerate(msg)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                      aria-label="Создать новый ответ"
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
                      aria-label="Отметить лучший ответ"
                    >
                      <Star className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {msg.selectedBest || selectedBestAnswerId === msg.id ? t.chat.bestAnswerSelected : t.chat.bestAnswer}
                    </button>
                  </div>
                  <MessageNextActions text={msg.text} onSelect={applyFollowUp} />
                  </>
                )}
                {msg.sender === "user" ? (
                  <div className="nd-message-actions mt-2 flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => applyFollowUp(msg.text)}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                      aria-label="Редактировать запрос"
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSend(msg.text)}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                      aria-label="Повторить запрос"
                    >
                      Повторить
                    </button>
                  </div>
                ) : null}
              </div>
            </motion.div>
            );
          })}
          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <TaskProgress steps={progressSteps} startedAt={taskStartedAt} />
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
        className={`nd-chat-composer absolute bottom-0 w-full bg-gradient-to-t px-4 pb-6 pt-10 md:px-8 ${
          theme === "light" ? "from-[#F4F6FA] via-[#F4F6FA] to-transparent" : "from-[#050505] via-[#050505] to-transparent"
        }`}
      >
        <div className="mx-auto max-w-3xl relative">
          {attachedFiles.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachedFiles.map((file) => (
                <div key={file.id} className="nd-card inline-flex max-w-full items-center gap-2 px-3 py-2 text-sm text-gray-300">
                  <FileText className="h-4 w-4 shrink-0 text-[var(--nd-blue)]" strokeWidth={1.7} />
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

          {imageReferenceJob ? (
            <div className="nd-card mb-3 flex items-center gap-3 p-2.5">
              <div className="h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-black">
                {mediaObjectUrls[imageReferenceJob.id] ? (
                  <img
                    src={mediaObjectUrls[imageReferenceJob.id]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-500">
                    <ImageIcon className="h-5 w-5" strokeWidth={1.7} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--nd-orange)]">Редактируем изображение</div>
                <div className="mt-1 truncate text-sm text-gray-300">{imageReferenceJob.prompt}</div>
              </div>
              <button
                type="button"
                onClick={() => setImageReferenceJob(null)}
                aria-label="Не редактировать изображение"
                className="nd-secondary-action inline-flex h-9 w-9 shrink-0 items-center justify-center"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          ) : null}

          <div className="nd-chat-composer-inner nd-card relative flex items-end overflow-hidden transition-colors focus-within:border-white/20">
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
              className="nd-chat-tool-button text-gray-400 transition-colors hover:text-[var(--nd-blue)]"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileControlsOpen((open) => !open)}
              aria-expanded={mobileControlsOpen}
              aria-controls="mobile-chat-controls"
              aria-label="Настройки ответа"
              title="Настройки ответа"
              className="nd-chat-tool-button text-gray-400 transition-colors hover:text-[var(--nd-orange)] sm:hidden"
            >
              <SlidersHorizontal className="h-5 w-5" strokeWidth={1.8} />
              <span className="sr-only">{selectedModelShortLabel}</span>
            </button>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={t.chat.placeholder}
              className="min-w-0 flex-1 max-h-48 min-h-[52px] resize-none border-none bg-transparent px-1 py-3.5 text-sm text-white outline-none ring-0 custom-scrollbar focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 sm:px-2 sm:text-[15px]"
              rows={1}
            />
            <button
              type="button"
              onClick={handleVoiceInput}
              aria-label={isListening ? t.chat.stopVoice : t.chat.voiceInput}
              className={`nd-chat-tool-button transition-colors ${
                isListening ? "text-[var(--nd-orange)]" : "text-gray-400 hover:text-[var(--nd-orange)]"
              }`}
            >
              <Mic className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label={isThinking ? "Отправка запроса" : "Отправить запрос"}
              className="nd-chat-send inline-flex shrink-0 items-center justify-center text-gray-400 transition-colors hover:text-white disabled:opacity-50 disabled:hover:text-gray-400 enabled:hover:text-[var(--nd-orange)]"
            >
              {isThinking ? <LoaderCircle className="h-5 w-5 animate-spin" strokeWidth={1.8} /> : <Send className="w-5 h-5" />}
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

type FollowUpAction = {
  label: string;
  prompt: string;
};

function MessageNextActions({ text, onSelect }: { text: string; onSelect: (prompt: string) => void }) {
  const actions = buildMessageActions(text);

  return (
    <div className="nd-message-actions mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => onSelect(action.prompt)}
          className="nd-secondary-action inline-flex h-9 items-center justify-center px-3 text-xs"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function buildMessageActions(text: string): FollowUpAction[] {
  const source = text.trim();
  const excerpt = source.length > 1800 ? `${source.slice(0, 1800)}...` : source;
  const normalized = source.toLowerCase();

  if (source.includes("```") || containsAny(normalized, ["код", "ошибка", "api", "typescript", "react"])) {
    return [
      { label: "Найти риски", prompt: `Проверь этот ответ на ошибки, риски и пропущенные проверки:\n\n${excerpt}` },
      { label: "Добавить тесты", prompt: `Предложи минимальные тесты для этого решения:\n\n${excerpt}` },
      { label: "Сделать короче", prompt: `Сократи ответ и оставь только действия:\n\n${excerpt}` },
    ];
  }

  if (containsAny(normalized, ["исслед", "источник", "рынок", "конкурент"])) {
    return [
      { label: "Собрать таблицу", prompt: `Собери выводы в таблицу с критериями и короткими комментариями:\n\n${excerpt}` },
      { label: "Создать презентацию", prompt: `Преврати это в структуру презентации на 8-10 слайдов:\n\n${excerpt}` },
      { label: "Проверить источники", prompt: `Проверь, какие утверждения требуют источников, и составь список проверки:\n\n${excerpt}` },
    ];
  }

  if (source.length > 900) {
    return [
      { label: "Сократить", prompt: `Сократи текст без потери смысла:\n\n${excerpt}` },
      { label: "Сделать официальнее", prompt: `Перепиши текст в деловом стиле:\n\n${excerpt}` },
      { label: "Сохранить как план", prompt: `Сделай из этого пошаговый план с задачами и сроками:\n\n${excerpt}` },
    ];
  }

  return [
    { label: "Развернуть", prompt: `Раскрой ответ подробнее и добавь примеры:\n\n${excerpt}` },
    { label: "Сделать план", prompt: `Преврати ответ в короткий план действий:\n\n${excerpt}` },
    { label: "Перевести", prompt: `Переведи ответ на английский и сохрани смысл:\n\n${excerpt}` },
  ];
}

function buildProgressSteps(
  selectedModelId: string,
  selectedModelOption: AiModelOptionApiRecord | null,
  filesCount: number,
): TaskProgressStep[] {
  const modelLabel = selectedModelId === "auto" ? "Auto-режим" : selectedModelOption?.label ?? "выбранная сеть";
  const steps: TaskProgressStep[] = [
    {
      id: "request",
      label: "Запрос отправлен",
      status: "completed",
      detail: "Текст и доступные вложения переданы в API.",
    },
    {
      id: "model",
      label: selectedModelId === "auto" ? "Auto-режим получил задачу" : "Модель выбрана вручную",
      status: "completed",
      detail: modelLabel,
    },
  ];

  if (filesCount > 0) {
    steps.push({
      id: "files",
      label: "Вложения подготовлены",
      status: "completed",
      detail: `${filesCount} файл(ов) добавлено к запросу.`,
    });
  }

  steps.push({
    id: "stream",
    label: "Жду первый фрагмент ответа",
    status: "running",
    detail: "Когда backend начнет streaming, карточка заменится ответом.",
  });

  return steps;
}

function FormattedMessageText({ text, sender }: { text: string; sender: Message["sender"] }) {
  const items = toReadableMessageItems(text);

  if (items.length === 0) return null;

  return (
    <div className={`${sender === "user" ? "space-y-2.5 text-white" : "space-y-4 text-gray-200"}`}>
      {items.map((item, index) => {
        if (item.type === "heading") {
          const headingClass =
            item.level <= 2
              ? "text-lg font-semibold leading-snug text-white"
              : "text-base font-semibold leading-snug text-white";

          return (
            <h3 key={`heading-${item.text}-${index}`} className={headingClass}>
              {renderInlineMarkdown(item.text)}
            </h3>
          );
        }

        if (item.type === "list") {
          const ListTag = item.ordered ? "ol" : "ul";

          return (
            <ListTag
              key={`list-${item.items.join("|")}-${index}`}
              className={`space-y-1.5 pl-5 marker:text-gray-500 ${item.ordered ? "list-decimal" : "list-disc"}`}
            >
              {item.items.map((line, lineIndex) => (
                <li key={`${line}-${lineIndex}`} className="break-words pl-1 leading-relaxed">
                  {renderInlineMarkdown(line)}
                </li>
              ))}
            </ListTag>
          );
        }

        if (item.type === "code") {
          return (
            <div key={`code-${index}`} className="overflow-hidden rounded-xl border border-white/10 bg-black/50">
              {item.language ? (
                <div className="border-b border-white/10 px-3 py-1.5 text-xs text-gray-500">{item.language}</div>
              ) : null}
              <pre className="overflow-x-auto p-3 text-sm leading-relaxed text-gray-200">
                <code>{item.code}</code>
              </pre>
            </div>
          );
        }

        if (item.type === "quote") {
          return (
            <blockquote key={`quote-${item.text}-${index}`} className="border-l-2 border-white/20 pl-4 text-gray-400">
              {renderInlineMarkdown(item.text)}
            </blockquote>
          );
        }

        if (item.type === "table") {
          return (
            <div key={`table-${index}`} className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-white/[0.04] text-gray-300">
                  <tr>
                    {item.headers.map((header, headerIndex) => (
                      <th key={`${header}-${headerIndex}`} className="border-b border-white/10 px-3 py-2 font-medium">
                        {renderInlineMarkdown(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {item.rows.map((row, rowIndex) => (
                    <tr key={`${row.join("|")}-${rowIndex}`} className="border-t border-white/5">
                      {row.map((cell, cellIndex) => (
                        <td key={`${cell}-${cellIndex}`} className="px-3 py-2 text-gray-300">
                          {renderInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (item.type === "rule") {
          return <div key={`rule-${index}`} className="h-px bg-white/10" />;
        }

        return (
          <p key={`paragraph-${item.text}-${index}`} className="break-words leading-relaxed">
            {renderInlineMarkdown(item.text)}
          </p>
        );
      })}
    </div>
  );
}

function ImageReferenceBadge({ job, artifactUrl }: { job: MediaGenerationJobApiRecord; artifactUrl?: string }) {
  return (
    <div className="mt-3 flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 text-xs text-gray-400">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black">
        {artifactUrl ? (
          <img src={artifactUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-4 w-4" strokeWidth={1.7} />
          </div>
        )}
      </div>
      <span className="min-w-0 flex-1 truncate">Правка изображения: {job.prompt}</span>
    </div>
  );
}

function inferImageReferenceJob(messages: Message[], message: string) {
  if (!looksLikeImageEditRequest(message)) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const job = messages[index].generationJob;
    if (job?.modality === "image" && job.status === "succeeded") return job;
  }

  return null;
}

function looksLikeImageEditRequest(message: string) {
  const normalized = message.toLowerCase();
  const hasImageReference = containsAny(normalized, [
    "на этой картин",
    "на этом изображ",
    "на этом фото",
    "эту картин",
    "это изображ",
    "this image",
    "same image",
    "картин",
    "изображ",
    "фото",
    "image",
    "picture",
  ]);
  const hasEditIntent = containsAny(normalized, [
    "добавь",
    "добавить",
    "надпись",
    "напиши",
    "измени",
    "поменяй",
    "убери",
    "замени",
    "перерисуй",
    "add",
    "edit",
    "remove",
    "replace",
    "change",
  ]);

  return hasImageReference && hasEditIntent || containsAny(normalized, [
    "добавь надпись",
    "добавить надпись",
    "добавь текст",
    "напиши на",
    "убери фон",
    "замени фон",
    "поменяй фон",
    "add text",
    "remove background",
    "change background",
  ]);
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

type ReadableMessageItem =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language?: string; code: string }
  | { type: "quote"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "rule" };

function toReadableMessageItems(text: string): ReadableMessageItem[] {
  const normalizedText = normalizeReadableText(text);
  const lines = normalizedText.replace(/\r\n/g, "\n").split("\n");
  const items: ReadableMessageItem[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: Extract<ReadableMessageItem, { type: "list" }> | null = null;
  let codeBuffer: string[] | null = null;
  let codeLanguage: string | undefined;

  const flushParagraph = () => {
    const paragraph = paragraphBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (paragraph) items.push({ type: "paragraph", text: paragraph });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer && listBuffer.items.length > 0) {
      items.push(listBuffer);
    }
    listBuffer = null;
  };

  const flushTextBlocks = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (codeBuffer) {
      if (/^```/.test(line)) {
        items.push({ type: "code", language: codeLanguage, code: codeBuffer.join("\n").replace(/\n+$/, "") });
        codeBuffer = null;
        codeLanguage = undefined;
      } else {
        codeBuffer.push(rawLine);
      }
      continue;
    }

    if (!line) {
      if (listBuffer && nextTextLineContinuesList(lines, index + 1, listBuffer.ordered)) {
        continue;
      }
      flushTextBlocks();
      continue;
    }

    const codeMatch = line.match(/^```([A-Za-z0-9_-]+)?\s*$/);
    if (codeMatch) {
      flushTextBlocks();
      codeBuffer = [];
      codeLanguage = codeMatch[1];
      continue;
    }

    if (isTableStart(lines, index)) {
      flushTextBlocks();
      const headers = parseTableRow(lines[index]);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(normalizeTableRow(parseTableRow(lines[index]), headers.length));
        index += 1;
      }
      index -= 1;
      if (headers.length > 0 && rows.length > 0) {
        items.push({ type: "table", headers, rows });
      }
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushTextBlocks();
      items.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
      continue;
    }

    if (/^([-*_])\1\1+$/.test(line)) {
      flushTextBlocks();
      items.push({ type: "rule" });
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushTextBlocks();
      const quoteLines = [line.replace(/^>\s?/, "").trim()];
      while (index + 1 < lines.length && /^>\s?/.test(lines[index + 1].trim())) {
        index += 1;
        quoteLines.push(lines[index].trim().replace(/^>\s?/, "").trim());
      }
      items.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    const orderedListMatch = line.match(/^\d+[.)]\s+(.+)$/);
    const unorderedListMatch = line.match(/^[-*•]\s+(.+)$/);
    if (orderedListMatch || unorderedListMatch) {
      flushParagraph();
      const ordered = Boolean(orderedListMatch);
      const listText = (orderedListMatch?.[1] ?? unorderedListMatch?.[1] ?? "").trim();
      if (!listBuffer || listBuffer.ordered !== ordered) {
        flushList();
        listBuffer = { type: "list", ordered, items: [] };
      }
      listBuffer.items.push(listText);
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  if (codeBuffer) {
    items.push({ type: "code", language: codeLanguage, code: codeBuffer.join("\n").replace(/\n+$/, "") });
  }

  flushTextBlocks();
  return items;
}

function normalizeReadableText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.includes("```") || trimmed.split("\n").filter((line) => line.trim()).length > 1) return trimmed;

  const withDetectedBreaks = trimmed
    .replace(/\s+((?:\d+[.)]|[-*•])\s+)/g, "\n$1")
    .replace(/\s+(#{1,6}\s+)/g, "\n\n$1");

  if (withDetectedBreaks.includes("\n") || withDetectedBreaks.length <= 360) return withDetectedBreaks;

  const sentences =
    withDetectedBreaks
      .match(/[^.!?…]+[.!?…]+(?:\s+|$)|[^.!?…]+$/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];

  if (sentences.length <= 2) return withDetectedBreaks;

  const paragraphs: string[] = [];
  let buffer: string[] = [];
  let bufferLength = 0;

  for (const sentence of sentences) {
    buffer.push(sentence);
    bufferLength += sentence.length;
    if (buffer.length >= 2 || bufferLength >= 280) {
      paragraphs.push(buffer.join(" "));
      buffer = [];
      bufferLength = 0;
    }
  }

  if (buffer.length > 0) paragraphs.push(buffer.join(" "));
  return paragraphs.join("\n\n");
}

function nextTextLineContinuesList(lines: string[], startIndex: number, ordered: boolean) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    return ordered ? /^\d+[.)]\s+/.test(line) : /^[-*•]\s+/.test(line);
  }

  return false;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(
        <strong key={`${token}-${match.index}`} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={`${token}-${match.index}`} className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.92em] text-gray-100">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const label = linkMatch?.[1] ?? token;
      const href = safeInlineHref(linkMatch?.[2]);
      nodes.push(
        href ? (
          <a
            key={`${token}-${match.index}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-white underline decoration-white/35 underline-offset-4 transition-colors hover:decoration-white"
          >
            {label}
          </a>
        ) : (
          label
        )
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function safeInlineHref(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? value : null;
  } catch {
    return value.startsWith("/") && !value.startsWith("//") ? value : null;
  }
}

function isTableStart(lines: string[], index: number) {
  return lines[index]?.includes("|") && isTableSeparator(lines[index + 1] ?? "");
}

function isTableSeparator(line: string) {
  const cells = parseTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function normalizeTableRow(row: string[], length: number) {
  if (row.length === length) return row;
  if (row.length > length) return row.slice(0, length);
  return [...row, ...Array.from({ length: length - row.length }, () => "")];
}
