import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router";
import { motion } from "motion/react";
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  MessageSquarePlus,
  Mic,
  Paperclip,
  RotateCcw,
  Send,
  Star,
  X,
} from "lucide-react";
import { useLanguage } from "../i18n";
import AuthPromptDialog from "../components/AuthPromptDialog";
import {
  getAgents,
  getChatConversation,
  regenerateChatMessage,
  selectBestChatAnswer,
  sendChatMessage,
  toPublicApiError,
  type ChatAttachmentInput,
  type ChatApiMessage,
  type ChatApiResponse,
} from "../api";
import { useAuth } from "../auth";
import { useTheme } from "../theme";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  attachments?: AttachedFile[];
  selectedBest?: boolean;
}

type AttachedFile = ChatAttachmentInput & {
  id: string;
};

type AgentOption = {
  id: string;
  title: string;
  description: string;
};

const fallbackAgentIds = ["general", "business", "code", "study"] as const;
const maxAttachedFiles = 5;
const maxFileContentChars = 12_000;
const guestRequestStorageKey = "nomduchat-guest-chat-requests";
const textFilePattern = /\.(txt|md|markdown|csv|json|jsonl|ts|tsx|js|jsx|html|css|py|java|cs|go|rs|sql|xml|yaml|yml|log)$/i;

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
  const [apiAgents, setApiAgents] = useState<Array<{ id: string; name: string; description: string }> | null>(null);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceBaseInputRef = useRef("");
  const selectedAgentId = searchParams.get("agent");
  const conversationParam = searchParams.get("conversationId");

  const agentOptions = useMemo<AgentOption[]>(() => {
    if (apiAgents?.length) {
      return apiAgents.map((agent) => {
        const translationIndex = fallbackAgentIds.findIndex((id) => id === agent.id);
        const fallback = t.agents.items[translationIndex >= 0 ? translationIndex : 0];
        return {
          id: agent.id,
          title: fallback?.title ?? agent.name,
          description: fallback?.description ?? agent.description,
        };
      });
    }

    return fallbackAgentIds.map((id, index) => ({
      id,
      title: t.agents.items[index]?.title ?? id,
      description: t.agents.items[index]?.description ?? "",
    }));
  }, [apiAgents, t.agents.items]);

  const selectedAgent = agentOptions.find((agent) => agent.id === selectedAgentId);
  const activeAgentId = selectedAgent?.id;
  const modelLabel = selectedAgent ? `nomduchat · ${selectedAgent.title}` : t.chat.model;
  const canSend = Boolean(inputValue.trim()) || attachedFiles.length > 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0 || (prev.length === 1 && prev[0].id === "intro")) {
        return [{ id: "intro", text: t.chat.initial, sender: "ai" }];
      }
      return prev;
    });
  }, [t.chat.initial]);

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (!prompt) return;

    setInputValue(prompt);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("prompt");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!conversationParam) return;

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
  }, [conversationParam]);

  useEffect(() => {
    let active = true;

    getAgents()
      .then((response) => {
        if (!active) return;
        setApiAgents(response.agents);
      })
      .catch(() => {
        if (!active) return;
        setApiAgents(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    window.localStorage.removeItem(guestRequestStorageKey);
    setIsAuthPromptOpen(false);
  }, [isAuthenticated]);

  const handleAgentSelect = (agentId: string | null) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (agentId) {
        next.set("agent", agentId);
      } else {
        next.delete("agent");
      }
      return next;
    });
    setIsModeMenuOpen(false);
  };

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
        agentId: activeAgentId,
        language: language === "kk" ? "kz" : language,
        attachments: filesForMessage.map(toApiAttachment),
      });

      setConversationId(response.conversationId);
      setMessages((prev) => [...prev, toAssistantMessage(response, t.chat.response)]);
    } catch {
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: t.chat.response,
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

  const handleRegenerate = async () => {
    if (!conversationId) {
      setUnavailableNotice(t.chat.regenerateUnavailable);
      return;
    }

    setUnavailableNotice(null);
    setIsThinking(true);

    try {
      const response = await regenerateChatMessage({
        conversationId,
        agentId: activeAgentId,
        language: language === "kk" ? "kz" : language,
      });
      setMessages((prev) => [...prev, toAssistantMessage(response, t.chat.regeneratedResponse)]);
    } catch {
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: t.chat.regeneratedResponse,
        sender: "ai",
      };
      setMessages((prev) => [...prev, fallbackMessage]);
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
    setMessages([{ id: "intro", text: t.chat.initial, sender: "ai" }]);
    setInputValue("");
    setAttachedFiles([]);
    setConversationId(undefined);
    setUnavailableNotice(null);
    setIsThinking(false);
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []).slice(0, maxAttachedFiles - attachedFiles.length);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    const files = await Promise.all(selectedFiles.map(readAttachment));
    setAttachedFiles((prev) => [...prev, ...files].slice(0, maxAttachedFiles));
    setUnavailableNotice(files.some((file) => file.content) ? t.chat.fileReadLimit : t.chat.fileUnsupported);
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

  const showSuggestions = messages.length <= 1 && !isThinking;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] relative">
      <AuthPromptDialog open={isAuthPromptOpen} onClose={() => setIsAuthPromptOpen(false)} />

      <header className="h-14 border-b border-white/10 flex items-center justify-between gap-3 px-4 md:px-6 shrink-0 bg-[#0A0A0A]/80 backdrop-blur-md absolute top-0 w-full z-10">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsModeMenuOpen((open) => !open)}
            className="flex max-w-[220px] items-center gap-2 text-sm font-medium text-gray-200 transition-colors hover:text-white sm:max-w-none"
            aria-expanded={isModeMenuOpen}
          >
            <span className="truncate">{modelLabel}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${isModeMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {isModeMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute left-0 top-9 z-30 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#080808] shadow-2xl shadow-black/60"
            >
              <div className="border-b border-white/10 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                {t.chat.modeMenuTitle}
              </div>
              <div className="max-h-80 overflow-y-auto py-1 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => handleAgentSelect(null)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-white/10 ${
                    !selectedAgent ? "text-white" : "text-gray-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{t.chat.autoMode}</span>
                    {!selectedAgent ? <Check className="h-4 w-4 shrink-0" strokeWidth={1.7} /> : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{t.workspaceHome.hint}</p>
                </button>
                {agentOptions.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleAgentSelect(agent.id)}
                    className={`w-full border-t border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10 ${
                      selectedAgent?.id === agent.id ? "text-white" : "text-gray-400"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{agent.title}</span>
                      {selectedAgent?.id === agent.id ? <Check className="h-4 w-4 shrink-0" strokeWidth={1.7} /> : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600">{agent.description}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleNewChat}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-white/20 hover:text-white"
        >
          <MessageSquarePlus className="h-4 w-4" strokeWidth={1.7} />
          <span className="hidden sm:inline">{t.chat.newChat}</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pt-20 pb-40 px-4 md:px-8 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`group flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[85%]">
                <div
                  className={`rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed border ${
                    msg.sender === "user"
                      ? "bg-[#1A1A1A] border-white/10 text-white"
                      : "bg-transparent border-transparent text-gray-200"
                  }`}
                >
                  {msg.text}
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
                      onClick={handleRegenerate}
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
          {showSuggestions && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2 pt-2"
              >
                {t.chat.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInputValue(suggestion)}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"
              >
                <div className="mb-3 text-xs font-medium text-gray-500">{t.chat.favoritePromptsTitle}</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {t.chat.favoritePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInputValue(prompt)}
                      className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:border-white/15 hover:text-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
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

function toAssistantMessage(response: ChatApiResponse, fallback: string): Message {
  return {
    id: response.assistantMessage?.id ?? (Date.now() + 1).toString(),
    text: response.assistantMessage?.content ?? fallback,
    sender: "ai",
    selectedBest: Boolean(response.answerVariant?.isSelected),
  };
}

function toChatMessage(message: ChatApiMessage): Message {
  return {
    id: message.id,
    text: message.content,
    sender: message.role === "user" ? "user" : "ai",
  };
}

function toApiAttachment(file: AttachedFile): ChatAttachmentInput {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    content: file.content,
    truncated: file.truncated,
  };
}

async function readAttachment(file: File): Promise<AttachedFile> {
  const base = {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  };

  if (!isTextFile(file)) {
    return base;
  }

  const content = await file.text();
  return {
    ...base,
    content: content.slice(0, maxFileContentChars),
    truncated: content.length > maxFileContentChars,
  };
}

function isTextFile(file: File) {
  return file.type.startsWith("text/") || textFilePattern.test(file.name);
}

function speechLocale(language: string) {
  if (language === "en") return "en-US";
  if (language === "kk") return "kk-KZ";
  return "ru-RU";
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
