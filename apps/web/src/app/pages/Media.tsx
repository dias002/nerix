import { Link } from "react-router";
import { ArrowRight, ImageIcon, Mic2, Music2, Video } from "lucide-react";
import PageHeader from "../components/workspace/PageHeader";

const studios = [
  {
    id: "image",
    title: "Изображения",
    text: "Обложки, карточки товаров, интерьер и визуальные концепции.",
    cover: "images",
    tone: "plasma",
    icon: ImageIcon,
  },
  {
    id: "video",
    title: "Видео",
    text: "Короткие ролики, стартовый кадр, качество и движение камеры.",
    cover: "video",
    tone: "coral",
    icon: Video,
  },
  {
    id: "music",
    title: "Музыка",
    text: "Тридцатисекундные треки, джинглы и песни через Gemini Lyria.",
    cover: "music",
    tone: "plasma",
    icon: Music2,
  },
  {
    id: "voice",
    title: "Озвучка",
    text: "Готовый аудиофайл с выбором голоса, скорости и формата.",
    cover: "voice",
    tone: "solar",
    icon: Mic2,
  },
] as const;

export default function Media() {
  return (
    <div className="ns-page-scroll">
      <main className="ns-page ns-media-hub space-y-7">
        <PageHeader overline="Media Studio" title="Что создаём?" />

        <section className="ns-media-hub-grid">
          {studios.map((studio, index) => {
            const Icon = studio.icon;
            return (
              <Link
                key={studio.id}
                to={`/workspace/media/${studio.id}`}
                className="ns-media-hub-card group"
                data-featured={index === 1}
                data-tone={studio.tone}
              >
                <div className="ns-media-hub-cover">
                  <img src={`/app-covers/${studio.cover}.jpg`} alt="" />
                  <span className="ns-media-hub-icon"><Icon className="h-5 w-5" strokeWidth={1.7} /></span>
                </div>
                <div className="ns-media-hub-copy">
                  <div>
                    <h2>{studio.title}</h2>
                    <p>{studio.text}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" strokeWidth={1.8} />
                </div>
              </Link>
            );
          })}
        </section>

        <Link to="/workspace/avatar" className="ns-media-avatar-link">
          <span>AI-аватар</span>
          <span>Фото, эмоции и avatar-video</span>
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </main>
    </div>
  );
}
