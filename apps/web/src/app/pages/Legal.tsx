import { Link, useLocation } from "react-router";
import { ArrowLeft, Building2, Cookie, CreditCard, FileText, RefreshCcw, Repeat2, ShieldCheck, type LucideIcon } from "lucide-react";
import StarsBackground from "../components/StarsBackground";

type LegalPageKey = "privacy" | "terms" | "refund" | "pricing" | "cookies" | "autoRenewal";

const companyName = "Оператор сервиса nomduchat";
const supportEmail = "admin@nomduchat.com";

const pricingCatalog = [
  {
    name: "Подписка Easy Start на 1 месяц",
    price: "990 ₽",
    details: "2 000 nomduchat-кредитов, AI-чат, история диалогов, работа с текстами и файлами.",
  },
  {
    name: "Подписка Active Work на 1 месяц",
    price: "1 990 ₽",
    details: "5 000 nomduchat-кредитов, расширенный лимит для документов, кода и регулярной работы.",
  },
  {
    name: "Подписка Team Mode на 1 месяц",
    price: "19 990 ₽",
    details: "20 000 nomduchat-кредитов, командные и бизнес-сценарии с увеличенным контекстом.",
  },
  {
    name: "Подписка Business Cabinet на 1 месяц",
    price: "41 690 ₽",
    details: "50 000 nomduchat-кредитов, бизнес-workspace до 5 сотрудников, роли, CRM-аналитика и инструменты компании.",
  },
];

const pages: Record<
  LegalPageKey,
  {
    title: string;
    subtitle: string;
    icon: LucideIcon;
    updatedAt: string;
    sections: Array<{ title: string; text: string[] }>;
  }
> = {
  privacy: {
    title: "Политика конфиденциальности",
    subtitle: "Как nomduchat обрабатывает данные пользователей, аккаунтов, платежей и бизнес-workspace.",
    icon: ShieldCheck,
    updatedAt: "27 июня 2026",
    sections: [
      {
        title: "Оператор данных",
        text: [
          `${companyName}. Реквизиты компании доступны на странице /requisites.`,
          `По вопросам персональных данных и доступа к аккаунту можно написать на ${supportEmail}.`,
        ],
      },
      {
        title: "Какие данные обрабатываются",
        text: [
          "Email, имя, страна аккаунта, язык интерфейса, сведения о тарифе, платежах, балансе кредитов и действиях внутри сервиса.",
          "Содержимое запросов, загруженные текстовые файлы, история чатов, настройки бизнес-workspace, роли сотрудников, CRM-заметки и данные, которые пользователь сам добавляет в сервис.",
          "Технические данные: IP-адрес, сведения о браузере, ошибки приложения, события безопасности и идентификаторы сессий.",
        ],
      },
      {
        title: "Для чего используются данные",
        text: [
          "Для регистрации, авторизации, работы AI-функций, расчета лимитов, оплаты тарифов, отправки чеков, поддержки пользователей и защиты сервиса от злоупотреблений.",
          "Для B2B-функций данные используются внутри workspace: заявки, роли сотрудников, клиентские заметки, настройки ботов и сайтов.",
        ],
      },
      {
        title: "Передача третьим лицам",
        text: [
          "Для выполнения запросов данные могут передаваться AI-провайдерам, платежным провайдерам, почтовым сервисам, хостингу и системам мониторинга.",
          "Платежные данные банковских карт обрабатываются платежным провайдером. nomduchat не хранит полный номер карты и CVV.",
        ],
      },
      {
        title: "Хранение и удаление",
        text: [
          "Данные хранятся столько, сколько необходимо для работы сервиса, бухгалтерского учета, безопасности и исполнения обязательств перед пользователем.",
          `Пользователь может запросить удаление аккаунта или выгрузку данных через ${supportEmail}.`,
        ],
      },
    ],
  },
  terms: {
    title: "Пользовательское соглашение",
    subtitle: "Условия доступа к AI-сервису nomduchat, тарифам, B2B-инструментам и сгенерированному контенту.",
    icon: FileText,
    updatedAt: "27 июня 2026",
    sections: [
      {
        title: "Предмет соглашения",
        text: [
          `${companyName} предоставляет пользователям доступ к сервису nomduchat: AI-чат, генерация и обработка контента, бизнес-workspace, CRM-инструменты, боты, сайты и другие цифровые функции.`,
          "Фактический набор функций зависит от тарифа, страны аккаунта, доступности AI-провайдеров и технических ограничений.",
        ],
      },
      {
        title: "Аккаунт и безопасность",
        text: [
          "Пользователь отвечает за достоверность данных аккаунта, сохранность пароля и действия, совершенные под его учетной записью.",
          "Запрещено использовать сервис для незаконных действий, спама, фишинга, вредоносного кода, нарушения прав третьих лиц и обхода лимитов.",
        ],
      },
      {
        title: "AI-контент",
        text: [
          "Ответы AI и сгенерированные материалы могут содержать ошибки. Пользователь должен самостоятельно проверять важную информацию перед публикацией, оплатой, юридическим или медицинским применением.",
          "Пользователь отвечает за исходные данные, которые он загружает в сервис, и подтверждает, что имеет право их использовать.",
        ],
      },
      {
        title: "Оплата и тарифы",
        text: [
          "Платные функции предоставляются по тарифам, указанным на странице /legal/pricing и в интерфейсе оплаты.",
          "После успешной оплаты сервис активирует тариф или начисляет кредиты. Обработка платежей и чеков выполняется платежным провайдером.",
        ],
      },
      {
        title: "Ограничение ответственности",
        text: [
          "Сервис предоставляется в пределах технической доступности. Возможны временные ограничения из-за провайдеров AI, платежных систем, хостинга, лимитов или профилактических работ.",
          "nomduchat не гарантирует, что AI-ответы всегда будут точными, полными или подходящими для конкретной цели пользователя.",
        ],
      },
    ],
  },
  refund: {
    title: "Условия возврата",
    subtitle: "Как пользователь может запросить возврат оплаты за тариф или недоступную услугу.",
    icon: RefreshCcw,
    updatedAt: "27 июня 2026",
    sections: [
      {
        title: "Когда можно запросить возврат",
        text: [
          "Если оплата прошла, но тариф или кредиты не были активированы по технической причине.",
          "Если платеж был списан повторно из-за технического сбоя.",
          "Если услуга не была оказана и пользователь обратился в поддержку до существенного использования оплаченного лимита.",
        ],
      },
      {
        title: "Когда возврат может быть отклонен",
        text: [
          "Если оплаченный лимит уже был использован для AI-запросов, генерации медиа, бизнес-операций или других цифровых услуг.",
          "Если доступ к сервису был ограничен из-за нарушения пользовательского соглашения.",
        ],
      },
      {
        title: "Как запросить возврат",
        text: [
          `Напишите на ${supportEmail} с email аккаунта, датой платежа, суммой, тарифом и причиной обращения.`,
          "Мы проверим платеж, статус тарифа, начисление кредитов и фактическое использование услуги.",
        ],
      },
      {
        title: "Срок обработки",
        text: [
          "Запросы рассматриваются в разумный срок после получения всех данных. Возврат, если он одобрен, проводится тем же способом, которым была совершена оплата, если платежный провайдер поддерживает такой сценарий.",
        ],
      },
    ],
  },
  pricing: {
    title: "Каталог услуг и цены",
    subtitle: "Фиксированные цены на цифровые услуги nomduchat, доступные для онлайн-оплаты на сайте.",
    icon: CreditCard,
    updatedAt: "2 июля 2026",
    sections: [
      {
        title: "Что можно оплатить онлайн",
        text: [
          "На сайте можно оплатить месячную подписку на доступ к цифровому AI-сервису nomduchat.",
          "Оплата через YooKassa доступна для тарифов в рублях: Easy Start, Active Work, Team Mode и Business Cabinet.",
          "Каждая услуга в каталоге ниже имеет фиксированную цену, указанную как точная сумма в рублях.",
        ],
      },
      {
        title: "Что входит в доступ",
        text: [
          "AI-запросы в рамках лимита кредитов тарифа.",
          "История чатов, работа с текстовыми файлами, генерация и обработка контента при наличии доступного провайдера.",
          "B2B-функции для бизнес-тарифа: workspace, сотрудники, роли, заявки, идеи, Telegram-менеджер, сайты и CRM-заметки.",
        ],
      },
      {
        title: "Период доступа",
        text: [
          "Цена каждого тарифа указана за 1 месяц доступа.",
          "После успешной оплаты сервис активирует выбранный тариф и начисляет указанный объем nomduchat-кредитов на аккаунт пользователя.",
        ],
      },
      {
        title: "Лимиты и доступность",
        text: [
          "Количество кредитов, контекст и доступные типы генерации могут отличаться по тарифу, стране, текущим ограничениям AI-провайдеров и правилам безопасности.",
          "Видео, аудио, изображения и тяжелые бизнес-операции могут выполняться дольше обычных текстовых запросов.",
        ],
      },
      {
        title: "Документы и чеки",
        text: [
          "Чеки и подтверждения оплаты формируются платежным провайдером, если это поддерживается выбранным способом оплаты.",
          "Реквизиты оператора сервиса размещены на странице /requisites.",
        ],
      },
    ],
  },
  cookies: {
    title: "Согласие на использование cookies",
    subtitle: "Какие cookies использует nomduchat и как пользователь может управлять согласием.",
    icon: Cookie,
    updatedAt: "7 июля 2026",
    sections: [
      {
        title: "Необходимые cookies",
        text: [
          "Необходимые cookies нужны для работы интерфейса, авторизации, выбора языка, страны, темы, сохранения согласия и защиты сессии.",
          "Без них часть функций сервиса может работать некорректно: вход, рабочее пространство, платежные статусы и настройки пользователя.",
        ],
      },
      {
        title: "Аналитические cookies",
        text: [
          "Аналитические cookies и события веб-аналитики используются только для понимания, какие страницы и функции требуют улучшения.",
          "Такие cookies не нужны для базовой работы сервиса и могут включаться после согласия пользователя.",
        ],
      },
      {
        title: "Управление согласием",
        text: [
          "Пользователь может принять все cookies или оставить только необходимые в баннере на сайте.",
          "Чтобы изменить выбор, можно очистить cookies и localStorage сайта в настройках браузера. После этого баннер появится снова.",
        ],
      },
    ],
  },
  autoRenewal: {
    title: "Согласие на автопродление подписки",
    subtitle: "Условия автоматического продления тарифа nomduchat и отключения автосписания.",
    icon: Repeat2,
    updatedAt: "7 июля 2026",
    sections: [
      {
        title: "Как работает автопродление",
        text: [
          "При подключении платного тарифа автопродление включается по умолчанию, если выбранный платежный провайдер поддерживает регулярные списания.",
          "Следующее списание выполняется в конце оплаченного периода по цене активного тарифа, указанной в интерфейсе подписки и каталоге услуг.",
        ],
      },
      {
        title: "Как отключить",
        text: [
          "Пользователь может отключить автопродление в разделе «Подписка» до даты следующего списания.",
          "После отключения текущий оплаченный период остается доступным до окончания срока действия тарифа.",
        ],
      },
      {
        title: "Если списание не прошло",
        text: [
          "Если платеж не прошел, сервис показывает уведомление и предлагает повторить оплату или выбрать другой способ оплаты.",
          "Доступ к платным функциям может быть ограничен после окончания оплаченного периода, если подписка не продлена.",
        ],
      },
    ],
  },
};

export default function Legal() {
  const location = useLocation();
  const pageKey = resolvePageKey(location.pathname);
  const page = pages[pageKey];
  const Icon = page.icon;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <StarsBackground />

      <header className="fixed left-6 right-6 top-6 z-20 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-medium text-white transition-colors hover:text-gray-300">
          nomduchat
        </Link>
        <Link
          to="/requisites"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
        >
          <Building2 className="h-4 w-4" strokeWidth={1.7} />
          Реквизиты
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-28 md:py-32">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          На главную
        </Link>

        <section className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <Icon className="h-4 w-4" strokeWidth={1.7} />
            Документы nomduchat
          </div>
          <h1 className="mt-5 text-4xl font-semibold md:text-6xl">{page.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">{page.subtitle}</p>
          <div className="mt-4 text-sm text-gray-600">Обновлено: {page.updatedAt}</div>
        </section>

        <nav className="mt-8 flex flex-wrap gap-2">
          <LegalLink to="/legal/terms" label="Соглашение" active={pageKey === "terms"} />
          <LegalLink to="/legal/privacy" label="Конфиденциальность" active={pageKey === "privacy"} />
          <LegalLink to="/legal/refund" label="Возвраты" active={pageKey === "refund"} />
          <LegalLink to="/legal/pricing" label="Каталог и цены" active={pageKey === "pricing"} />
          <LegalLink to="/legal/cookies" label="Cookies" active={pageKey === "cookies"} />
          <LegalLink to="/legal/auto-renewal" label="Автопродление" active={pageKey === "autoRenewal"} />
        </nav>

        <section className="mt-8 space-y-4">
          {pageKey === "pricing" ? <PricingCatalog /> : null}
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md md:p-6">
              <h2 className="text-2xl font-medium">{section.title}</h2>
              <div className="mt-4 space-y-3">
                {section.text.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-gray-400 md:text-base">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function PricingCatalog() {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#080808]/85 backdrop-blur-md">
      <div className="border-b border-white/10 p-5 md:p-6">
        <h2 className="text-2xl font-medium">Каталог товаров и услуг с фиксированными ценами</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-400 md:text-base">
          Оплатить онлайн на сайте можно за следующие цифровые услуги nomduchat:
        </p>
      </div>
      <div className="divide-y divide-white/10">
        {pricingCatalog.map((item) => (
          <div key={item.name} className="grid gap-4 p-5 md:grid-cols-[1.5fr_8rem_2fr] md:items-start md:p-6">
            <div>
              <div className="text-base font-medium text-white">{item.name}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.12em] text-gray-600">Цифровая услуга</div>
            </div>
            <div className="text-2xl font-semibold text-white md:text-right">{item.price}</div>
            <p className="text-sm leading-relaxed text-gray-400">{item.details}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function LegalLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        active
          ? "border-white/30 bg-white text-black"
          : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function resolvePageKey(pathname: string): LegalPageKey {
  if (pathname.includes("auto-renewal")) return "autoRenewal";
  if (pathname.includes("cookies")) return "cookies";
  if (pathname.includes("privacy")) return "privacy";
  if (pathname.includes("refund")) return "refund";
  if (pathname.includes("pricing")) return "pricing";
  return "terms";
}
