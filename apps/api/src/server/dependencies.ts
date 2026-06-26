import { NoopDatabaseClient, type DatabaseClient } from "../database/index.js";
import { AdminService } from "../modules/admin/admin.service.js";
import { InMemoryAgentRepository, PostgresAgentRepository } from "../modules/agents/agent.repository.js";
import { AgentService } from "../modules/agents/agent.service.js";
import { AiGatewayService } from "../modules/ai-gateway/ai-gateway.service.js";
import { createCompletionProvider } from "../modules/ai-gateway/completion-provider.js";
import { InMemoryAuthRepository, PostgresAuthRepository } from "../modules/auth/auth.repository.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { InMemoryWalletRepository, PostgresWalletRepository } from "../modules/billing/wallet.repository.js";
import { BillingService } from "../modules/billing/billing.service.js";
import { InMemoryBusinessRepository, PostgresBusinessRepository } from "../modules/business/business.repository.js";
import { BusinessService } from "../modules/business/business.service.js";
import {
  InMemoryBusinessOpsRepository,
  PostgresBusinessOpsRepository,
} from "../modules/business-ops/business-ops.repository.js";
import { BusinessOpsService } from "../modules/business-ops/business-ops.service.js";
import {
  InMemoryBusinessWebsiteRepository,
  PostgresBusinessWebsiteRepository,
} from "../modules/business-websites/business-website.repository.js";
import { BusinessWebsiteService } from "../modules/business-websites/business-website.service.js";
import { ChatService } from "../modules/chat/chat.service.js";
import { InMemoryConversationRepository, PostgresConversationRepository } from "../modules/chat/conversation.repository.js";
import { InMemoryGenerationRepository, PostgresGenerationRepository } from "../modules/generation/generation.repository.js";
import { GenerationService } from "../modules/generation/generation.service.js";
import { createMediaGenerationProvider } from "../modules/generation/media-provider.js";
import { InMemoryMailingRepository, PostgresMailingRepository } from "../modules/mailings/mailing.repository.js";
import { MailingService } from "../modules/mailings/mailing.service.js";
import { SmtpBzClient, type MailingTransport } from "../modules/mailings/smtp-bz.client.js";
import {
  InMemorySubscriptionRepository,
  PostgresSubscriptionRepository,
} from "../modules/subscriptions/subscription.repository.js";
import { SubscriptionService } from "../modules/subscriptions/subscription.service.js";
import {
  InMemoryTelegramBotOrderRepository,
  PostgresTelegramBotOrderRepository,
} from "../modules/telegram-bots/telegram-bot.repository.js";
import { TelegramBotOrderService } from "../modules/telegram-bots/telegram-bot.service.js";
import { InMemoryUserRepository, PostgresUserRepository } from "../modules/users/user.repository.js";
import { UserService } from "../modules/users/user.service.js";

export type AppDependencies = {
  database: DatabaseClient;
  auth: AuthService;
  users: UserService;
  billing: BillingService;
  agents: AgentService;
  aiGateway: AiGatewayService;
  chat: ChatService;
  generation: GenerationService;
  subscriptions: SubscriptionService;
  mailings: MailingService;
  business: BusinessService;
  businessOps: BusinessOpsService;
  businessWebsites: BusinessWebsiteService;
  telegramBots: TelegramBotOrderService;
  admin: AdminService;
};

export type CreateDependenciesOptions = {
  database?: DatabaseClient;
  persistence?: "memory" | "postgres";
  mailingTransport?: MailingTransport;
};

export function createDependencies(options: CreateDependenciesOptions = {}): AppDependencies {
  const database = options.database ?? new NoopDatabaseClient();
  const persistence = options.persistence ?? "memory";
  const userRepository =
    persistence === "postgres" ? new PostgresUserRepository(database) : new InMemoryUserRepository();
  const authRepository =
    persistence === "postgres" ? new PostgresAuthRepository(database) : new InMemoryAuthRepository();
  const walletRepository =
    persistence === "postgres" ? new PostgresWalletRepository(database) : new InMemoryWalletRepository();
  const agentRepository =
    persistence === "postgres" ? new PostgresAgentRepository(database) : new InMemoryAgentRepository();
  const conversationRepository =
    persistence === "postgres" ? new PostgresConversationRepository(database) : new InMemoryConversationRepository();
  const subscriptionRepository =
    persistence === "postgres" ? new PostgresSubscriptionRepository(database) : new InMemorySubscriptionRepository();
  const mailingRepository =
    persistence === "postgres" ? new PostgresMailingRepository(database) : new InMemoryMailingRepository();
  const businessRepository =
    persistence === "postgres" ? new PostgresBusinessRepository(database) : new InMemoryBusinessRepository();
  const businessOpsRepository =
    persistence === "postgres" ? new PostgresBusinessOpsRepository(database) : new InMemoryBusinessOpsRepository();
  const businessWebsiteRepository =
    persistence === "postgres"
      ? new PostgresBusinessWebsiteRepository(database)
      : new InMemoryBusinessWebsiteRepository();
  const generationRepository =
    persistence === "postgres" ? new PostgresGenerationRepository(database) : new InMemoryGenerationRepository();
  const telegramBotOrderRepository =
    persistence === "postgres"
      ? new PostgresTelegramBotOrderRepository(database)
      : new InMemoryTelegramBotOrderRepository();

  const users = new UserService(userRepository);
  const auth = new AuthService(authRepository);
  const agents = new AgentService(agentRepository);
  const billing = new BillingService(walletRepository, agents);
  const aiGateway = new AiGatewayService(agents, billing, createCompletionProvider());
  const generation = new GenerationService(generationRepository, aiGateway, billing, createMediaGenerationProvider());
  const chat = new ChatService(conversationRepository, aiGateway, generation);
  const subscriptions = new SubscriptionService(subscriptionRepository, billing);
  const mailings = new MailingService(mailingRepository, options.mailingTransport ?? new SmtpBzClient());
  const business = new BusinessService(businessRepository, subscriptions);
  const businessOps = new BusinessOpsService(businessOpsRepository, business);
  const businessWebsites = new BusinessWebsiteService(businessWebsiteRepository);
  const telegramBots = new TelegramBotOrderService(telegramBotOrderRepository);
  const admin = new AdminService(database, agents);

  return {
    database,
    auth,
    users,
    billing,
    agents,
    aiGateway,
    chat,
    generation,
    subscriptions,
    mailings,
    business,
    businessOps,
    businessWebsites,
    telegramBots,
    admin,
  };
}
