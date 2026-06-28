import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  Globe,
  Loader2,
  Palette,
  Plus,
  Rocket,
  Save,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "../auth";
import BusinessWebsiteRenderer from "../components/BusinessWebsiteRenderer";
import ShareSheet, { type SharePayload } from "../components/ShareSheet";
import {
  createBusinessWebsiteDraft,
  getBusinessWebsites,
  publishBusinessWebsite,
  toPublicApiError,
  updateBusinessWebsite,
  type BusinessWebsiteApiRecord,
  type BusinessWebsiteContentApiRecord,
  type BusinessWebsiteCountry,
  type BusinessWebsiteSectionApiRecord,
  type BusinessWebsiteStyle,
  type BusinessWebsiteType,
  type CreateBusinessWebsiteDraftInput,
} from "../api";

const initialInput: CreateBusinessWebsiteDraftInput = {
  country: "KZ",
  prompt: "",
  companyName: "",
  city: "",
  contact: "",
  style: "clean",
  siteType: "landing",
};

const styleOptions: Array<{ value: BusinessWebsiteStyle; label: string; detail: string }> = [
  { value: "clean", label: "Чистый", detail: "Светлый сайт для услуг" },
  { value: "premium", label: "Премиум", detail: "Темный, спокойный, дорогой" },
  { value: "bold", label: "Яркий", detail: "Для продаж и акций" },
  { value: "warm", label: "Теплый", detail: "Для локального бизнеса" },
];

const siteTypeOptions: Array<{ value: BusinessWebsiteType; label: string; detail: string }> = [
  { value: "landing", label: "Лендинг", detail: "Одна страница с заявкой" },
  { value: "services", label: "Услуги", detail: "Описание услуг и условий" },
  { value: "catalog", label: "Каталог", detail: "Товары или направления" },
];

type WebsiteWizardStep = {
  key: "brief" | "details" | "style" | "review";
  title: string;
  text: string;
};

const websiteWizardSteps: WebsiteWizardStep[] = [
  {
    key: "brief",
    title: "Что должен сказать сайт",
    text: "Одного сообщения достаточно. Опишите бизнес, клиентов, услугу и что человек должен сделать после просмотра.",
  },
  {
    key: "details",
    title: "Куда вести заявку",
    text: "Нужны название и контакт, чтобы кнопки на сайте сразу работали на продажу или запись.",
  },
  {
    key: "style",
    title: "Как сайт должен выглядеть",
    text: "Выберите тип и настроение. Потом блоки можно будет поправить вручную.",
  },
  {
    key: "review",
    title: "Проверка и сборка",
    text: "Проверьте смысл, контакт и стиль. Черновик сайта создается без ввода карты.",
  },
];

export default function BusinessWebsiteBuilder() {
  const { user } = useAuth();
  const accountCountry = resolveCountry(user?.country);
  const [input, setInput] = useState<CreateBusinessWebsiteDraftInput>(() => ({ ...initialInput, country: accountCountry }));
  const [builderOpen, setBuilderOpen] = useState(false);
  const [siteStepIndex, setSiteStepIndex] = useState(0);
  const [websites, setWebsites] = useState<BusinessWebsiteApiRecord[]>([]);
  const [selected, setSelected] = useState<BusinessWebsiteApiRecord | null>(null);
  const [assistantSummary, setAssistantSummary] = useState<string | null>(null);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  useEffect(() => {
    setInput((current) => (current.country === accountCountry ? current : { ...current, country: accountCountry }));
  }, [accountCountry]);

  useEffect(() => {
    let cancelled = false;

    getBusinessWebsites()
      .then((response) => {
        if (cancelled) return;
        setWebsites(response.websites);
        setSelected(response.websites[0] ?? null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(toPublicApiError(loadError, "Не удалось загрузить сайты компании."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const publicUrl = useMemo(() => {
    if (!selected || selected.status !== "published") return "";
    if (typeof window === "undefined") return selected.publicationPath;
    return `${window.location.origin}${selected.publicationPath}`;
  }, [selected]);

  const canGenerate = input.prompt.trim().length >= 20 && !generating;
  const content = selected?.content ?? null;
  const sections = content?.pages[0]?.sections ?? [];
  const currentWebsiteStep = websiteWizardSteps[siteStepIndex];
  const websiteStepReady =
    currentWebsiteStep.key === "brief"
      ? input.prompt.trim().length >= 20
      : currentWebsiteStep.key === "details"
        ? Boolean(input.companyName?.trim() && input.contact?.trim())
        : currentWebsiteStep.key === "review"
          ? canGenerate
          : true;
  const websiteProgress = Math.round(((siteStepIndex + 1) / websiteWizardSteps.length) * 100);

  const requestDraft = () => {
    if (!canGenerate) return;
    void generateDraft();
  };

  const openBuilder = () => {
    setBuilderOpen(true);
    setSiteStepIndex(0);
  };

  const closeBuilder = () => {
    if (generating) return;
    setBuilderOpen(false);
  };

  const nextWebsiteStep = () => {
    if (!websiteStepReady) return;
    setSiteStepIndex((current) => Math.min(current + 1, websiteWizardSteps.length - 1));
  };

  const previousWebsiteStep = () => {
    setSiteStepIndex((current) => Math.max(current - 1, 0));
  };

  const generateDraft = async () => {
    if (!canGenerate) return;

    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const response = await createBusinessWebsiteDraft(input);
      setSelected(response.website);
      setAssistantSummary(response.assistantSummary);
      setNextSteps(response.suggestedNextSteps);
      setWebsites((current) => [response.website, ...current.filter((site) => site.id !== response.website.id)]);
      setBuilderOpen(false);
      setNotice("Черновик сайта собран. Теперь его можно править и публиковать.");
    } catch (generateError) {
      setError(toPublicApiError(generateError, "Не удалось собрать сайт."));
    } finally {
      setGenerating(false);
    }
  };

  const saveWebsite = async () => {
    if (!selected || saving) return null;

    setSaving(true);
    setError(null);
    try {
      const response = await updateBusinessWebsite(selected.id, {
        title: selected.title,
        slug: selected.slug,
        content: selected.content,
      });
      setSelected(response.website);
      setWebsites((current) => current.map((site) => (site.id === response.website.id ? response.website : site)));
      setNotice("Правки сохранены");
      return response.website;
    } catch (saveError) {
      setError(toPublicApiError(saveError, "Не удалось сохранить сайт."));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const publishWebsite = async () => {
    if (!selected || publishing) return;

    setPublishing(true);
    setError(null);
    try {
      const saved = await updateBusinessWebsite(selected.id, {
        title: selected.title,
        slug: selected.slug,
        content: selected.content,
      });
      const response = await publishBusinessWebsite(saved.website.id);
      setSelected(response.website);
      setWebsites((current) => current.map((site) => (site.id === response.website.id ? response.website : site)));
      setNotice("Сайт опубликован. Ссылка готова для клиентов.");
    } catch (publishError) {
      setError(toPublicApiError(publishError, "Не удалось опубликовать сайт."));
    } finally {
      setPublishing(false);
    }
  };

  const copyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setNotice("Ссылка скопирована");
    } catch {
      setNotice(publicUrl);
    }
  };

  const sharePublicUrl = () => {
    if (!publicUrl || !selected) return;
    setSharePayload({
      title: selected.title,
      text: selected.content.seo.description || `${selected.title} в nomduchat`,
      url: publicUrl,
    });
  };

  const updateSelected = (patch: Partial<BusinessWebsiteApiRecord>) => {
    setSelected((current) => (current ? { ...current, ...patch } : current));
  };

  const updateContent = (updater: (content: BusinessWebsiteContentApiRecord) => BusinessWebsiteContentApiRecord) => {
    setSelected((current) => {
      if (!current) return current;
      return {
        ...current,
        content: updater(cloneContent(current.content)),
      };
    });
  };

  const updateSection = (sectionId: string, patch: Partial<BusinessWebsiteSectionApiRecord>) => {
    updateContent((current) => ({
      ...current,
      pages: [
        {
          ...current.pages[0],
          sections: current.pages[0].sections.map((section) =>
            section.id === sectionId ? { ...section, ...patch } : section
          ),
        },
      ],
    }));
  };

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    updateContent((current) => {
      const sections = [...current.pages[0].sections];
      const index = sections.findIndex((section) => section.id === sectionId);
      const nextIndex = index + direction;
      if (index < 1 || nextIndex < 1 || nextIndex >= sections.length) return current;
      const [section] = sections.splice(index, 1);
      sections.splice(nextIndex, 0, section);
      return {
        ...current,
        pages: [{ ...current.pages[0], sections }],
      };
    });
  };

  const removeSection = (sectionId: string) => {
    updateContent((current) => ({
      ...current,
      pages: [
        {
          ...current.pages[0],
          sections: current.pages[0].sections.filter((section) => section.id !== sectionId || section.type === "hero"),
        },
      ],
    }));
  };

  const addFaqItem = (sectionId: string) => {
    const section = sections.find((candidate) => candidate.id === sectionId);
    updateSection(sectionId, {
      items: [...(section?.items ?? []), "Новый вопрос. Добавьте ответ для клиента."],
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-5 text-white md:p-10">
      <ShareSheet
        open={Boolean(sharePayload)}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
        onShared={setNotice}
      />
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              to="/workspace/business"
              className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              Назад в бизнес-кабинет
            </Link>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
              <Globe className="h-4 w-4" strokeWidth={1.7} />
              Сайт без домена и хостинга для клиента
            </div>
            <h1 className="mt-4 text-3xl font-medium md:text-5xl">Сайт, который клиент может править сам</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-400">
              Опишите бизнес обычными словами. nomduchat соберет первую страницу с текстами, заявкой и блоками, а потом вы сможете поменять каждую строку в редакторе и опубликовать ссылку.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="hidden">
              {selected ? (
                <>
                <button
                  type="button"
                  onClick={saveWebsite}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={1.7} />}
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={publishWebsite}
                  disabled={publishing}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" strokeWidth={1.7} />}
                  Опубликовать
                </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-6 md:p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Sparkles className="h-4 w-4" strokeWidth={1.7} />
                Запуск через короткий опрос
              </div>
              <h2 className="mt-3 max-w-3xl text-2xl font-medium md:text-3xl">
                Клиент пишет, что ему нужно, а мы собираем первый сайт и показываем превью.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500">
                Не нужно отправлять клиента покупать домен, выбирать хостинг или искать подрядчика. Сначала он получает рабочий черновик с заявкой и понятными блоками, потом правит текст прямо здесь.
              </p>
            </div>
            <button
              type="button"
              onClick={openBuilder}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              Создать сайт
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </section>

        <section aria-hidden="true" className="hidden">
          <div className="space-y-5">
            <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Sparkles className="h-4 w-4" strokeWidth={1.7} />
                Быстрый запуск
              </div>
              <h2 className="mt-3 text-2xl font-medium">Опишите сайт одним сообщением</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Напишите, чем занимается компания, кому продает и какой контакт оставить. Если нужны цены, акции или запись на услугу, добавьте это прямо в текст.
              </p>

              <TextArea
                label="Промпт про сайт"
                value={input.prompt}
                onChange={(value) => setInput((current) => ({ ...current, prompt: value }))}
                placeholder="Нужен сайт для кофейни в Алматы. Продаем кофе, завтраки и доставку для офисов. Контакт @manager..."
                rows={7}
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field
                  label="Название"
                  value={input.companyName ?? ""}
                  onChange={(value) => setInput((current) => ({ ...current, companyName: value }))}
                  placeholder="Можно пусто"
                />
                <Field
                  label="Город"
                  value={input.city ?? ""}
                  onChange={(value) => setInput((current) => ({ ...current, city: value }))}
                  placeholder="Алматы"
                />
                <Field
                  label="Контакт"
                  value={input.contact ?? ""}
                  onChange={(value) => setInput((current) => ({ ...current, contact: value }))}
                  placeholder="@manager"
                />
              </div>

              <OptionGrid
                title="Тип сайта"
                options={siteTypeOptions}
                value={input.siteType}
                onChange={(value) => setInput((current) => ({ ...current, siteType: value }))}
              />

              <OptionGrid
                title="Стиль"
                options={styleOptions}
                value={input.style}
                onChange={(value) => setInput((current) => ({ ...current, style: value }))}
              />

              <button
                type="button"
                onClick={requestDraft}
                disabled={!canGenerate}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" strokeWidth={1.8} />}
                Создать сайт
              </button>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Globe className="h-4 w-4" strokeWidth={1.7} />
                Мои сайты
              </div>
              <div className="mt-4 space-y-2">
                {loading ? (
                  <div className="text-sm text-gray-500">Загружаем сайты...</div>
                ) : websites.length > 0 ? (
                  websites.map((site) => (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => setSelected(site)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        selected?.id === site.id
                          ? "border-white/25 bg-white/[0.06]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{site.title}</div>
                          <div className="mt-1 text-xs text-gray-500">{site.publicationPath}</div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${site.status === "published" ? "bg-emerald-500/10 text-emerald-300" : "bg-white/10 text-gray-400"}`}>
                          {site.status === "published" ? "online" : "draft"}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-500">
                    Пока нет сайтов. Создайте первый через промпт выше.
                  </div>
                )}
              </div>
            </article>

            {assistantSummary ? (
              <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
                <div className="flex items-center gap-2 text-sm text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.7} />
                  AI-сборка готова
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-400">{assistantSummary}</p>
                <div className="mt-4 space-y-2">
                  {nextSteps.map((step) => (
                    <div key={step} className="flex gap-2 text-sm text-gray-500">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" strokeWidth={1.7} />
                      {step}
                    </div>
                  ))}
                </div>
              </article>
            ) : null}
          </div>

          <div className="space-y-5">
            {selected && content ? (
              <>
                <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_0.6fr]">
                    <Field label="Название сайта" value={selected.title} onChange={(value) => updateSelected({ title: value })} />
                    <Field label="Slug" value={selected.slug} onChange={(value) => updateSelected({ slug: value })} />
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field
                      label="SEO title"
                      value={content.seo.title}
                      onChange={(value) =>
                        updateContent((current) => ({ ...current, seo: { ...current.seo, title: value } }))
                      }
                    />
                    <Field
                      label="Акцентный цвет"
                      value={content.theme.accent}
                      onChange={(value) =>
                        updateContent((current) => ({ ...current, theme: { ...current.theme, accent: value } }))
                      }
                    />
                  </div>
                  <TextArea
                    label="SEO description"
                    value={content.seo.description}
                    onChange={(value) =>
                      updateContent((current) => ({ ...current, seo: { ...current.seo, description: value } }))
                    }
                    rows={3}
                  />
                  {publicUrl ? (
                    <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-medium text-emerald-200">Публичная ссылка</div>
                        <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm text-emerald-100 hover:underline">
                          {publicUrl}
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={sharePublicUrl}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/20 px-4 py-2 text-sm text-emerald-100"
                        >
                          <Share2 className="h-4 w-4" strokeWidth={1.7} />
                          Поделиться
                        </button>
                        <button
                          type="button"
                          onClick={copyPublicUrl}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/20 px-4 py-2 text-sm text-emerald-100"
                        >
                          <Copy className="h-4 w-4" strokeWidth={1.7} />
                          Скопировать
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>

                <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Palette className="h-4 w-4" strokeWidth={1.7} />
                        Редактор блоков
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateContent((current) => ({
                            ...current,
                            pages: [
                              {
                                ...current.pages[0],
                                sections: [
                                  ...current.pages[0].sections,
                                  {
                                    id: `custom-${Date.now()}`,
                                    type: "services",
                                    title: "Новый блок",
                                    subtitle: "Опишите, что нужно показать клиенту.",
                                    items: ["Пункт 1", "Пункт 2"],
                                  },
                                ],
                              },
                            ],
                          }))
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                      >
                        <Plus className="h-4 w-4" strokeWidth={1.7} />
                        Блок
                      </button>
                    </div>

                    {sections.map((section, index) => (
                      <article key={section.id} className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase text-gray-600">{section.type}</div>
                            <div className="mt-1 text-sm text-gray-400">Блок {index + 1}</div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveSection(section.id, -1)}
                              disabled={index <= 1}
                              className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-400 disabled:opacity-30"
                            >
                              Выше
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSection(section.id, 1)}
                              disabled={index === 0 || index === sections.length - 1}
                              className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-400 disabled:opacity-30"
                            >
                              Ниже
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSection(section.id)}
                              disabled={section.type === "hero"}
                              className="rounded-full border border-white/10 p-1.5 text-gray-500 transition-colors hover:text-red-300 disabled:opacity-30"
                              aria-label="Удалить блок"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                            </button>
                          </div>
                        </div>
                        <Field
                          label="Заголовок"
                          value={section.title}
                          onChange={(value) => updateSection(section.id, { title: value })}
                        />
                        <TextArea
                          label="Описание"
                          value={section.subtitle ?? ""}
                          onChange={(value) => updateSection(section.id, { subtitle: value })}
                          rows={3}
                        />
                        {section.type === "contacts" ? (
                          <TextArea
                            label="Дополнительный текст"
                            value={section.body ?? ""}
                            onChange={(value) => updateSection(section.id, { body: value })}
                            rows={2}
                          />
                        ) : null}
                        <TextArea
                          label="Пункты блока"
                          value={(section.items ?? []).join("\n")}
                          onChange={(value) =>
                            updateSection(section.id, {
                              items: value.split("\n").map((item) => item.trim()).filter(Boolean),
                            })
                          }
                          rows={section.type === "faq" ? 5 : 4}
                        />
                        {section.type === "faq" ? (
                          <button
                            type="button"
                            onClick={() => addFaqItem(section.id)}
                            className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-gray-400"
                          >
                            <Plus className="h-4 w-4" strokeWidth={1.7} />
                            Вопрос
                          </button>
                        ) : null}
                        {(section.type === "hero" || section.type === "cta" || section.type === "contacts") ? (
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Field
                              label="Текст кнопки"
                              value={section.buttonText ?? ""}
                              onChange={(value) => updateSection(section.id, { buttonText: value })}
                            />
                            <Field
                              label="Ссылка кнопки"
                              value={section.buttonHref ?? ""}
                              onChange={(value) => updateSection(section.id, { buttonHref: value })}
                            />
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>

                  <div className="sticky top-4 h-fit overflow-hidden rounded-2xl border border-white/10 bg-white">
                    <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 text-black">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Eye className="h-4 w-4" strokeWidth={1.7} />
                        Превью сайта
                      </div>
                      <a
                        href={publicUrl || "#"}
                        target={publicUrl ? "_blank" : undefined}
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1 text-sm ${publicUrl ? "text-black" : "pointer-events-none text-gray-400"}`}
                      >
                        Открыть
                        <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
                      </a>
                    </div>
                    <div className="max-h-[760px] overflow-y-auto">
                      <BusinessWebsiteRenderer content={content} compact />
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0A0A0A] p-8 text-center">
                <div>
                  <Globe className="mx-auto h-10 w-10 text-gray-700" strokeWidth={1.5} />
                  <h2 className="mt-4 text-2xl font-medium">Сайт появится здесь</h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                    Напишите промпт слева, и nomduchat соберет первую версию с блоками, SEO и заявкой.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {builderOpen && typeof document !== "undefined" ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
            <div className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#080808] p-5 shadow-2xl md:p-6">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-gray-400">
                    <Globe className="h-4 w-4" strokeWidth={1.7} />
                    Сайт для бизнеса
                  </div>
                  <h2 className="mt-3 text-2xl font-medium md:text-3xl">Собрать сайт по короткому опросу</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                    Сначала заполняем смысл, контакт и стиль. На финальном шаге проверяем данные, после чего справа появится первая версия сайта.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeBuilder}
                  disabled={generating}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
                >
                  Закрыть
                </button>
              </div>

              <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[0.86fr_1.14fr]">
                <form
                  className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (currentWebsiteStep.key === "review") {
                      void generateDraft();
                    } else {
                      nextWebsiteStep();
                    }
                  }}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm text-gray-500">
                        Шаг {siteStepIndex + 1} из {websiteWizardSteps.length}
                      </div>
                      <h3 className="mt-2 text-2xl font-medium md:text-3xl">{currentWebsiteStep.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">{currentWebsiteStep.text}</p>
                    </div>
                    <div className="min-w-40 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-400">
                      Готово на {websiteProgress}%
                    </div>
                  </div>

                  <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-white transition-all" style={{ width: `${websiteProgress}%` }} />
                  </div>

                  <div className="mt-6">{renderWebsiteStepFields(currentWebsiteStep.key)}</div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={previousWebsiteStep}
                      disabled={siteStepIndex === 0 || generating}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                      Назад
                    </button>

                    {currentWebsiteStep.key === "review" ? (
                      <button
                        type="submit"
                        disabled={!canGenerate || !websiteStepReady || generating}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" strokeWidth={1.8} />}
                        Собрать сайт
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!websiteStepReady}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Дальше
                        <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </form>

                <aside className="space-y-5">
                  <section className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Sparkles className="h-4 w-4" strokeWidth={1.7} />
                      Путь запуска
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {websiteWizardSteps.map((step, index) => (
                        <div
                          key={step.key}
                          className={`rounded-2xl border px-4 py-3 text-sm transition-colors ${
                            index === siteStepIndex
                              ? "border-white/25 bg-white text-black"
                              : index < siteStepIndex
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                                : "border-white/10 bg-white/[0.03] text-gray-500"
                          }`}
                        >
                          {step.title}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-3xl border border-white/10 bg-white">
                    <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 text-black">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Eye className="h-4 w-4" strokeWidth={1.7} />
                        Превью сайта
                      </div>
                      {publicUrl ? (
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-black"
                        >
                          Открыть
                          <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
                        </a>
                      ) : null}
                    </div>
                    <div className="max-h-[620px] overflow-y-auto bg-white">
                      {content ? (
                        <BusinessWebsiteRenderer content={content} compact />
                      ) : (
                        <div className="flex min-h-[520px] items-center justify-center p-8 text-center text-black">
                          <div>
                            <Globe className="mx-auto h-10 w-10 text-gray-300" strokeWidth={1.5} />
                            <h3 className="mt-4 text-2xl font-medium">Превью появится здесь</h3>
                            <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                              Дойдите до финального шага. После сборки здесь будет первая версия сайта, которую можно править дальше.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {assistantSummary ? (
                    <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                      <div className="flex items-center gap-2 text-sm text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" strokeWidth={1.7} />
                        Сайт собран
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-emerald-100/80">{assistantSummary}</p>
                    </section>
                  ) : null}
                </aside>
              </section>
            </div>
          </div>,
          document.body
        ) : null}
      </div>
    </div>
  );

  function renderWebsiteStepFields(step: WebsiteWizardStep["key"]) {
    if (step === "brief") {
      return (
        <div>
          <TextArea
            label="Промпт про сайт"
            value={input.prompt}
            onChange={(value) => setInput((current) => ({ ...current, prompt: value }))}
            placeholder="Нужен сайт для кофейни в Алматы. Продаем кофе, завтраки и доставку для офисов. Контакт @manager..."
            rows={8}
          />
          {input.prompt.trim().length > 0 && input.prompt.trim().length < 20 ? (
            <div className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              Добавьте еще пару деталей: что продаете, кому и какой контакт оставить.
            </div>
          ) : null}
        </div>
      );
    }

    if (step === "details") {
      return (
        <div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Название компании *"
              value={input.companyName ?? ""}
              onChange={(value) => setInput((current) => ({ ...current, companyName: value }))}
              placeholder="Например, Nomdu Coffee"
            />
            <Field
              label="Контакт на сайте *"
              value={input.contact ?? ""}
              onChange={(value) => setInput((current) => ({ ...current, contact: value }))}
              placeholder="@manager, телефон или WhatsApp"
            />
          </div>
          <Field
            label="Город"
            value={input.city ?? ""}
            onChange={(value) => setInput((current) => ({ ...current, city: value }))}
            placeholder="Алматы"
          />
        </div>
      );
    }

    if (step === "style") {
      return (
        <div>
          <OptionGrid
            title="Тип сайта"
            options={siteTypeOptions}
            value={input.siteType}
            onChange={(value) => setInput((current) => ({ ...current, siteType: value }))}
          />
          <OptionGrid
            title="Стиль"
            options={styleOptions}
            value={input.style}
            onChange={(value) => setInput((current) => ({ ...current, style: value }))}
          />
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Rocket className="h-4 w-4" strokeWidth={1.7} />
            Готово к сборке
          </div>
          <div className="mt-4 text-3xl font-medium">Черновик без карты</div>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Страна аккаунта: {input.country === "KZ" ? "Казахстан" : "Россия"}. Сейчас мы собираем сайт, который можно редактировать и публиковать.
          </p>
          <p className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-gray-500">
            Оплату, чеки и договоры подключаем отдельно через платежного провайдера. В этой версии пользователь не вводит карту в интерфейс сайта.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-[#050505] p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.7} />
            Что будет использовано
          </div>
          <div className="mt-4 space-y-3">
            {[
              ["Промпт", input.prompt],
              ["Компания", input.companyName ?? ""],
              ["Контакт", input.contact ?? ""],
              ["Тип сайта", siteTypeOptions.find((option) => option.value === input.siteType)?.label ?? input.siteType],
              ["Стиль", styleOptions.find((option) => option.value === input.style)?.label ?? input.style],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="text-xs text-gray-600">{label}</div>
                <div className="mt-1 line-clamp-3 text-sm leading-relaxed text-gray-300">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}) {
  return (
    <label className="mt-4 block">
      <span className="text-sm text-gray-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="mt-4 block">
      <span className="text-sm text-gray-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
      />
    </label>
  );
}

function OptionGrid<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<{ value: T; label: string; detail: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="mt-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={choiceClass(value === option.value)}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="mt-1 block text-xs text-gray-500">{option.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function resolveCountry(country: string | null | undefined): BusinessWebsiteCountry {
  return country === "RU" ? "RU" : "KZ";
}

function choiceClass(active: boolean) {
  return `rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
    active
      ? "border-white/25 bg-white text-black"
      : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:text-white"
  }`;
}

function cloneContent(content: BusinessWebsiteContentApiRecord): BusinessWebsiteContentApiRecord {
  return JSON.parse(JSON.stringify(content)) as BusinessWebsiteContentApiRecord;
}
