import { useState, useRef, useEffect } from "react";
import type { ChangeEvent } from "react";
import { useSearchParams } from "react-router";
import { motion } from "motion/react";
import { Check, ChevronDown, Copy, MessageSquarePlus, Mic, Paperclip, RotateCcw, Send, Square, X } from "lucide-react";
import { useLanguage } from "../i18n";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
}

export default function Chat() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentIds = ["general", "business", "code", "study", "docs"];
  const agentId = searchParams.get("agent");
  const agentIndex = agentId ? agentIds.indexOf(agentId) : -1;
  const modelLabel = agentIndex >= 0 ? `Nerix · ${t.agents.items[agentIndex].title}` : t.chat.model;

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

  const handleSend = () => {
    if (!inputValue.trim() && attachedFiles.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: attachedFiles.length > 0
        ? `${inputValue || t.chat.attachFile}\n${attachedFiles.map((file) => `• ${file}`).join("\n")}`
        : inputValue,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setAttachedFiles([]);
    setIsThinking(true);

    // Mock AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: t.chat.response,
        sender: "ai",
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsThinking(false);
    }, 1000);
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

  const handleRegenerate = (messageId: string) => {
    setIsThinking(true);
    window.setTimeout(() => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? { ...message, text: t.chat.regeneratedResponse }
            : message
        )
      );
      setIsThinking(false);
    }, 800);
  };

  const handleNewChat = () => {
    setMessages([{ id: "intro", text: t.chat.initial, sender: "ai" }]);
    setInputValue("");
    setAttachedFiles([]);
    setIsThinking(false);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).map((file) => file.name);
    setAttachedFiles((prev) => [...prev, ...files].slice(0, 4));
    event.target.value = "";
  };

  const toggleVoice = () => {
    setIsRecording((current) => {
      const next = !current;
      if (!current && !inputValue) {
        setInputValue(t.chat.voiceInput);
      }
      return next;
    });
  };

  const showSuggestions = messages.length <= 1 && !isThinking;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] relative">
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between gap-3 px-4 md:px-6 shrink-0 bg-[#0A0A0A]/80 backdrop-blur-md absolute top-0 w-full z-10">
        <button className="flex items-center gap-2 text-sm font-medium text-gray-200 hover:text-white transition-colors whitespace-nowrap">
          {modelLabel}
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
        <button
          type="button"
          onClick={handleNewChat}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-white/20 hover:text-white"
        >
          <MessageSquarePlus className="h-4 w-4" strokeWidth={1.7} />
          <span className="hidden sm:inline">{t.chat.newChat}</span>
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pt-20 pb-24 px-4 md:px-8 custom-scrollbar">
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
                </div>

                {msg.sender === "ai" && (
                  <div className="mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
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
                      onClick={() => handleRegenerate(msg.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {t.chat.regenerate}
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
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="absolute bottom-0 w-full bg-gradient-to-t from-[#050505] via-[#050505] to-transparent pt-10 pb-6 px-4 md:px-8">
        <div className="max-w-3xl mx-auto relative">
          {attachedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="px-1 py-1 text-xs text-gray-500">{t.chat.attachedFiles}</span>
              {attachedFiles.map((file) => (
                <span
                  key={file}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111111] px-3 py-1.5 text-xs text-gray-300"
                >
                  {file}
                  <button
                    type="button"
                    onClick={() => setAttachedFiles((prev) => prev.filter((item) => item !== file))}
                    className="text-gray-500 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative flex items-end bg-[#111111] border border-white/10 rounded-2xl overflow-hidden focus-within:border-white/20 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
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
              className="flex-1 max-h-48 min-h-[52px] bg-transparent border-none text-white focus:ring-0 resize-none py-3.5 px-2 text-[15px] custom-scrollbar"
              rows={1}
            />
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={isRecording ? t.chat.stopVoice : t.chat.voiceInput}
              className={`p-3.5 transition-colors ${
                isRecording ? "text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() && attachedFiles.length === 0}
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
