import { DomainError, fail, ok } from "../../domain/result.js";
import type { AgentRepository } from "./agent.repository.js";

export class AgentService {
  constructor(private readonly repository: AgentRepository) {}

  async listAllAgents() {
    return ok(await this.repository.listAll());
  }

  async listAgents() {
    return ok(await this.repository.listEnabled());
  }

  async updateAgentEnabled(agentId: string, enabled: boolean) {
    const agent = await this.repository.updateEnabled(agentId, enabled);

    if (!agent) {
      return fail(new DomainError("not_found", `Agent '${agentId}' was not found.`, 404));
    }

    return ok(agent);
  }

  async requireAgent(agentId: string) {
    const agent = await this.repository.findById(agentId);

    if (!agent || !agent.enabled) {
      return fail(new DomainError("not_found", `Agent '${agentId}' was not found.`, 404));
    }

    return ok(agent);
  }

  async findBestAgent(prompt: string, requestedAgentId?: string) {
    if (requestedAgentId) {
      return this.requireAgent(requestedAgentId);
    }

    const normalized = prompt.toLowerCase();
    const enabledAgents = await this.repository.listEnabled();
    const selectEnabledAgent = (agentId: string) => {
      const agent = enabledAgents.find((enabledAgent) => enabledAgent.id === agentId);
      return agent ? ok(agent) : null;
    };

    if (containsAny(normalized, ["видео", "video", "ролик", "shorts", "reels", "анимац", "сценарий ролика"])) {
      const agent = selectEnabledAgent("video");
      if (agent) return agent;
    }

    if (
      wantsGeneratedAudio(normalized) ||
      containsAny(normalized, [
        "песн",
        "трек",
        "music",
        "song",
        "melody",
        "бит",
        "джингл",
        "лирик",
        "lyrics",
        "сделай аудио",
        "создай аудио",
        "сгенерируй аудио",
        "make audio",
        "generate audio",
      ])
    ) {
      const agent = selectEnabledAgent("music");
      if (agent) return agent;
    }

    if (containsAny(normalized, ["голос", "озвуч", "voice", "speech", "диктор", "дубляж"])) {
      const agent = selectEnabledAgent("voice");
      if (agent) return agent;
    }

    if (containsAny(normalized, ["картин", "изображ", "image", "photo", "фото", "логотип", "аватар", "обложк"])) {
      const agent = selectEnabledAgent("image");
      if (agent) return agent;
    }

    if (containsAny(normalized, ["код", "code", "bug", "ошибка", "рефактор", "api", "typescript"])) {
      const agent = selectEnabledAgent("code");
      if (agent) return agent;
    }

    if (containsAny(normalized, ["маркет", "реклам", "оффер", "пост для соц", "креатив", "campaign"])) {
      const agent = selectEnabledAgent("marketing");
      if (agent) return agent;
    }

    if (containsAny(normalized, ["поддерж", "support", "faq", "тикет", "жалоб", "ответ клиенту"])) {
      const agent = selectEnabledAgent("support");
      if (agent) return agent;
    }

    if (containsAny(normalized, ["документ", "файл", "pdf", "договор", "таблиц", "резюме", "summary"])) {
      const agent = selectEnabledAgent("documents");
      if (agent) return agent;
    }

    const hasBusinessIntent = containsAny(normalized, [
      "бизнес",
      "продаж",
      "заявк",
      "crm",
      "telegram",
      "телеграм",
      "бот",
      "воронк",
      "менеджер",
    ]);
    const hasBusinessSiteRequest =
      containsAny(normalized, ["сайт", "лендинг", "landing", "website"]) &&
      containsAny(normalized, ["создай", "создать", "собери", "собрать", "запусти", "запустить", "сделай", "построй", "create", "build", "launch"]);

    if (hasBusinessIntent || hasBusinessSiteRequest) {
      const agent = selectEnabledAgent("business");
      if (agent) return agent;
    }

    if (containsAny(normalized, ["учеб", "объясни", "экзамен", "study", "learn"])) {
      const agent = selectEnabledAgent("study");
      if (agent) return agent;
    }

    const generalAgent = selectEnabledAgent("general");
    if (generalAgent) return generalAgent;
    const firstAvailableAgent = enabledAgents[0];
    if (firstAvailableAgent) return ok(firstAvailableAgent);
    return fail(new DomainError("not_found", "No enabled agents were found.", 404));
  }
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function wantsGeneratedAudio(value: string) {
  return containsAny(value, ["аудио", "audio"]) && containsAny(value, ["сделай", "создай", "сгенер", "запиши", "make", "generate", "create"]);
}
