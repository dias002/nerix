import data from "./app-catalog.json";

export type AppTone = "solar" | "plasma" | "coral" | "orbit";
export type CreationMode = "image" | "video" | "music" | "voice";

export type AppCatalogItem = {
  id: string;
  title: string;
  text: string;
  category: string;
  accent: AppTone;
  starterPrompt?: string;
  href?: string;
  agentId?: string;
  networkId?: string;
  creationMode?: CreationMode;
  visual?: string;
};

export const appCatalog = data as AppCatalogItem[];

export function appHref(app: AppCatalogItem) {
  if (app.id === "avatar" && app.href) return app.href;
  return `/workspace/apps/${app.id}`;
}
