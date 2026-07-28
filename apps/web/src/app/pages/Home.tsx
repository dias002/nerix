import { Link } from "react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  Bot,
  Brain,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  FolderKanban,
  Globe2,
  ImageIcon,
  Layers3,
  LifeBuoy,
  Mail,
  PlayCircle,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Video,
  Volume2,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { reachAnalyticsGoal } from "../analytics";
import { useAuth } from "../auth";
import { languageOptions, useLanguage } from "../i18n";
import { preloadWorkspaceChat, runWhenIdle } from "../routePreloads";

type Tone = "mint" | "blue" | "violet";

const scenarioMeta: Array<{ icon: LucideIcon; tone: Tone }> = [
  { icon: FileText, tone: "blue" },
  { icon: SearchCheck, tone: "mint" },
  { icon: Layers3, tone: "violet" },
  { icon: ImageIcon, tone: "mint" },
  { icon: Video, tone: "blue" },
  { icon: Building2, tone: "violet" },
];

const mediaIcons: LucideIcon[] = [ImageIcon, Video, Volume2, Bot];

type WorkflowDemoCopy = {
  requestLabel: string;
  request: string;
  auto: string;
  modelLabel: string;
  model: string;
  modelReason: string;
  quality: string;
  cost: string;
  resultLabel: string;
  result: string;
  saveProject: string;
  createEmail: string;
  steps: ReadonlyArray<{
    title: string;
    text: string;
    state: string;
  }>;
};

export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const landing = t.home.landing;
  const projectsHref = isAuthenticated
    ? "/workspace/projects"
    : "/auth?mode=register&returnTo=%2Fworkspace%2Fprojects";
  const preloadChat = () => preloadWorkspaceChat();

  useEffect(() => {
    document.documentElement.dataset.landingShell = "true";
    return () => {
      delete document.documentElement.dataset.landingShell;
    };
  }, []);

  useEffect(() => runWhenIdle(preloadWorkspaceChat, 2400), []);

  return (
    <div className="landing-shell min-h-dvh overflow-x-hidden text-[var(--text-primary)]">
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link to="/" className="landing-brand" aria-label="nomduchat">
            <img src="/favicon.png" alt="" className="landing-brand-icon" />
            <span>nomduchat</span>
          </Link>
          <nav className="landing-nav" aria-label={landing.nav.workflow}>
            <a href="#workflow">{landing.nav.workflow}</a>
            <a href="#scenarios">{landing.nav.scenarios}</a>
            <a href="#pricing">{landing.nav.pricing}</a>
            <Link to="/support">{landing.nav.support}</Link>
          </nav>
          <div className="landing-header-actions">
            <div className="landing-locale" aria-label="Язык интерфейса">
              {languageOptions.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => setLanguage(option.code)}
                  aria-pressed={language === option.code}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Link to="/workspace/chat" className="landing-primary landing-header-cta" onMouseEnter={preloadChat} onFocus={preloadChat}>
              {landing.cta.try}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-ambient" aria-hidden="true" />
          <div className="landing-hero-copy">
            <div className="landing-kicker">
              <Sparkles className="h-4 w-4" strokeWidth={1.8} />
              {landing.hero.eyebrow}
            </div>
            <h1>{landing.hero.title}</h1>
            <p>{landing.hero.subtitle}</p>
            <div className="landing-actions">
              <Link to="/workspace/chat" className="landing-primary" onMouseEnter={preloadChat} onFocus={preloadChat}>
                {landing.cta.free}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              <a href="#workflow" className="landing-secondary">
                <PlayCircle className="h-4 w-4" strokeWidth={1.8} />
                {landing.cta.demo}
              </a>
            </div>
            <div className="landing-signal-list">
              {landing.signals.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
          </div>
          <WorkflowDemo demo={landing.demo} projectsHref={projectsHref} />
        </section>

        <section id="workflow" className="landing-section">
          <SectionHeader
            eyebrow={landing.workflow.eyebrow}
            title={landing.workflow.title}
            text={landing.workflow.text}
          />
          <div className="landing-process-grid">
            {landing.workflow.items.map((item, index) => (
              <article key={item.title} className="landing-process-card">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="scenarios" className="landing-section">
          <SectionHeader
            eyebrow={landing.scenarios.eyebrow}
            title={landing.scenarios.title}
            text={landing.scenarios.text}
          />
          <div className="landing-scenario-grid">
            {landing.scenarios.items.map((scenario, index) => {
              const meta = scenarioMeta[index] ?? scenarioMeta[0];
              const Icon = meta.icon;
              return (
                <article key={scenario.title} className="landing-scenario-card" data-tone={meta.tone}>
                  <span className="landing-icon-tile">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <h3>{scenario.title}</h3>
                  <p>{scenario.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-section landing-split">
          <article className="landing-feature-panel">
            <div className="landing-kicker landing-kicker-quiet">
              <Brain className="h-4 w-4" strokeWidth={1.8} />
              {landing.routing.eyebrow}
            </div>
            <h2>{landing.routing.title}</h2>
            <p>{landing.routing.text}</p>
            <div className="landing-model-board">
              {landing.routing.items.map(([task, model, reason]) => (
                <div key={task}>
                  <span>{task}</span>
                  <strong>{model}</strong>
                  <small>{reason}</small>
                </div>
              ))}
            </div>
          </article>
          <article className="landing-feature-panel landing-media-panel">
            <div className="landing-kicker landing-kicker-quiet">
              <WandSparkles className="h-4 w-4" strokeWidth={1.8} />
              {landing.media.eyebrow}
            </div>
            <h2>{landing.media.title}</h2>
            <div className="landing-media-grid">
              {landing.media.items.map((item, index) => {
                const Icon = mediaIcons[index] ?? ImageIcon;
                return (
                  <div key={item.label}>
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="landing-section landing-project-band">
          <div>
            <div className="landing-kicker landing-kicker-quiet">
              <FolderKanban className="h-4 w-4" strokeWidth={1.8} />
              {landing.projects.eyebrow}
            </div>
            <h2>{landing.projects.title}</h2>
            <p>{landing.projects.text}</p>
          </div>
          <div className="landing-project-preview" aria-label={landing.projects.sample}>
            <div>
              <span>{landing.projects.label}</span>
              <strong>{landing.projects.sample}</strong>
            </div>
            <ul>
              {landing.projects.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-section landing-split">
          <article className="landing-feature-panel">
            <div className="landing-kicker landing-kicker-quiet">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
              {landing.business.eyebrow}
            </div>
            <h2>{landing.business.title}</h2>
            <div className="landing-business-list">
              {landing.business.products.map((item) => (
                <div key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="landing-feature-panel">
            <div className="landing-kicker landing-kicker-quiet">
              <Globe2 className="h-4 w-4" strokeWidth={1.8} />
              {landing.devices.eyebrow}
            </div>
            <h2>{landing.devices.title}</h2>
            <p>{landing.devices.text}</p>
            <Link to="/workspace/chat" className="landing-secondary landing-inline-link" onMouseEnter={preloadChat} onFocus={preloadChat}>
              {landing.cta.workspace}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </article>
        </section>

        <section id="pricing" className="landing-section">
          <div className="landing-section-row">
            <SectionHeader
              eyebrow={landing.pricing.eyebrow}
              title={landing.pricing.title}
              text={landing.pricing.text}
            />
            <Link
              to="/legal/pricing"
              onClick={() => reachAnalyticsGoal("pricing_open", { source: "home_pricing" })}
              className="landing-secondary"
            >
              {landing.cta.catalog}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
          <div className="landing-pricing-grid">
            {landing.pricing.plans.map((plan) => (
              <article key={plan.name} className="landing-price-card" data-recommended={plan.recommended ? "true" : undefined}>
                {plan.recommended ? <span className="landing-plan-badge">{landing.pricing.recommended}</span> : null}
                <h3>{plan.name}</h3>
                <strong>{plan.price}</strong>
                <p>{plan.note}</p>
                <ul>
                  {plan.capacity.map((line) => (
                    <li key={line}>
                      <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                      {line}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-news-faq">
          <article className="landing-feature-panel">
            <div className="landing-kicker landing-kicker-quiet">
              <CircleDollarSign className="h-4 w-4" strokeWidth={1.8} />
              {landing.updates.eyebrow}
            </div>
            <div className="landing-update-list">
              {landing.updates.items.map((update) => (
                <div key={update.title}>
                  <span>{update.date}</span>
                  <strong>{update.title}</strong>
                </div>
              ))}
            </div>
          </article>
          <article className="landing-feature-panel">
            <h2>{landing.faq.title}</h2>
            <div className="landing-faq-list">
              {landing.faq.items.map((item) => (
                <div key={item.question}>
                  <strong>{item.question}</strong>
                  <span>{item.answer}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="landing-final">
          <div>
            <h2>{landing.final.title}</h2>
            <p>{landing.final.text}</p>
          </div>
          <Link to="/workspace/chat" className="landing-primary" onMouseEnter={preloadChat} onFocus={preloadChat}>
            {landing.cta.final}
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div>nomduchat</div>
        <nav aria-label={landing.nav.support}>
          <Link to="/legal/terms">{landing.footer.terms}</Link>
          <Link to="/legal/privacy">{landing.footer.privacy}</Link>
          <Link to="/legal/pricing">{landing.footer.prices}</Link>
          <Link to="/support">
            <LifeBuoy className="h-4 w-4" strokeWidth={1.7} />
            {landing.footer.support}
          </Link>
          <Link to="/contacts">
            <Mail className="h-4 w-4" strokeWidth={1.7} />
            {landing.footer.contacts}
          </Link>
          <Link to="/requisites">{landing.footer.requisites}</Link>
        </nav>
      </footer>
    </div>
  );
}

function WorkflowDemo({ demo, projectsHref }: { demo: WorkflowDemoCopy; projectsHref: string }) {
  const emailPrompt = `Создай письмо на основе результата: ${demo.result}`;
  const actionClassName = "inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] bg-[var(--surface-active)] px-[11px] text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] [font-weight:540]";

  return (
    <section className="landing-workflow-demo" aria-label={demo.request}>
      <div className="landing-workflow-header">
        <div>
          <span>{demo.requestLabel}</span>
          <strong>{demo.request}</strong>
        </div>
        <span className="landing-status-pill">{demo.auto}</span>
      </div>
      <div className="landing-demo-body">
        <div className="landing-model-card">
          <span>{demo.modelLabel}</span>
          <strong>{demo.model}</strong>
          <p>{demo.modelReason}</p>
          <div>
            <small>{demo.quality}</small>
            <small>{demo.cost}</small>
          </div>
        </div>
        <div className="landing-step-list">
          {demo.steps.map((step) => (
            <article key={step.title} data-state={step.state}>
              <span />
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="landing-result-card">
        <div>
          <span>{demo.resultLabel}</span>
          <strong>{demo.result}</strong>
        </div>
        <div className="landing-result-actions">
          <Link to={projectsHref} className={actionClassName}>
            {demo.saveProject}
          </Link>
          <Link to={`/workspace/chat?prompt=${encodeURIComponent(emailPrompt)}`} className={actionClassName}>
            {demo.createEmail}
          </Link>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="landing-section-header">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      <span>{text}</span>
    </div>
  );
}
