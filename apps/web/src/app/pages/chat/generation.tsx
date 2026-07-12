import { motion } from "motion/react";
import { CircleStop, Download, FileText, ImageIcon, Loader2, Music2, Share2, Video } from "lucide-react";
import type { MediaGenerationJobApiRecord } from "../../api";

export function GenerationJobCard({
  job,
  artifactUrl,
  isCancelling,
  onCancel,
  onShare,
}: {
  job: MediaGenerationJobApiRecord;
  artifactUrl?: string;
  isCancelling?: boolean;
  onCancel?: () => void;
  onShare?: () => void;
}) {
  const isPending = job.status === "queued" || job.status === "running";
  const isReady = job.status === "succeeded";
  const isFailed = job.status === "failed" || job.status === "refunded";
  const isCancelled = job.status === "cancelled";
  const title = mediaTitle(job.modality, job.status);
  const detail = mediaDetail(job);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0B0B0B] shadow-2xl shadow-black/40">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white">
            {mediaIcon(job.modality, isPending)}
          </div>
          <div>
            <div className="text-base font-medium text-white">{title}</div>
            <div className="mt-1 text-xs text-gray-500">{detail}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isPending && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-gray-300 transition-colors hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCancelling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.7} />
              ) : (
                <CircleStop className="h-3.5 w-3.5" strokeWidth={1.7} />
              )}
              Остановить
            </button>
          ) : null}
          {isReady && onShare ? (
            <button
              type="button"
              onClick={onShare}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-gray-300 transition-colors hover:border-white/25 hover:text-white"
            >
              <Share2 className="h-3.5 w-3.5" strokeWidth={1.7} />
              Поделиться
            </button>
          ) : null}
          {artifactUrl ? (
            <a
              href={artifactUrl}
              download={`nomduchat-${job.modality}-${job.id.slice(0, 8)}${mediaExtension(job.resultMimeType)}`}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-gray-300 transition-colors hover:border-white/25 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.7} />
              Скачать
            </a>
          ) : null}
        </div>
      </div>

      <div className="p-5">
        {isPending ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
            <div className="aspect-video">
              <div className="flex h-full flex-col justify-between p-5">
                <div className="flex items-center justify-between">
                  <div className="h-2.5 w-28 rounded-full bg-white/15" />
                  <div className="h-2.5 w-16 rounded-full bg-white/10" />
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-3/4 rounded-full bg-white/15" />
                  <div className="h-3 w-1/2 rounded-full bg-white/10" />
                  <div className="h-3 w-2/3 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
            <motion.div
              aria-hidden="true"
              className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ["0%", "420%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        ) : null}

        {isReady && artifactUrl ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            {job.modality === "video" || job.modality === "avatar_video" ? (
              <video className="aspect-video w-full bg-black" src={artifactUrl} controls playsInline />
            ) : job.modality === "music" || job.modality === "voice" ? (
              <div className="space-y-4 p-5">
                <div className="flex h-24 items-center justify-center gap-1.5 rounded-2xl bg-white/[0.03]">
                  {[24, 44, 32, 58, 38, 50, 28, 46, 34].map((height, index) => (
                    <span key={index} className="w-2 rounded-full bg-white/70" style={{ height }} />
                  ))}
                </div>
                <audio className="w-full" src={artifactUrl} controls />
              </div>
            ) : job.modality === "image" ? (
              <img className="max-h-[34rem] w-full object-contain" src={artifactUrl} alt={job.prompt} />
            ) : (
              <div className="p-5 text-sm text-gray-400">Файл готов.</div>
            )}
          </div>
        ) : null}

        {isReady && !artifactUrl ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-400">
            Файл готов, загружаю плеер...
          </div>
        ) : null}

        {isFailed ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {job.errorMessage || "Генерация не завершилась. Кредиты возвращены."}
          </div>
        ) : null}

        {isCancelled ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300">
            Генерация остановлена. Кредиты вернулись на баланс.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function generationStatusText(job: MediaGenerationJobApiRecord) {
  if (job.status === "succeeded") return `Готово. ${mediaTitle(job.modality, job.status)}`;
  if (job.status === "cancelled") return "Генерация остановлена. Кредиты возвращены.";
  if (job.status === "failed" || job.status === "refunded") {
    return job.errorMessage || "Генерация не завершилась. Кредиты возвращены.";
  }
  return `Генерирую ${mediaNoun(job.modality)}. Как только файл будет готов, он появится прямо здесь.`;
}

export function mediaTitle(modality: string, status: MediaGenerationJobApiRecord["status"]) {
  const pending = status === "queued" || status === "running";
  const failed = status === "failed" || status === "refunded";
  if (status === "cancelled") return "Генерация остановлена";
  if (failed) return "Генерация остановилась";
  if (modality === "avatar_video") return pending ? "Собираю аватар-видео" : "Аватар-видео готово";
  if (modality === "video") return pending ? "Собираю видео" : "Видео готово";
  if (modality === "music") return pending ? "Пишу музыку" : "Музыка готова";
  if (modality === "voice") return pending ? "Готовлю аудио" : "Аудио готово";
  if (modality === "image") return pending ? "Рисую изображение" : "Изображение готово";
  return pending ? "Генерирую файл" : "Файл готов";
}

export function mediaExtension(mimeType?: string) {
  if (!mimeType) return "";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("mpeg")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return ".jpg";
  return "";
}

function mediaDetail(job: MediaGenerationJobApiRecord) {
  if (job.status === "queued") return "Задача в очереди. Обычно это занимает пару минут.";
  if (job.status === "running") return "Провайдер уже работает. Можно остаться в чате, результат появится сам.";
  if (job.status === "succeeded") return "Файл можно посмотреть здесь или скачать.";
  if (job.status === "cancelled") return "Процесс остановлен вручную.";
  return "Кредиты возвращены на баланс.";
}

function mediaNoun(modality: string) {
  if (modality === "avatar_video") return "видео с аватаром";
  if (modality === "video") return "видео";
  if (modality === "music") return "музыку";
  if (modality === "voice") return "аудио";
  if (modality === "image") return "изображение";
  return "медиа";
}

function mediaIcon(modality: string, isPending: boolean) {
  if (isPending) return <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />;
  if (modality === "video" || modality === "avatar_video") return <Video className="h-5 w-5" strokeWidth={1.8} />;
  if (modality === "music" || modality === "voice") return <Music2 className="h-5 w-5" strokeWidth={1.8} />;
  if (modality === "image") return <ImageIcon className="h-5 w-5" strokeWidth={1.8} />;
  return <FileText className="h-5 w-5" strokeWidth={1.8} />;
}
