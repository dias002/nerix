import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { FolderKanban, Plus, Sparkles, X } from "lucide-react";
import {
  createProject as createProjectApi,
  deleteProject as deleteProjectApi,
  getProjects,
  toPublicApiError,
  updateProject as updateProjectApi,
  type UserProjectApiRecord,
  type UserProjectStatus,
  type UserProjectType,
} from "../api";
import { useAuth } from "../auth";
import FilterBar from "../components/workspace/FilterBar";
import PageHeader from "../components/workspace/PageHeader";
import ProjectCard from "../components/workspace/ProjectCard";
import SearchField from "../components/workspace/SearchField";

type ProjectRecord = UserProjectApiRecord;
type StatusFilter = "all" | UserProjectStatus;

const storageKey = "nomduchat-projects";

const projectTypes: Array<{ id: UserProjectType; label: string }> = [
  { id: "general", label: "Общий" },
  { id: "content", label: "Контент" },
  { id: "marketing", label: "Маркетинг" },
  { id: "development", label: "Разработка" },
  { id: "research", label: "Исследование" },
];

const statusFilters: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "active", label: "В работе" },
  { id: "planned", label: "Запланировано" },
  { id: "done", label: "Готово" },
];

const projectTemplates: Array<{
  title: string;
  description: string;
  projectType: UserProjectType;
}> = [
  {
    title: "Исследование рынка",
    description: "Сравнить конкурентов, аудиторию, цены, позиционирование и собрать выводы для решения.",
    projectType: "research",
  },
  {
    title: "Запуск продукта",
    description: "Собрать гипотезы, задачи, тексты, каналы продвижения и контрольный план запуска.",
    projectType: "marketing",
  },
  {
    title: "Создание сайта",
    description: "Подготовить структуру страниц, тексты, SEO, визуальные блоки и список доработок.",
    projectType: "development",
  },
  {
    title: "Контент на месяц",
    description: "Собрать темы, форматы, календарь публикаций, тезисы и идеи визуалов.",
    projectType: "content",
  },
  {
    title: "Коммерческое предложение",
    description: "Сформировать структуру предложения, оффер, выгоды, цены, FAQ и письмо клиенту.",
    projectType: "marketing",
  },
  {
    title: "Тендерная документация",
    description: "Разобрать требования, риски, документы, сроки и список вопросов заказчику.",
    projectType: "research",
  },
];

export default function Projects() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>(() => readLocalProjects());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<UserProjectType>("general");
  const [usesRemote, setUsesRemote] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (!createOpen && !pendingDelete) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCreateOpen(false);
      setPendingDelete(null);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [createOpen, pendingDelete]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUsesRemote(false);
      return;
    }

    let active = true;
    getProjects()
      .then((response) => {
        if (!active) return;
        setProjects((current) => [
          ...current.filter((project) => project.userId === "local-user"),
          ...response.projects,
        ]);
        setUsesRemote(true);
        setNotice(null);
      })
      .catch((error) => {
        if (!active) return;
        setUsesRemote(false);
        setNotice(toPublicApiError(error, "Проекты пока сохраняются в этом браузере."));
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const filteredProjects = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    return projects.filter((project) => {
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;

      const haystack = normalizeSearchText([
        project.title,
        project.description,
        projectTypeLabel(project.projectType),
        statusLabel(project.status),
      ].join(" "));
      return query.split(" ").every((word) => haystack.includes(word));
    });
  }, [projects, searchQuery, statusFilter]);

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const input = {
      title: cleanTitle,
      description: description.trim() || "Без описания",
      projectType,
      status: "planned" as const,
    };

    if (usesRemote) {
      try {
        const response = await createProjectApi(input);
        setProjects((current) => [response.project, ...current]);
        finishCreate();
        setNotice(null);
        return;
      } catch (error) {
        setUsesRemote(false);
        setNotice(toPublicApiError(error, "API проектов недоступен, проект сохранен локально."));
      }
    }

    setProjects((current) => [createLocalProject(input), ...current]);
    finishCreate();
  };

  const updateStatus = async (projectId: string, status: UserProjectStatus) => {
    const currentProject = projects.find((project) => project.id === projectId);
    if (!currentProject) return;

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

    if (!usesRemote || currentProject.userId === "local-user") return;

    try {
      const response = await updateProjectApi({ projectId, status });
      setProjects((current) => current.map((project) => (project.id === projectId ? response.project : project)));
      setNotice(null);
    } catch (error) {
      setProjects((current) => current.map((project) => (project.id === projectId ? currentProject : project)));
      setNotice(toPublicApiError(error, "Не удалось обновить проект."));
    }
  };

  const deleteProject = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    const currentProjects = projects;
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setPendingDelete(null);

    if (!usesRemote || project?.userId === "local-user") return;

    try {
      await deleteProjectApi(projectId);
      setNotice(null);
    } catch (error) {
      setProjects(currentProjects);
      setNotice(toPublicApiError(error, "Не удалось удалить проект."));
    }
  };

  const openProjectChat = (project: ProjectRecord) => {
    const prompt = [
      `Продолжим работу над проектом "${project.title}".`,
      `Тип проекта: ${projectTypeLabel(project.projectType)}.`,
      `Статус: ${statusLabel(project.status)}.`,
      `Описание: ${project.description || "без описания"}.`,
      "",
      "Сначала кратко оцени текущее состояние, затем предложи следующий конкретный шаг и список задач на сегодня.",
    ].join("\n");
    const params = new URLSearchParams({
      prompt,
      agent: project.projectType === "development" ? "code" : project.projectType === "marketing" ? "marketing" : "business",
      network: "auto",
    });
    navigate(`/workspace/chat?${params.toString()}`);
  };

  const finishCreate = () => {
    clearForm();
    setCreateOpen(false);
  };

  const clearForm = () => {
    setTitle("");
    setDescription("");
    setProjectType("general");
  };

  const applyTemplate = (template: (typeof projectTemplates)[number]) => {
    setTitle(template.title);
    setDescription(template.description);
    setProjectType(template.projectType);
    setCreateOpen(true);
  };

  return (
    <div className="ns-page-scroll">
      <main className="ns-page space-y-7">
        <PageHeader
          overline="Workspace"
          title="Проекты"
          actions={
            projects.length > 0 ? (
              <button type="button" onClick={() => setCreateOpen(true)} className="nd-primary-action inline-flex h-11 items-center gap-2 px-5 text-sm font-medium">
                <Plus className="h-4 w-4" strokeWidth={1.8} />
                Новый проект
              </button>
            ) : null
          }
        />

        {notice ? <div className="ns-surface-quiet px-4 py-3 text-sm text-[var(--text-secondary)]">{notice}</div> : null}

        {projects.length > 0 ? <section>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full max-w-xl">
              <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Найти проект, тип или статус" />
            </div>
            <FilterBar<StatusFilter> options={statusFilters} value={statusFilter} onChange={setStatusFilter} />
          </div>
        </section> : null}

        {filteredProjects.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                title={project.title}
                description={project.description}
                typeLabel={projectTypeLabel(project.projectType)}
                status={project.status}
                updatedAt={formatDate(project.updatedAt)}
                onOpen={() => openProjectChat(project)}
                onDelete={() => setPendingDelete(project)}
                onStatusChange={(status) => void updateStatus(project.id, status)}
              />
            ))}
          </section>
        ) : projects.length === 0 ? (
          <section className="ns-project-start">
            <span className="ns-project-start-icon"><FolderKanban className="h-5 w-5" strokeWidth={1.7} /></span>
            <h2>С чего начнём?</h2>
            <p>Выберите основу или создайте свой проект.</p>
            <div className="ns-project-start-templates">
              {projectTemplates.slice(0, 3).map((template) => (
                <button key={template.title} type="button" className="ns-quick-action" onClick={() => applyTemplate(template)}>
                  <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                  {template.title}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setCreateOpen(true)} className="nd-primary-action mt-5 inline-flex h-11 items-center gap-2 px-5 text-sm font-medium">
              <Plus className="h-4 w-4" strokeWidth={1.8} />
              Новый проект
            </button>
          </section>
        ) : (
          <section className="ns-project-no-results">
            <p>По этому запросу ничего нет.</p>
            <button type="button" className="ns-quick-action" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}>
              Сбросить фильтр
            </button>
          </section>
        )}
      </main>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setCreateOpen(false)}
            aria-label="Закрыть создание проекта"
          />
          <form onSubmit={createProject} className="ns-surface-panel relative z-10 w-full max-w-2xl p-5 shadow-[var(--shadow-floating)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="ns-overline">Новый проект</p>
                <h2 id="create-project-title" className="ns-section-title mt-2">Создать рабочий контекст</h2>
                <p className="ns-body mt-2">Название, тип и короткое описание.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="ns-shell-button h-10 w-10" aria-label="Закрыть">
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Название</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-1)] px-3 text-sm text-[var(--text-primary)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--signal-mint)] focus-visible:outline-offset-2"
                  placeholder="SEO-раздел"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Описание</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-28 w-full resize-none rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-1)] px-3 py-3 text-sm text-[var(--text-primary)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--signal-mint)] focus-visible:outline-offset-2"
                  placeholder="Что нужно сделать, какие материалы будут внутри, какой результат нужен"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Тип</span>
                <select
                  value={projectType}
                  onChange={(event) => setProjectType(event.target.value as UserProjectType)}
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-1)] px-3 text-sm text-[var(--text-primary)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--signal-mint)] focus-visible:outline-offset-2"
                >
                  {projectTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setCreateOpen(false)} className="nd-secondary-action inline-flex h-11 items-center justify-center px-4 text-sm">
                Отмена
              </button>
              <button type="submit" className="nd-primary-action inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-medium">
                <Plus className="h-4 w-4" strokeWidth={1.8} />
                Создать
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-4 py-8 sm:items-center"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setPendingDelete(null)}
            aria-label="Отменить удаление проекта"
          />
          <section className="ns-surface-panel relative z-10 w-full max-w-md p-5 shadow-[var(--shadow-floating)]">
            <p className="ns-overline">Удаление проекта</p>
            <h2 id="delete-project-title" className="ns-section-title mt-2">
              Удалить «{pendingDelete.title}»?
            </h2>
            <p className="ns-body mt-2">Проект исчезнет из рабочей среды. Это действие нельзя отменить.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" className="nd-secondary-action h-12" onClick={() => setPendingDelete(null)}>
                Отмена
              </button>
              <button type="button" className="nd-primary-action h-12" onClick={() => void deleteProject(pendingDelete.id)}>
                Удалить
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function readLocalProjects() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as ProjectRecord[] | null;
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    return parsed.filter((project) => project.id && project.title);
  } catch {
    return [];
  }
}

function createLocalProject(input: {
  title: string;
  description: string;
  projectType: UserProjectType;
  status: UserProjectStatus;
}): ProjectRecord {
  const now = new Date().toISOString();
  return {
    id: createLocalId(),
    userId: "local-user",
    title: input.title,
    description: input.description,
    projectType: input.projectType,
    status: input.status,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

function createLocalId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function statusLabel(status: UserProjectStatus) {
  if (status === "active") return "В работе";
  if (status === "done") return "Готово";
  return "Запланировано";
}

function projectTypeLabel(type: UserProjectType) {
  return projectTypes.find((projectType) => projectType.id === type)?.label ?? "Общий";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
