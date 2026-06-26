import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Globe,
  MessageSquare,
} from "lucide-react";
import { getBusinessWorkspace, type BusinessWorkspaceApiResponse } from "../api";

export default function BusinessCabinet() {
  const [workspaceData, setWorkspaceData] = useState<BusinessWorkspaceApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getBusinessWorkspace()
      .then((workspace) => {
        if (cancelled) return;
        setWorkspaceData(workspace);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspaceData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = workspaceData?.stats ?? [];
  const members = workspaceData?.members ?? [];
  const reports = workspaceData?.employeeReports ?? [];
  const deals = workspaceData?.deals ?? [];
  const advisorCount = workspaceData?.advisorViews.reduce((sum, view) => sum + view.ideas.length, 0) ?? 0;
  const accessLabel =
    workspaceData?.access.mode === "active"
      ? "Business активен"
      : loading
        ? "Загрузка"
        : "Демо-режим";
  const topStats = useMemo(
    () => [
      {
        label: "Сотрудники",
        value: String(members.length || 0),
        detail: `${members.filter((member) => member.status === "online").length} в сети`,
      },
      {
        label: "Заявки",
        value: String(deals.length || 0),
        detail: "в CRM-воронке",
      },
      {
        label: "Отчеты",
        value: String(reports.reduce((sum, report) => sum + report.clientReportsCount, 0)),
        detail: "по клиентам",
      },
      {
        label: "Идеи",
        value: String(advisorCount),
        detail: "для роста",
      },
    ],
    [advisorCount, deals.length, members, reports]
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-5 text-white md:p-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
              <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.7} />
              B2B-платформа · {accessLabel}
            </div>
            <h1 className="mt-5 text-3xl font-medium md:text-5xl">Бизнес-разделы nomduchat</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-400">
              Это короткая карта продукта. Сайт, Telegram-менеджер, аналитика и идеи роста лежат отдельно, чтобы клиент не разбирался в лишних настройках.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/workspace/business/website"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              <Globe className="h-4 w-4" strokeWidth={1.8} />
              Создать сайт
            </Link>
            <Link
              to="/workspace/business/dialogs"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
              Диалоги клиентов
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {topStats.map((stat) => (
            <article key={stat.label} className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
              <div className="text-3xl font-medium">{stat.value}</div>
              <div className="mt-2 text-sm font-medium text-gray-300">{stat.label}</div>
              <div className="mt-1 text-sm text-gray-500">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.7} />
            Навигация Business тарифа
          </div>
          <h2 className="mt-2 text-2xl font-medium">Основные разделы теперь в левом меню</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
            Сайт, ИИ в Telegram, диалоги клиентов, аналитика сотрудников и идеи роста находятся под пунктом «Бизнес» в боковой панели. Главный экран остается обзором, без перегруженной сетки карточек.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.7} />
              Как теперь устроен B2B
            </div>
            <div className="mt-5 space-y-4">
              {[
                "Сайт и ИИ в Telegram создаются на отдельных страницах.",
                "Диалоги клиентов сохраняются отдельно: видны сообщения, возражения, интерес и оценка разговора.",
                "Telegram-менеджер принимает заявки и передает их человеку, когда нужен расчет.",
                "Аналитика сотрудников больше не смешана с созданием продуктов.",
                "Главная B2B-страница показывает только входы и краткое состояние.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.8} />
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <BarChart3 className="h-4 w-4" strokeWidth={1.7} />
              Текущая сводка
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {stats.length > 0 ? (
                stats.slice(0, 4).map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-2xl font-medium">{stat.value}</div>
                    <div className="mt-1 text-sm text-gray-300">{stat.label}</div>
                    <div className="mt-1 text-xs text-gray-500">{stat.detail}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500 md:col-span-2">
                  Сводка появится после загрузки бизнес API.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
