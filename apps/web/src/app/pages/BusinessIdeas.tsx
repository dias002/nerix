import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  getBusinessWorkspace,
  updateBusinessIdeaStatus,
  type BusinessAdvisorKey,
  type BusinessIdeaStatus,
  type BusinessWorkspaceApiResponse,
} from "../api";

type AdvisorKey = BusinessAdvisorKey;

export default function BusinessIdeas() {
  const [workspaceData, setWorkspaceData] = useState<BusinessWorkspaceApiResponse | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activeAdvisorKey, setActiveAdvisorKey] = useState<AdvisorKey>("growth");
  const [savedIdeaIds, setSavedIdeaIds] = useState<string[]>([]);
  const [savingIdeaId, setSavingIdeaId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getBusinessWorkspace()
      .then((workspace) => {
        if (cancelled) return;
        setWorkspaceData(workspace);
        setWorkspaceError(null);
      })
      .catch(() => {
        if (!cancelled) setWorkspaceError("Не удалось загрузить реальные идеи из бизнес API.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceData) return;

    setSavedIdeaIds(
      workspaceData.advisorViews
        .flatMap((view) => view.ideas)
        .filter((idea) => idea.status !== "suggested")
        .map((idea) => idea.id)
    );
  }, [workspaceData]);

  const advisorViews = workspaceData?.advisorViews ?? [];
  const activeAdvisor = useMemo(
    () => advisorViews.find((view) => view.key === activeAdvisorKey) ?? advisorViews[0],
    [activeAdvisorKey, advisorViews]
  );
  const savedIdeas = advisorViews.flatMap((view) => view.ideas).filter((idea) => savedIdeaIds.includes(idea.id));

  const toggleSavedIdea = async (ideaId: string) => {
    const saved = savedIdeaIds.includes(ideaId);
    const nextStatus: BusinessIdeaStatus = saved ? "suggested" : "planned";

    if (!workspaceData) {
      setWorkspaceError("Сначала загрузите реальные идеи из бизнес API.");
      return;
    }

    setSavingIdeaId(ideaId);
    try {
      const updatedWorkspace = await updateBusinessIdeaStatus(ideaId, nextStatus);
      setWorkspaceData(updatedWorkspace);
      setWorkspaceError(null);
    } catch {
      setWorkspaceError("Не удалось сохранить статус идеи в API.");
    } finally {
      setSavingIdeaId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-5 text-white md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <Link
          to="/workspace/business"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-400 transition-colors hover:border-white/20 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          Назад в бизнес-кабинет
        </Link>

        <header className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-4xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
              <Lightbulb className="h-4 w-4" strokeWidth={1.7} />
              Лампа идей
            </div>
            <h1 className="text-3xl font-medium text-white md:text-5xl">Идеи и подсказки для бизнеса</h1>
            <p className="mt-4 text-base leading-relaxed text-gray-400 md:text-lg">
              Отдельный экран для разбора бизнеса. Здесь видно, на каких данных строится рекомендация, какие идеи можно взять в работу и какой следующий шаг нужен команде.
            </p>
            {workspaceError ? <p className="mt-3 text-sm text-gray-500">{workspaceError}</p> : null}
          </div>

          <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-white/15 bg-black shadow-[0_0_90px_rgba(255,255,255,0.32)] md:h-52 md:w-52">
            <div className="absolute inset-8 rounded-full border border-white/10 shadow-[0_0_70px_rgba(255,255,255,0.24)]" />
            <Lightbulb className="relative h-16 w-16 text-white drop-shadow-[0_0_26px_rgba(255,255,255,0.95)] md:h-20 md:w-20" strokeWidth={1.5} />
          </div>
        </header>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            {advisorViews.length > 0 ? advisorViews.map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => setActiveAdvisorKey(view.key)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  activeAdvisor?.key === view.key
                    ? "border-white/30 bg-white text-black"
                    : "border-white/10 bg-[#0A0A0A] text-gray-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <div className="text-base font-medium">{view.title}</div>
                <div className={`mt-2 text-sm ${activeAdvisor?.key === view.key ? "text-black/60" : "text-gray-500"}`}>
                  {view.short}
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 text-sm text-gray-500">
                Разделы идей загрузятся из бизнес API.
              </div>
            )}
          </div>

          <div className="space-y-5">
            {activeAdvisor ? (
              <>
                <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                  <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Target className="h-4 w-4" strokeWidth={1.7} />
                      {activeAdvisor.short}
                    </div>
                    <h2 className="mt-3 text-2xl font-medium text-white">{activeAdvisor.title}</h2>
                    <p className="mt-3 text-sm leading-relaxed text-gray-400">{activeAdvisor.summary}</p>
                  </article>

                  <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
                      <BarChart3 className="h-4 w-4" strokeWidth={1.7} />
                      На чем основан разбор
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {activeAdvisor.basedOn.map((item) => (
                        <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed text-gray-300">
                          {item}
                        </div>
                      ))}
                    </div>
                  </article>
                </section>

                <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  {activeAdvisor.ideas.map((idea) => {
                const saved = savedIdeaIds.includes(idea.id);
                return (
                  <article key={idea.id} className="flex min-h-80 flex-col rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
                    <div className="flex-1">
                      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black shadow-[0_0_24px_rgba(255,255,255,0.18)]">
                        <Lightbulb className="h-5 w-5 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]" strokeWidth={1.6} />
                      </div>
                      <h3 className="text-lg font-medium text-white">{idea.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-gray-500">{idea.text}</p>

                      <div className="mt-5 space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                          <span className="text-gray-600">Срок</span>
                          <span className="text-gray-300">{idea.effort}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                          <span className="text-gray-600">Эффект</span>
                          <span className="text-gray-300">{idea.effect}</span>
                        </div>
                        <div>
                          <div className="text-gray-600">Следующий шаг</div>
                          <div className="mt-1 leading-relaxed text-gray-300">{idea.next}</div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSavedIdea(idea.id)}
                      disabled={savingIdeaId === idea.id}
                      className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                        saved
                          ? "bg-white text-black hover:bg-gray-200"
                          : "border border-white/10 text-gray-300 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {savingIdeaId === idea.id ? "Сохраняю" : saved ? "В плане" : "Взять в работу"}
                    </button>
                  </article>
                );
                  })}
                </section>
              </>
            ) : (
              <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 text-sm text-gray-500">
                Идеи появятся после загрузки данных бизнес-кабинета.
              </section>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ClipboardList className="h-4 w-4" strokeWidth={1.7} />
                План выбранных идей
              </div>
              <h2 className="mt-3 text-2xl font-medium text-white">Что уже взято в работу</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
                Этот блок показывает, как идеи превращаются в план. В настоящей версии здесь будут статусы, ответственные и срок выполнения.
              </p>
            </div>
            <Link
              to="/workspace/chat"
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              Обсудить план
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {savedIdeas.length > 0 ? (
              savedIdeas.map((idea, index) => (
                <div key={idea.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-500">0{index + 1}</div>
                    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-400">
                      <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.7} />
                      {idea.effect}
                    </div>
                  </div>
                  <h3 className="mt-3 text-base font-medium text-white">{idea.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{idea.next}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                    Готово для обсуждения
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500">
                Выберите идею в любом разделе анализа.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
