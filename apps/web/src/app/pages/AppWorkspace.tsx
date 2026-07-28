import { ArrowLeft, Sparkles } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link, Navigate, useParams } from "react-router";
import GenericAppStudio from "../components/apps/GenericAppStudio";
import HumanizerStudio from "../components/apps/HumanizerStudio";
import { appCatalog } from "../data/appCatalog";
import "../../styles/app-studio.css";

const InteriorStudio = lazy(() => import("../components/apps/InteriorStudio"));

export default function AppWorkspace() {
  const { appId } = useParams();
  const app = appCatalog.find((item) => item.id === appId);

  if (appId === "avatar") {
    return <Navigate to="/workspace/avatar" replace />;
  }

  if (!app) {
    return (
      <div className="ns-page-scroll">
        <main className="ns-page app-studio-missing">
          <span className="nd-icon-tile h-12 w-12" data-accent="orange">
            <Sparkles className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <h1>Приложение не найдено</h1>
          <p>Вернитесь в каталог и выберите доступный рабочий инструмент.</p>
          <Link to="/workspace/apps" className="nd-primary-action inline-flex h-11 items-center gap-2 px-5 text-sm">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            В каталог
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="ns-page-scroll">
      <main className={`ns-page app-studio-page app-studio-page--${app.id}`} data-accent={app.accent}>
        <header className="app-studio-header">
          <div className="min-w-0 app-studio-header-copy">
            <Link to="/workspace/apps" className="app-studio-back">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              Все приложения
            </Link>
            <div className="mt-4 flex items-center gap-3 app-studio-identity">
              <img src={`/app-covers/${app.id}.webp`} alt="" className="app-studio-icon" />
              <div className="min-w-0 app-studio-heading">
                <p className="ns-overline">{app.category}</p>
                <h1 className="app-studio-title">{app.title}</h1>
              </div>
            </div>
            <p className="app-studio-lead">{app.text}</p>
          </div>
          <div className="app-studio-status">
            <span />
            Рабочая среда
          </div>
        </header>

        {app.id === "humanizer" ? (
          <HumanizerStudio />
        ) : app.id === "interior" ? (
          <Suspense fallback={<div className="app-studio-panel">Загружаем 3D-комнату...</div>}>
            <InteriorStudio />
          </Suspense>
        ) : (
          <GenericAppStudio key={app.id} app={app} />
        )}
      </main>
    </div>
  );
}
