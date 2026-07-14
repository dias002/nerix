import { NoopDatabaseClient, type DatabaseClient } from "../database/index.js";
import { AdminService } from "../modules/admin/admin.service.js";
import { InMemoryAgentRepository, PostgresAgentRepository } from "../modules/agents/agent.repository.js";
import { AgentService } from "../modules/agents/agent.service.js";
import { AiGatewayService } from "../modules/ai-gateway/ai-gateway.service.js";
import { createCompletionProvider } from "../modules/ai-gateway/completion-provider.js";
import { InMemoryAuthRepository, PostgresAuthRepository } from "../modules/auth/auth.repository.js";
import { MailingPasswordResetMailer, type PasswordResetMailer } from "../modules/auth/password-reset-mailer.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { InMemoryWalletRepository, PostgresWalletRepository } from "../modules/billing/wallet.repository.js";
import { BillingService } from "../modules/billing/billing.service.js";
import { InMemoryBusinessRepository, PostgresBusinessRepository } from "../modules/business/business.repository.js";
import { BusinessService } from "../modules/business/business.service.js";
import {
  InMemoryBusinessJobRepository,
  PostgresBusinessJobRepository,
} from "../modules/business-jobs/business-job.repository.js";
import { BusinessJobService } from "../modules/business-jobs/business-job.service.js";
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
import {
  InMemoryKnowledgeBaseRepository,
  PostgresKnowledgeBaseRepository,
} from "../modules/knowledge-base/knowledge-base.repository.js";
import { KnowledgeBaseService } from "../modules/knowledge-base/knowledge-base.service.js";
import { InMemoryMailingRepository, PostgresMailingRepository } from "../modules/mailings/mailing.repository.js";
import { MailingService } from "../modules/mailings/mailing.service.js";
import { SmtpBzClient, type MailingTransport } from "../modules/mailings/smtp-bz.client.js";
import {
  MailingTransactionalMailer,
  type TransactionalMailer,
} from "../modules/notifications/transactional-mailer.js";
import { LifecycleNotificationsService } from "../modules/notifications/lifecycle-notifications.service.js";
import {
  AbuseGuardService,
  createAbuseRateLimitRepository,
  type AbuseRateLimitRepository,
} from "../modules/security/abuse-guard.js";
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
  knowledgeBase: KnowledgeBaseService;
  businessOps: BusinessOpsService;
  businessWebsites: BusinessWebsiteService;
  businessJobs: BusinessJobService;
  telegramBots: TelegramBotOrderService;
  admin: AdminService;
  lifecycleNotifications: LifecycleNotificationsService;
  abuseGuard: AbuseGuardService;
};

export type CreateDependenciesOptions = {
  database?: DatabaseClient;
  persistence?: "memory" | "postgres";
  mailingTransport?: MailingTransport;
  passwordResetMailer?: PasswordResetMailer;
  transactionalMailer?: TransactionalMailer;
  abuseRateLimitRepository?: AbuseRateLimitRepository;
  abuseGuard?: AbuseGuardService;
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
  const businessJobRepository =
    persistence === "postgres" ? new PostgresBusinessJobRepository(database) : new InMemoryBusinessJobRepository();
  const businessWebsiteRepository =
    persistence === "postgres"
      ? new PostgresBusinessWebsiteRepository(database)
      : new InMemoryBusinessWebsiteRepository();
  const knowledgeBaseRepository =
    persistence === "postgres"
      ? new PostgresKnowledgeBaseRepository(database)
      : new InMemoryKnowledgeBaseRepository();
  const generationRepository =
    persistence === "postgres" ? new PostgresGenerationRepository(database) : new InMemoryGenerationRepository();
  const telegramBotOrderRepository =
    persistence === "postgres"
      ? new PostgresTelegramBotOrderRepository(database)
      : new InMemoryTelegramBotOrderRepository();
  const abuseRateLimitRepository =
    options.abuseRateLimitRepository ?? createAbuseRateLimitRepository(database, persistence);

  const users = new UserService(userRepository);
  const mailingTransport = options.mailingTransport ?? new SmtpBzClient();
  const transactionalMailer = options.transactionalMailer ?? new MailingTransactionalMailer(mailingTransport);
  const auth = new AuthService(
    authRepository,
    options.passwordResetMailer ?? new MailingPasswordResetMailer(mailingTransport),
    transactionalMailer
  );
  const agents = new AgentService(agentRepository);
  const billing = new BillingService(walletRepository, agents);
  const aiGateway = new AiGatewayService(agents, billing, createCompletionProvider());
  const subscriptions = new SubscriptionService(subscriptionRepository, billing, transactionalMailer);
  const generation = new GenerationService(
    generationRepository,
    aiGateway,
    billing,
    createMediaGenerationProvider(),
    subscriptions
  );
  const chat = new ChatService(conversationRepository, aiGateway, generation, subscriptions);
  const mailings = new MailingService(mailingRepository, mailingTransport);
  const business = new BusinessService(businessRepository, subscriptions);
  const knowledgeBase = new KnowledgeBaseService(knowledgeBaseRepository, business);
  const businessOps = new BusinessOpsService(businessOpsRepository, business);
  const businessWebsites = new BusinessWebsiteService(businessWebsiteRepository);
  const telegramBots = new TelegramBotOrderService(telegramBotOrderRepository);
  const businessJobs = new BusinessJobService(
    businessJobRepository,
    business,
    knowledgeBase,
    businessWebsites,
    telegramBots
  );
  const admin = new AdminService(database, agents);
  const lifecycleNotifications = new LifecycleNotificationsService(database, transactionalMailer);
  const abuseGuard = options.abuseGuard ?? new AbuseGuardService(abuseRateLimitRepository);

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
    knowledgeBase,
    businessOps,
    businessWebsites,
    businessJobs,
    telegramBots,
    admin,
    lifecycleNotifications,
    abuseGuard,
  };
}
