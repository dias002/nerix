import { useEffect } from "react";
import { Link, useRouteError } from "react-router";
import { getErrorMessage, isChunkLoadError, reloadAfterChunkError } from "../chunkError";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const isStaleChunk = isChunkLoadError(error);

  useEffect(() => {
    if (isStaleChunk) {
      reloadAfterChunkError();
    }
  }, [isStaleChunk]);

  if (isStaleChunk) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <section className="w-full max-w-md text-center">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-gray-500">nomduchat</p>
          <h1 className="text-3xl font-semibold">Обновляем приложение</h1>
          <p className="mt-4 text-base leading-7 text-gray-400">
            После деплоя браузер загрузил старую часть интерфейса. Страница обновится автоматически.
          </p>
          <button
            type="button"
            className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-black transition hover:bg-gray-200"
            onClick={() => window.location.reload()}
          >
            Обновить сейчас
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <section className="w-full max-w-lg">
        <p className="mb-3 text-sm uppercase tracking-[0.28em] text-gray-500">nomduchat</p>
        <h1 className="text-3xl font-semibold">Страница временно недоступна</h1>
        <p className="mt-4 text-base leading-7 text-gray-400">
          Мы не смогли открыть этот раздел. Обновите страницу или вернитесь в чат.
        </p>
        <pre className="mt-6 max-h-40 overflow-auto rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs text-gray-500">
          {getErrorMessage(error)}
        </pre>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-black transition hover:bg-gray-200"
            onClick={() => window.location.reload()}
          >
            Обновить
          </button>
          <Link
            to="/workspace/chat"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
          >
            В чат
          </Link>
        </div>
      </section>
    </main>
  );
}
