export function setPageSeo(title: string, description: string, canonicalPath?: string) {
  if (typeof document === "undefined") return;

  document.title = title;
  setMeta("description", description);

  if (canonicalPath) {
    setCanonicalUrl(canonicalPath);
  }
}

function setMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }

  meta.content = content;
}

function setCanonicalUrl(path: string) {
  const origin = window.location.origin;
  const href = new URL(path, origin).toString();
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }

  link.href = href;
}
