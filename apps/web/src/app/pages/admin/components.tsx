import type { ComponentType } from "react";
import type { AdminAiBudgetApiResponse } from "../../api";
import {
  aiBudgetStatusLabel,
  balanceSourceLabel,
  formatCompactCredits,
  formatDateTime,
  formatDaysRemaining,
  formatMoney,
  formatNumber,
  formatUsdNullable,
  modalityLabel,
  trafficModeLabel,
} from "./formatters";
import { aiBudgetStatusClass } from "./styles";

export function UserStat({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail?: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black p-4">
      <Icon className="h-4 w-4 text-gray-500" strokeWidth={1.6} />
      <p className="mt-4 text-xl font-medium text-white">{value}</p>
      <p className="mt-1 text-sm text-gray-400">{label}</p>
      {detail ? <p className="mt-1 text-xs text-gray-600">{detail}</p> : null}
    </div>
  );
}

export function PaymentStat({
  currency,
  label,
  stat,
  tone = "default",
}: {
  currency: string;
  label: string;
  stat: { count: number; amountMinor: number };
  tone?: "default" | "good" | "risk";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-400/15 bg-emerald-400/10"
      : tone === "risk"
        ? "border-red-400/15 bg-red-400/10"
        : "border-white/10 bg-[#050505]";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-lg font-medium text-white">{formatNumber(stat.count)}</div>
      <div className="mt-1 text-xs text-gray-500">{formatMoney(stat.amountMinor, currency)}</div>
    </div>
  );
}

export function AiBudgetProviderCard({ provider }: { provider: AdminAiBudgetApiResponse["providers"][number] }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-medium text-white">{provider.name}</h2>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-500">
              {provider.code}
            </span>
          </div>
          <p className="mt-2 truncate text-sm text-gray-500">{provider.model}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${aiBudgetStatusClass[provider.status]}`}>
          {aiBudgetStatusLabel(provider.status)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="rounded-full border border-white/10 bg-black px-3 py-1">
          {provider.backendConfigured ? "ключ задан" : "ключ не задан"}
        </span>
        <span className="rounded-full border border-white/10 bg-black px-3 py-1">
          {provider.enabled ? "включен" : "выключен"}
        </span>
        <span className="rounded-full border border-white/10 bg-black px-3 py-1">
          {trafficModeLabel(provider.trafficMode)}
        </span>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black p-3">
          <p className="text-xs text-gray-600">Остаток</p>
          <p className="mt-2 text-lg font-medium text-white">{formatUsdNullable(provider.balanceUsd)}</p>
          <p className="mt-1 text-xs text-gray-600">{balanceSourceLabel(provider.balanceSource)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black p-3">
          <p className="text-xs text-gray-600">Кредиты</p>
          <p className="mt-2 text-lg font-medium text-white">
            {formatCompactCredits(provider.estimatedCreditsRemaining)}
          </p>
          <p className="mt-1 text-xs text-gray-600">примерный остаток</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black p-3">
          <p className="text-xs text-gray-600">Расход 30 дней</p>
          <p className="mt-2 text-lg font-medium text-white">{formatUsdNullable(provider.spentUsd30d)}</p>
          <p className="mt-1 text-xs text-gray-600">{formatCompactCredits(provider.spentCredits30d)} кредитов</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black p-3">
          <p className="text-xs text-gray-600">Хватит на</p>
          <p className="mt-2 text-lg font-medium text-white">{formatDaysRemaining(provider.daysRemaining)}</p>
          <p className="mt-1 text-xs text-gray-600">{formatUsdNullable(provider.avgUsdPerDay30d)} в день</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black p-3">
        <p className="text-xs text-gray-600">Запросы</p>
        <p className="mt-2 text-sm text-gray-300">
          24ч: {formatNumber(provider.requests24h)} · 7д: {formatNumber(provider.requests7d)} · 30д:{" "}
          {formatNumber(provider.requests30d)}
        </p>
        <p className="mt-2 text-xs text-gray-600">
          Модальности: {provider.modalities.map(modalityLabel).join(" · ") || "не заданы"}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black p-3">
        <p className="text-sm leading-relaxed text-gray-400">{provider.refillHint}</p>
        <p className="mt-2 text-xs text-gray-700">
          Последняя активность: {provider.lastActivityAt ? formatDateTime(provider.lastActivityAt) : "нет данных"}
        </p>
      </div>
    </article>
  );
}
