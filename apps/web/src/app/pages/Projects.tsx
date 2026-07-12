import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { FolderKanban, MessageSquare, Plus, Trash2 } from "lucide-react";

type ProjectStatus = "planned" | "active" | "done";

type ProjectRecord = {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  updatedAt: string;
};

const storageKey = "nomduchat-projects";

const defaultProjects: ProjectRecord[] = [
  {
    id: "launch-plan",
    title: "Запуск nomduchat",
    description: "Собрать задачи, которые улучшают регистрацию, оплату, FAQ, приложения и аватар.",
    status: "active",
    updatedAt: new Date().toISOString(),
  },
];

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>(() => readProjects());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(projects));
  }, [projects]);

  const stats = useMemo(
    () => [
      { label: "Всего", value: projects.length },
      { label: "В работе", value: projects.filter((project) => project.status === "active").length },
      { label: "Готово", value: projects.filter((project) => project.status === "done").length },
    ],
    [projects],
  );

  const createProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setProjects((current) => [
      {
        id: crypto.randomUUID(),
        title: cleanTitle,
        description: description.trim() || "Без описания",
        status: "planned",
        updatedAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setTitle("");
    setDescription("");
  };

  const updateStatus = (projectId: string, status: ProjectStatus) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              status,
              updatedAt: new Date().toISOString(),
            }
          : project,
      ),
    );
  };

  const deleteProject = (projectId: string) => {
    setProjects((current) => current.filter((project) => project.id !== projectId));
  };

  const openProjectChat = (project: ProjectRecord) => {
    const prompt = [
      `Помоги продолжить проект "${project.title}".`,
      `Статус: ${statusLabel(project.status)}.`,
      `Описание: ${project.description}`,
      "",
      "Сначала предложи следующий конкретный шаг, затем список задач на сегодня.",
    ].join("\n");
    navigate(`/workspace/chat?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-6 md:p-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h2 className="text-2xl font-medium text-white">Проекты</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
            Простое рабочее место для задач: сохраните проект, меняйте статус и отправляйте контекст в чат.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
              <div className="text-3xl font-medium text-white">{stat.value}</div>
              <div className="mt-2 text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <form onSubmit={createProject} className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
          <div className="mb-4 flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-gray-300" strokeWidth={1.7} />
            <h3 className="text-lg font-medium text-white">Новый проект</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.6fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-500">Название</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                placeholder="Например, SEO-раздел"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-500">Описание</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                placeholder="Что нужно сделать"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              <Plus className="h-4 w-4" strokeWidth={1.8} />
              Создать
            </button>
          </div>
        </form>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <article key={project.id} className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-medium text-white">{project.title}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs ${statusClass(project.status)}`}>
                      {statusLabel(project.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">{project.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteProject(project.id)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-red-400/10 hover:text-red-200"
                  aria-label="Удалить проект"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <select
                  value={project.status}
                  onChange={(event) => updateStatus(project.id, event.target.value as ProjectStatus)}
                  className="h-10 rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                >
                  <option className="bg-black text-white" value="planned">Запланировано</option>
                  <option className="bg-black text-white" value="active">В работе</option>
                  <option className="bg-black text-white" value="done">Готово</option>
                </select>
                <button
                  type="button"
                  onClick={() => openProjectChat(project)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  <MessageSquare className="h-4 w-4" strokeWidth={1.7} />
                  Продолжить в чате
                </button>
              </div>
              <div className="mt-4 text-xs text-gray-600">Обновлено: {formatDate(project.updatedAt)}</div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

function readProjects() {
  if (typeof window === "undefined") return defaultProjects;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as ProjectRecord[] | null;
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultProjects;
    return parsed.filter((project) => project.id && project.title);
  } catch {
    return defaultProjects;
  }
}

function statusLabel(status: ProjectStatus) {
  if (status === "active") return "В работе";
  if (status === "done") return "Готово";
  return "Запланировано";
}

function statusClass(status: ProjectStatus) {
  if (status === "active") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  if (status === "done") return "border-white/15 bg-white/10 text-white";
  return "border-amber-300/20 bg-amber-300/10 text-amber-100";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
