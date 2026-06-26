import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import BusinessWebsiteRenderer from "../components/BusinessWebsiteRenderer";
import { getPublicBusinessWebsite, toPublicApiError, type BusinessWebsiteApiRecord } from "../api";

export default function PublicBusinessWebsite() {
  const params = useParams();
  const slug = params.slug ?? "";
  const [website, setWebsite] = useState<BusinessWebsiteApiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getPublicBusinessWebsite(slug)
      .then((response) => {
        if (cancelled) return;
        setWebsite(response.website);
        setError(null);
        document.title = response.website.content.seo.title;
        setMetaDescription(response.website.content.seo.description);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setWebsite(null);
        setError(toPublicApiError(loadError, "Сайт пока не опубликован или ссылка неверная."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="inline-flex items-center gap-3 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загружаем сайт
        </div>
      </main>
    );
  }

  if (error || !website) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] p-5 text-white">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-medium">Сайт не найден</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">{error}</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
            На главную
          </Link>
        </div>
      </main>
    );
  }

  return <BusinessWebsiteRenderer content={website.content} />;
}

function setMetaDescription(description: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = description;
}
