import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, CircleDot, FolderKanban, ListChecks, MessageSquare, Plus, Trash2 } from "lucide-react";

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
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[18rem_1fr]">
        <aside className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-600">Workspace</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">Проекты</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Задачи, статусы и быстрый перенос контекста в чат.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3">
                <div className="text-xl font-semibold text-white">{stat.value}</div>
                <div className="mt-1 text-xs text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </aside>

        <main className="space-y-5">
          <form onSubmit={createProject} className="rounded-xl border border-white/10 bg-[#0D0D0D] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FolderKanban className="h-5 w-5 text-gray-300" strokeWidth={1.7} />
                <h3 className="text-base font-semibold text-white">Новый проект</h3>
              </div>
              <span className="hidden text-xs text-gray-600 sm:inline">Локально сохраняется в браузере</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.9fr_1.4fr_auto] md:items-end">
              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">Название</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-11 w-full rounded-lg border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                  placeholder="SEO-раздел"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">Описание</span>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="h-11 w-full rounded-lg border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                  placeholder="Что нужно сделать"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                <Plus className="h-4 w-4" strokeWidth={1.8} />
                Создать
              </button>
            </div>
          </form>

          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0D0D0D]">
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-white/10 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-gray-600">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" strokeWidth={1.7} />
                Список проектов
              </div>
              <div className="hidden sm:block">Действия</div>
            </div>
            {projects.map((project, index) => (
              <article
                key={project.id}
                className={`grid grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center ${
                  index !== projects.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {project.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-200" strokeWidth={1.7} />
                    ) : (
                      <CircleDot className="h-4 w-4 text-gray-500" strokeWidth={1.7} />
                    )}
                    <h3 className="truncate text-base font-semibold text-white">{project.title}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs ${statusClass(project.status)}`}>
                      {statusLabel(project.status)}
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500">{project.description}</p>
                  <div className="mt-2 text-xs text-gray-600">Обновлено: {formatDate(project.updatedAt)}</div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <select
                    value={project.status}
                    onChange={(event) => updateStatus(project.id, event.target.value as ProjectStatus)}
                    className="h-10 rounded-lg border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                  >
                    <option className="bg-black text-white" value="planned">Запланировано</option>
                    <option className="bg-black text-white" value="active">В работе</option>
                    <option className="bg-black text-white" value="done">Готово</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => openProjectChat(project)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                  >
                    <MessageSquare className="h-4 w-4" strokeWidth={1.7} />
                    В чат
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProject(project.id)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-red-400/10 hover:text-red-200"
                    aria-label="Удалить проект"
                    title="Удалить проект"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                  </button>
                </div>
              </article>
            ))}
          </section>
        </main>
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
