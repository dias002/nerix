import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "ru" | "kk" | "en";

export const languageOptions: Array<{ code: Language; label: string; name: string }> = [
  { code: "ru", label: "RU", name: "Русский" },
  { code: "kk", label: "KZ", name: "Қазақша" },
  { code: "en", label: "EN", name: "English" },
];

const translations = {
  ru: {
    product: "Nerix",
    nav: {
      home: "Главная",
      chat: "Чат",
      history: "История",
      agents: "Агенты",
      memory: "Память",
      balance: "Баланс",
      settings: "Настройки",
      start: "Старт",
    },
    common: {
      user: "Пользователь",
      tokens: "12,450 токенов",
      choose: "Выбрать",
      later: "Позже",
    },
    home: {
      eyebrow: "40+ ИИ-агентов под разные задачи",
      welcome: "Nerix подбирает ИИ-агента под вашу задачу",
      subtitle: "Платформа для работы, учебы, бизнеса и личных задач. Вы описываете цель, а Nerix сам помогает выбрать подходящий формат агента.",
      enter: "Войти",
      aboutProject: "О проекте",
      scroll: "Прокрутите",
      explainTitle: "Не нужно угадывать, какой агент вам нужен",
      explainText: "Nerix распределяет агентов по вашим задачам: бизнес, обучение, документы, код, идеи, продажи, контент и поддержка. Система ведет к правильному помощнику без лишнего выбора.",
      metrics: [
        { value: "40+", label: "агентов разных форматов" },
        { value: "3", label: "среды: работа, учеба, бизнес" },
        { value: "1", label: "понятный чат для всех задач" },
      ],
      servicesTitle: "Что можно делать в Nerix",
      servicesText: "Мы собираем не просто чат, а рабочую среду: готовые агенты, память, файлы, история, баланс токенов и возможность создать собственного ИИ-агента для бизнеса.",
      services: [
        { title: "Агенты под задачу", text: "Система подсказывает подходящий режим, чтобы пользователь не боялся ошибиться с выбором." },
        { title: "Среда для работы и учебы", text: "Отдельные сценарии для документов, обучения, кода, планирования, контента и анализа." },
        { title: "ИИ-агент для бизнеса", text: "Можно собрать агента под компанию: продажи, поддержка, консультации, база знаний и внутренние процессы." },
      ],
      steps: [
        { title: "Опишите задачу", text: "Напишите, что нужно сделать: учиться, продавать, анализировать, писать или автоматизировать." },
        { title: "Nerix направит к агенту", text: "Платформа подберет подходящий формат и покажет, чем он поможет." },
        { title: "Работайте в своей среде", text: "История, память, файлы и токены остаются в одном понятном пространстве." },
      ],
    },
    workspaceHome: {
      question: "Чем я могу помочь?",
      startChat: "Начать чат",
      hint: "Опишите задачу, а Nerix подскажет подходящий формат агента.",
      servicesTitle: "Популярные сценарии",
      services: [
        { title: "Работа", text: "Планы, письма, документы, аналитика и ежедневные задачи." },
        { title: "Учеба", text: "Объяснения, конспекты, тесты и подготовка к занятиям." },
        { title: "Бизнес", text: "Продажи, поддержка, база знаний и индивидуальный ИИ-агент." },
      ],
    },
    chat: {
      initial: "Привет! Я Nerix. Чем могу помочь вам сегодня?",
      model: "Nerix Pro",
      placeholder: "Сообщение...",
      disclaimer: "Nerix может допускать ошибки. Проверяйте важную информацию.",
      response: "Поняла вас. Я могу помочь с этой задачей. Дайте мне немного деталей.",
      regeneratedResponse: "Вот другой вариант ответа. Я могу раскрыть идею, сократить ее или оформить как готовый текст.",
      thinking: "Nerix печатает...",
      newChat: "Новый чат",
      attachFile: "Прикрепить файл",
      voiceInput: "Голосовой ввод",
      stopVoice: "Остановить",
      attachedFiles: "Файлы",
      favoritePromptsTitle: "Избранные промпты",
      copy: "Копировать",
      copied: "Скопировано",
      regenerate: "Новый ответ",
      suggestions: ["Составь план проекта", "Объясни простыми словами", "Помоги написать текст"],
      favoritePrompts: [
        "Сделай краткое резюме",
        "Переведи на деловой стиль",
        "Проверь логику и ошибки",
        "Составь список задач",
      ],
    },
    history: {
      title: "История чатов",
      subtitle: "Быстрый доступ к прошлым диалогам",
      newChat: "Новый чат",
      search: "Поиск по чатам...",
      pinned: "Закрепленные",
      recent: "Недавние",
      items: [
        { title: "План запуска Nerix", preview: "MVP, оплата, мобильное приложение", date: "Сегодня", agent: "Бизнес" },
        { title: "Тексты для лендинга", preview: "Короткое описание проекта и преимуществ", date: "Вчера", agent: "Общий" },
        { title: "Архитектура backend", preview: "Пользователи, токены, платежи и провайдеры", date: "2 дня назад", agent: "Код" },
        { title: "Подготовка к учебе", preview: "План объяснения сложной темы простыми словами", date: "Неделю назад", agent: "Учеба" },
      ],
    },
    agents: {
      title: "Агенты",
      subtitle: "Специализированные режимы для конкретных задач",
      profileTitle: "Профиль агента",
      profileSubtitle: "Проверьте, подходит ли режим под вашу задачу, и откройте чат.",
      strengthsTitle: "Что умеет",
      examplesTitle: "Примеры запросов",
      openChat: "Открыть чат",
      items: [
        { title: "Общий помощник", description: "Универсальный ассистент для повседневных вопросов.", strengths: ["Ответы на вопросы", "Идеи и тексты", "Быстрые объяснения"], examples: ["Объясни простыми словами", "Помоги принять решение"] },
        { title: "Бизнес", description: "Планы, письма, анализ и деловая коммуникация.", strengths: ["Планы запуска", "Письма и офферы", "Структура переговоров"], examples: ["Составь план продаж", "Напиши коммерческое письмо"] },
        { title: "Код", description: "Помощь с кодом, ошибками и архитектурой.", strengths: ["Поиск ошибок", "Архитектура", "Рефакторинг"], examples: ["Найди ошибку в коде", "Предложи структуру API"] },
        { title: "Учеба", description: "Объяснения, конспекты и подготовка к занятиям.", strengths: ["Объяснения", "Конспекты", "Проверка знаний"], examples: ["Объясни тему по шагам", "Сделай тест по теме"] },
        { title: "Документы", description: "Анализ, выжимка и редактирование текстов.", strengths: ["Краткая выжимка", "Редактирование", "Поиск рисков"], examples: ["Сделай саммари документа", "Найди спорные места"] },
      ],
    },
    balance: {
      title: "Баланс и тарифы",
      subtitle: "Контроль токенов, расходов и пополнений",
      currentBalance: "Текущий баланс",
      usage: "Расход за месяц",
      avgCost: "Средняя цена запроса",
      topUp: "Пополнить",
      packagesTitle: "Пакеты токенов",
      activityTitle: "Операции",
      packages: [
        { name: "Старт", amount: "25,000 токенов", price: "2,900 ₸", note: "Для личного использования" },
        { name: "Работа", amount: "80,000 токенов", price: "7,900 ₸", note: "Для частых задач" },
        { name: "Pro", amount: "220,000 токенов", price: "17,900 ₸", note: "Для бизнеса и команды" },
      ],
      activity: [
        { label: "Пополнение баланса", value: "+80,000", date: "Сегодня" },
        { label: "Чат с агентом Код", value: "-1,240", date: "Сегодня" },
        { label: "Анализ документа", value: "-3,800", date: "Вчера" },
      ],
    },
    memory: {
      title: "Память",
      subtitle: "То, что Nerix помнит о вас",
      search: "Поиск по памяти...",
      clear: "Очистить все",
      empty: "Ничего не найдено",
      items: [
        { text: "Предпочитает ответы на русском языке.", date: "Сегодня" },
        { text: "Использует React и Tailwind для фронтенда.", date: "Вчера" },
        { text: "Просит объяснять без сложного жаргона.", date: "3 дня назад" },
        { text: "Работает над проектом Nerix.", date: "Неделю назад" },
      ],
    },
    settings: {
      title: "Настройки",
      subtitle: "Управление аккаунтом и приложением",
      main: "Основные",
      extra: "Дополнительные",
      profile: "Профиль",
      appearance: "Внешний вид",
      notifications: "Уведомления",
      language: "Язык",
      security: "Безопасность",
    },
    download: {
      title: "Скачайте Nerix",
      text: "Продолжайте диалог на телефоне, когда приложение будет доступно.",
      ios: "iOS",
      android: "Android",
    },
    about: {
      badge: "Платформа ИИ-агентов",
      title: "Nerix создает среду, где ИИ сам подстраивается под вашу задачу",
      subtitle: "Более 40 агентов разных форматов помогают бизнесу, фрилансерам, студентам и командам. Пользователю не нужно переживать, правильно ли он выбрал агента: Nerix направляет к подходящему сценарию.",
      backHome: "На главную",
      openApp: "Открыть приложение",
      metrics: [
        { value: "40+", label: "готовых агентов" },
        { value: "24/7", label: "доступ к рабочей среде" },
        { value: "B2B", label: "создание агента под бизнес" },
      ],
      audiencesTitle: "Кому и как помогает Nerix",
      audiences: [
        { title: "Бизнесу", text: "Агенты помогают обрабатывать обращения, готовить коммерческие предложения, отвечать клиентам, обучать сотрудников и работать с базой знаний.", examples: ["AI-консультант для сайта", "Агент поддержки клиентов", "Автоматизация FAQ и продаж"] },
        { title: "Фрилансерам", text: "Nerix ускоряет подготовку текстов, брифов, идей, презентаций, расчетов и коммуникации с клиентами.", examples: ["Структура проекта", "Письмо клиенту", "Контент-план"] },
        { title: "Обучению", text: "Платформа объясняет сложные темы простым языком, делает конспекты, тесты, планы занятий и помогает закреплять материал.", examples: ["Разбор темы", "Тест по уроку", "План подготовки"] },
        { title: "Командам", text: "Можно создать общую ИИ-среду для отдела: документы, регламенты, ответы, шаблоны и внутренние помощники.", examples: ["База знаний", "Внутренний помощник", "Документы и регламенты"] },
      ],
      servicesTitle: "Услуги и возможности",
      services: [
        { title: "Готовые AI-агенты", text: "Более 40 помощников для работы, учебы, бизнеса, документов, кода, контента и ежедневных задач." },
        { title: "Подбор агента под задачу", text: "Пользователь описывает цель, а система предлагает подходящий режим и примеры запросов." },
        { title: "Создание ИИ-агента для бизнеса", text: "Разработка агента под процессы компании: консультации, продажи, поддержка, база знаний и внутренние инструкции." },
        { title: "Рабочие среды", text: "Отдельные сценарии для учебы, фриланса, отдела продаж, поддержки, документооборота и командной работы." },
        { title: "Файлы, память и история", text: "Диалоги, документы, контекст и важные факты сохраняются в одном понятном интерфейсе." },
        { title: "Будущие модули", text: "Голос, мобильное приложение, интеграции с CRM, платежи, командные аккаунты и аналитика использования." },
      ],
      sections: [
        { title: "Вы не выбираете вслепую", text: "Nerix объясняет, какой агент нужен под конкретную задачу и почему." },
        { title: "Все услуги в одном окне", text: "Чат, агенты, файлы, память, история и баланс собраны в единой архитектуре." },
        { title: "Можно расти до B2B", text: "На базе платформы можно создавать индивидуальных ИИ-агентов для бизнеса." },
      ],
    },
  },
  kk: {
    product: "Nerix",
    nav: {
      home: "Басты бет",
      chat: "Чат",
      history: "Тарих",
      agents: "Агенттер",
      memory: "Жад",
      balance: "Баланс",
      settings: "Баптаулар",
      start: "Бастау",
    },
    common: {
      user: "Пайдаланушы",
      tokens: "12,450 токен",
      choose: "Таңдау",
      later: "Кейін",
    },
    home: {
      eyebrow: "Әртүрлі тапсырмаларға арналған 40+ ИИ-агент",
      welcome: "Nerix сіздің тапсырмаңызға сай ИИ-агентті таңдайды",
      subtitle: "Жұмыс, оқу, бизнес және жеке міндеттерге арналған платформа. Мақсатыңызды сипаттаңыз, ал Nerix қажетті агент форматын табуға көмектеседі.",
      enter: "Кіру",
      aboutProject: "Жоба туралы",
      scroll: "Төмен айналдырыңыз",
      explainTitle: "Қай агент керек екенін болжаудың қажеті жоқ",
      explainText: "Nerix агенттерді тапсырмаңыз бойынша бөледі: бизнес, оқу, құжаттар, код, идеялар, сатылым, контент және қолдау. Жүйе дұрыс көмекшіге артық таңдаусыз жеткізеді.",
      metrics: [
        { value: "40+", label: "әртүрлі форматтағы агент" },
        { value: "3", label: "орта: жұмыс, оқу, бизнес" },
        { value: "1", label: "барлық тапсырмаға түсінікті чат" },
      ],
      servicesTitle: "Nerix ішінде не істеуге болады",
      servicesText: "Біз жай чат емес, жұмыс ортасын құрамыз: дайын агенттер, жад, файлдар, тарих, токен балансы және бизнеске жеке ИИ-агент жасау мүмкіндігі.",
      services: [
        { title: "Тапсырмаға сай агенттер", text: "Жүйе пайдаланушы дұрыс таңдадым ба деп алаңдамауы үшін лайықты режимді ұсынады." },
        { title: "Жұмыс пен оқу ортасы", text: "Құжат, оқу, код, жоспарлау, контент және талдау үшін бөлек сценарийлер." },
        { title: "Бизнеске ИИ-агент", text: "Компанияға арналған агент жасауға болады: сатылым, қолдау, кеңес беру, база және ішкі процестер." },
      ],
      steps: [
        { title: "Тапсырманы сипаттаңыз", text: "Не істеу керек екенін жазыңыз: оқу, сату, талдау, мәтін жазу немесе автоматтандыру." },
        { title: "Nerix агентке бағыттайды", text: "Платформа лайықты форматты таңдап, оның қалай көмектесетінін көрсетеді." },
        { title: "Өз ортаңызда жұмыс істеңіз", text: "Тарих, жад, файлдар және токендер бір түсінікті кеңістікте қалады." },
      ],
    },
    workspaceHome: {
      question: "Қалай көмектесе аламын?",
      startChat: "Чатты бастау",
      hint: "Тапсырманы сипаттаңыз, ал Nerix лайықты агент форматын ұсынады.",
      servicesTitle: "Танымал сценарийлер",
      services: [
        { title: "Жұмыс", text: "Жоспарлар, хаттар, құжаттар, аналитика және күнделікті тапсырмалар." },
        { title: "Оқу", text: "Түсіндіру, конспект, тест және сабаққа дайындық." },
        { title: "Бизнес", text: "Сатылым, қолдау, білім базасы және жеке ИИ-агент." },
      ],
    },
    chat: {
      initial: "Сәлем! Мен Nerix. Бүгін сізге қалай көмектесейін?",
      model: "Nerix Pro",
      placeholder: "Хабарлама...",
      disclaimer: "Nerix қателесуі мүмкін. Маңызды ақпаратты тексеріңіз.",
      response: "Түсіндім. Бұл тапсырмаға көмектесе аламын. Маған аздап мәлімет беріңіз.",
      regeneratedResponse: "Міне, жауаптың басқа нұсқасы. Оны кеңейтіп, қысқартып немесе дайын мәтінге айналдыра аламын.",
      thinking: "Nerix жазып жатыр...",
      newChat: "Жаңа чат",
      attachFile: "Файл тіркеу",
      voiceInput: "Дауыспен енгізу",
      stopVoice: "Тоқтату",
      attachedFiles: "Файлдар",
      favoritePromptsTitle: "Таңдаулы промпттар",
      copy: "Көшіру",
      copied: "Көшірілді",
      regenerate: "Жаңа жауап",
      suggestions: ["Жоба жоспарын құр", "Қарапайым тілмен түсіндір", "Мәтін жазуға көмектес"],
      favoritePrompts: [
        "Қысқаша түйін жаса",
        "Іскерлік стильге ауыстыр",
        "Логика мен қатені тексер",
        "Тапсырмалар тізімін құр",
      ],
    },
    history: {
      title: "Чат тарихы",
      subtitle: "Өткен диалогтарға жылдам кіру",
      newChat: "Жаңа чат",
      search: "Чаттардан іздеу...",
      pinned: "Бекітілген",
      recent: "Соңғылар",
      items: [
        { title: "Nerix іске қосу жоспары", preview: "MVP, төлем, мобильді қолданба", date: "Бүгін", agent: "Бизнес" },
        { title: "Лендинг мәтіндері", preview: "Жоба мен артықшылықтардың қысқа сипаттамасы", date: "Кеше", agent: "Жалпы" },
        { title: "Backend архитектурасы", preview: "Пайдаланушылар, токендер, төлемдер және провайдерлер", date: "2 күн бұрын", agent: "Код" },
        { title: "Оқуға дайындық", preview: "Күрделі тақырыпты қарапайым түсіндіру жоспары", date: "Бір апта бұрын", agent: "Оқу" },
      ],
    },
    agents: {
      title: "Агенттер",
      subtitle: "Нақты тапсырмаларға арналған арнайы режимдер",
      profileTitle: "Агент профилі",
      profileSubtitle: "Режим тапсырмаңызға сай келе ме, тексеріп, чатты ашыңыз.",
      strengthsTitle: "Не істей алады",
      examplesTitle: "Сұрау мысалдары",
      openChat: "Чатты ашу",
      items: [
        { title: "Жалпы көмекші", description: "Күнделікті сұрақтарға арналған әмбебап ассистент.", strengths: ["Сұрақтарға жауап", "Идеялар мен мәтіндер", "Жылдам түсіндіру"], examples: ["Қарапайым тілмен түсіндір", "Шешім қабылдауға көмектес"] },
        { title: "Бизнес", description: "Жоспарлар, хаттар, талдау және іскерлік байланыс.", strengths: ["Іске қосу жоспары", "Хаттар мен ұсыныстар", "Келіссөз құрылымы"], examples: ["Сату жоспарын құр", "Коммерциялық хат жаз"] },
        { title: "Код", description: "Код, қате табу және архитектура бойынша көмек.", strengths: ["Қате табу", "Архитектура", "Рефакторинг"], examples: ["Кодтағы қатені тап", "API құрылымын ұсын"] },
        { title: "Оқу", description: "Түсіндіру, конспект және сабаққа дайындық.", strengths: ["Түсіндіру", "Конспект", "Білімді тексеру"], examples: ["Тақырыпты қадамдап түсіндір", "Тақырып бойынша тест жаса"] },
        { title: "Құжаттар", description: "Мәтіндерді талдау, қысқарту және өңдеу.", strengths: ["Қысқаша түйін", "Өңдеу", "Тәуекелдерді табу"], examples: ["Құжаттың саммариін жаса", "Даулы жерлерді тап"] },
      ],
    },
    balance: {
      title: "Баланс және тарифтер",
      subtitle: "Токендер, шығындар және толықтыруларды бақылау",
      currentBalance: "Ағымдағы баланс",
      usage: "Айлық шығын",
      avgCost: "Сұраудың орташа бағасы",
      topUp: "Толтыру",
      packagesTitle: "Токен пакеттері",
      activityTitle: "Операциялар",
      packages: [
        { name: "Бастау", amount: "25,000 токен", price: "2,900 ₸", note: "Жеке қолдану үшін" },
        { name: "Жұмыс", amount: "80,000 токен", price: "7,900 ₸", note: "Жиі тапсырмалар үшін" },
        { name: "Pro", amount: "220,000 токен", price: "17,900 ₸", note: "Бизнес және команда үшін" },
      ],
      activity: [
        { label: "Баланс толықтыру", value: "+80,000", date: "Бүгін" },
        { label: "Код агентімен чат", value: "-1,240", date: "Бүгін" },
        { label: "Құжат талдау", value: "-3,800", date: "Кеше" },
      ],
    },
    memory: {
      title: "Жад",
      subtitle: "Nerix сіз туралы есте сақтайтын ақпарат",
      search: "Жадтан іздеу...",
      clear: "Барлығын өшіру",
      empty: "Ештеңе табылмады",
      items: [
        { text: "Жауаптарды қазақ немесе орыс тілінде алғысы келеді.", date: "Бүгін" },
        { text: "Фронтенд үшін React және Tailwind қолданады.", date: "Кеше" },
        { text: "Күрделі терминдерсіз түсіндіруді сұрайды.", date: "3 күн бұрын" },
        { text: "Nerix жобасымен жұмыс істеп жатыр.", date: "Бір апта бұрын" },
      ],
    },
    settings: {
      title: "Баптаулар",
      subtitle: "Аккаунт пен қолданбаны басқару",
      main: "Негізгі",
      extra: "Қосымша",
      profile: "Профиль",
      appearance: "Сыртқы көрініс",
      notifications: "Хабарламалар",
      language: "Тіл",
      security: "Қауіпсіздік",
    },
    download: {
      title: "Nerix-ті жүктеп алыңыз",
      text: "Қолданба дайын болғанда, диалогты телефонда жалғастырыңыз.",
      ios: "iOS",
      android: "Android",
    },
    about: {
      badge: "ИИ-агенттер платформасы",
      title: "Nerix ИИ сіздің тапсырмаңызға бейімделетін орта жасайды",
      subtitle: "Әртүрлі форматтағы 40+ агент бизнеске, фрилансерлерге, студенттерге және командаларға көмектеседі. Пайдаланушы дұрыс агент таңдадым ба деп уайымдамайды: Nerix лайықты сценарийге бағыттайды.",
      backHome: "Басты бетке",
      openApp: "Қолданбаны ашу",
      metrics: [
        { value: "40+", label: "дайын агент" },
        { value: "24/7", label: "жұмыс ортасына қолжетімділік" },
        { value: "B2B", label: "бизнеске жеке агент жасау" },
      ],
      audiencesTitle: "Nerix кімге және қалай көмектеседі",
      audiences: [
        { title: "Бизнеске", text: "Агенттер өтініштерді өңдеуге, коммерциялық ұсыныс дайындауға, клиенттерге жауап беруге, қызметкерлерді оқытуға және білім базасымен жұмыс істеуге көмектеседі.", examples: ["Сайтқа AI-кеңесші", "Клиент қолдау агенті", "FAQ және сатылым автоматтандыру"] },
        { title: "Фрилансерлерге", text: "Nerix мәтін, бриф, идея, презентация, есеп және клиентпен коммуникацияны тездетеді.", examples: ["Жоба құрылымы", "Клиентке хат", "Контент-жоспар"] },
        { title: "Оқуға", text: "Платформа күрделі тақырыптарды қарапайым түсіндіреді, конспект, тест, сабақ жоспарын жасап, материалды бекітуге көмектеседі.", examples: ["Тақырыпты талдау", "Сабақ бойынша тест", "Дайындық жоспары"] },
        { title: "Командаларға", text: "Бөлімге ортақ ИИ-орта жасауға болады: құжаттар, регламенттер, жауаптар, шаблондар және ішкі көмекшілер.", examples: ["Білім базасы", "Ішкі көмекші", "Құжаттар мен регламенттер"] },
      ],
      servicesTitle: "Қызметтер мен мүмкіндіктер",
      services: [
        { title: "Дайын AI-агенттер", text: "Жұмыс, оқу, бизнес, құжаттар, код, контент және күнделікті тапсырмаларға арналған 40+ көмекші." },
        { title: "Тапсырмаға агент таңдау", text: "Пайдаланушы мақсатын сипаттайды, ал жүйе лайықты режим мен сұрау мысалдарын ұсынады." },
        { title: "Бизнеске ИИ-агент жасау", text: "Компания процестеріне арналған агент: кеңес беру, сатылым, қолдау, білім базасы және ішкі нұсқаулықтар." },
        { title: "Жұмыс орталары", text: "Оқу, фриланс, сатылым бөлімі, қолдау, құжат айналымы және командалық жұмыс сценарийлері." },
        { title: "Файлдар, жад және тарих", text: "Диалогтар, құжаттар, контекст және маңызды фактілер бір интерфейсте сақталады." },
        { title: "Болашақ модульдер", text: "Дауыс, мобильді қолданба, CRM интеграциялары, төлемдер, командалық аккаунттар және пайдалану аналитикасы." },
      ],
      sections: [
        { title: "Соқыр таңдау жоқ", text: "Nerix нақты тапсырмаға қандай агент керек екенін және себебін түсіндіреді." },
        { title: "Барлық қызмет бір терезеде", text: "Чат, агенттер, файлдар, жад, тарих және баланс бір архитектурада жиналған." },
        { title: "B2B-ға дейін өсуге болады", text: "Платформа негізінде бизнеске жеке ИИ-агенттер жасауға болады." },
      ],
    },
  },
  en: {
    product: "Nerix",
    nav: {
      home: "Home",
      chat: "Chat",
      history: "History",
      agents: "Agents",
      memory: "Memory",
      balance: "Balance",
      settings: "Settings",
      start: "Start",
    },
    common: {
      user: "User",
      tokens: "12,450 tokens",
      choose: "Choose",
      later: "Later",
    },
    home: {
      eyebrow: "40+ AI agents for different task formats",
      welcome: "Nerix matches the right AI agent to your task",
      subtitle: "A platform for work, study, business, and personal tasks. Describe your goal, and Nerix helps choose the right agent format.",
      enter: "Enter",
      aboutProject: "About project",
      scroll: "Scroll",
      explainTitle: "You do not need to guess which agent you need",
      explainText: "Nerix organizes agents around your task: business, study, documents, code, ideas, sales, content, and support. The system guides you to the right assistant without extra choices.",
      metrics: [
        { value: "40+", label: "agents in different formats" },
        { value: "3", label: "spaces: work, study, business" },
        { value: "1", label: "clear chat for every task" },
      ],
      servicesTitle: "What you can do in Nerix",
      servicesText: "We are building more than a chat: ready agents, memory, files, history, token balance, and the ability to create a custom AI agent for business.",
      services: [
        { title: "Task-based agents", text: "The system suggests the right mode so users do not worry about choosing incorrectly." },
        { title: "Work and study space", text: "Separate scenarios for documents, learning, code, planning, content, and analysis." },
        { title: "AI agent for business", text: "A company can get its own agent for sales, support, consulting, knowledge base, and internal workflows." },
      ],
      steps: [
        { title: "Describe the task", text: "Write what you need: study, sell, analyze, write, or automate." },
        { title: "Nerix routes you to an agent", text: "The platform picks the right format and shows how it can help." },
        { title: "Work in your own space", text: "History, memory, files, and tokens stay in one clear environment." },
      ],
    },
    workspaceHome: {
      question: "How can I help?",
      startChat: "Start chat",
      hint: "Describe the task, and Nerix will suggest the right agent format.",
      servicesTitle: "Popular scenarios",
      services: [
        { title: "Work", text: "Plans, emails, documents, analytics, and daily tasks." },
        { title: "Study", text: "Explanations, notes, quizzes, and lesson preparation." },
        { title: "Business", text: "Sales, support, knowledge base, and a custom AI agent." },
      ],
    },
    chat: {
      initial: "Hi, I am Nerix. How can I help today?",
      model: "Nerix Pro",
      placeholder: "Message...",
      disclaimer: "Nerix can make mistakes. Check important information.",
      response: "Got it. I can help with this task. Give me a little more detail.",
      regeneratedResponse: "Here is another version. I can expand it, shorten it, or turn it into a polished draft.",
      thinking: "Nerix is typing...",
      newChat: "New chat",
      attachFile: "Attach file",
      voiceInput: "Voice input",
      stopVoice: "Stop",
      attachedFiles: "Files",
      favoritePromptsTitle: "Favorite prompts",
      copy: "Copy",
      copied: "Copied",
      regenerate: "New answer",
      suggestions: ["Create a project plan", "Explain in simple words", "Help me write text"],
      favoritePrompts: [
        "Create a short summary",
        "Rewrite in business style",
        "Check logic and mistakes",
        "Create a task list",
      ],
    },
    history: {
      title: "Chat history",
      subtitle: "Quick access to previous conversations",
      newChat: "New chat",
      search: "Search chats...",
      pinned: "Pinned",
      recent: "Recent",
      items: [
        { title: "Nerix launch plan", preview: "MVP, payments, mobile app", date: "Today", agent: "Business" },
        { title: "Landing page copy", preview: "Short project and benefits description", date: "Yesterday", agent: "General" },
        { title: "Backend architecture", preview: "Users, tokens, payments, and providers", date: "2 days ago", agent: "Code" },
        { title: "Study preparation", preview: "Plan for explaining a difficult topic simply", date: "A week ago", agent: "Study" },
      ],
    },
    agents: {
      title: "Agents",
      subtitle: "Specialized modes for specific tasks",
      profileTitle: "Agent profile",
      profileSubtitle: "Check whether this mode fits your task, then open the chat.",
      strengthsTitle: "Strengths",
      examplesTitle: "Example prompts",
      openChat: "Open chat",
      items: [
        { title: "General assistant", description: "A universal assistant for everyday questions.", strengths: ["Answer questions", "Ideas and writing", "Quick explanations"], examples: ["Explain in simple words", "Help me make a decision"] },
        { title: "Business", description: "Plans, emails, analysis, and professional communication.", strengths: ["Launch plans", "Emails and offers", "Negotiation structure"], examples: ["Create a sales plan", "Write a commercial email"] },
        { title: "Code", description: "Help with code, bugs, and architecture.", strengths: ["Bug search", "Architecture", "Refactoring"], examples: ["Find the bug in this code", "Suggest an API structure"] },
        { title: "Study", description: "Explanations, notes, and lesson preparation.", strengths: ["Explanations", "Notes", "Knowledge checks"], examples: ["Explain the topic step by step", "Create a quiz on this topic"] },
        { title: "Documents", description: "Analyze, summarize, and edit long texts.", strengths: ["Short summaries", "Editing", "Risk spotting"], examples: ["Summarize the document", "Find questionable parts"] },
      ],
    },
    balance: {
      title: "Balance and plans",
      subtitle: "Control tokens, usage, and top-ups",
      currentBalance: "Current balance",
      usage: "Monthly usage",
      avgCost: "Average request cost",
      topUp: "Top up",
      packagesTitle: "Token packages",
      activityTitle: "Activity",
      packages: [
        { name: "Start", amount: "25,000 tokens", price: "2,900 ₸", note: "For personal use" },
        { name: "Work", amount: "80,000 tokens", price: "7,900 ₸", note: "For frequent tasks" },
        { name: "Pro", amount: "220,000 tokens", price: "17,900 ₸", note: "For business and teams" },
      ],
      activity: [
        { label: "Balance top-up", value: "+80,000", date: "Today" },
        { label: "Code agent chat", value: "-1,240", date: "Today" },
        { label: "Document analysis", value: "-3,800", date: "Yesterday" },
      ],
    },
    memory: {
      title: "Memory",
      subtitle: "What Nerix remembers about you",
      search: "Search memory...",
      clear: "Clear all",
      empty: "Nothing found",
      items: [
        { text: "Prefers concise answers in English or Russian.", date: "Today" },
        { text: "Uses React and Tailwind for frontend work.", date: "Yesterday" },
        { text: "Asks for explanations without heavy jargon.", date: "3 days ago" },
        { text: "Works on the Nerix project.", date: "A week ago" },
      ],
    },
    settings: {
      title: "Settings",
      subtitle: "Manage account and app preferences",
      main: "Main",
      extra: "Advanced",
      profile: "Profile",
      appearance: "Appearance",
      notifications: "Notifications",
      language: "Language",
      security: "Security",
    },
    download: {
      title: "Download Nerix",
      text: "Continue conversations on your phone when the app is available.",
      ios: "iOS",
      android: "Android",
    },
    about: {
      badge: "AI agent platform",
      title: "Nerix creates an environment where AI adapts to your task",
      subtitle: "More than 40 agents in different formats help businesses, freelancers, students, and teams. Users do not need to worry about picking the right agent: Nerix routes them to the right scenario.",
      backHome: "Back home",
      openApp: "Open app",
      metrics: [
        { value: "40+", label: "ready agents" },
        { value: "24/7", label: "access to the workspace" },
        { value: "B2B", label: "custom business agent creation" },
      ],
      audiencesTitle: "Who Nerix helps",
      audiences: [
        { title: "Businesses", text: "Agents help process requests, prepare commercial offers, answer customers, train employees, and work with a knowledge base.", examples: ["AI consultant for a website", "Customer support agent", "FAQ and sales automation"] },
        { title: "Freelancers", text: "Nerix speeds up texts, briefs, ideas, presentations, estimates, and client communication.", examples: ["Project structure", "Client email", "Content plan"] },
        { title: "Learning", text: "The platform explains complex topics simply, creates notes, quizzes, lesson plans, and helps reinforce material.", examples: ["Topic breakdown", "Lesson quiz", "Preparation plan"] },
        { title: "Teams", text: "Teams can build a shared AI environment for documents, rules, answers, templates, and internal assistants.", examples: ["Knowledge base", "Internal assistant", "Documents and rules"] },
      ],
      servicesTitle: "Services and capabilities",
      services: [
        { title: "Ready AI agents", text: "More than 40 assistants for work, study, business, documents, code, content, and daily tasks." },
        { title: "Agent routing by task", text: "The user describes a goal, and the system suggests the right mode and example prompts." },
        { title: "Custom AI agent for business", text: "Agent development for company workflows: consulting, sales, support, knowledge base, and internal instructions." },
        { title: "Workspaces", text: "Separate scenarios for study, freelance work, sales teams, support, document flow, and team collaboration." },
        { title: "Files, memory, and history", text: "Conversations, documents, context, and important facts stay in one clear interface." },
        { title: "Future modules", text: "Voice, mobile app, CRM integrations, payments, team accounts, and usage analytics." },
      ],
      sections: [
        { title: "No blind choice", text: "Nerix explains which agent fits a specific task and why." },
        { title: "All services in one place", text: "Chat, agents, files, memory, history, and balance are connected in one architecture." },
        { title: "Ready to grow into B2B", text: "The platform can be used to create custom AI agents for businesses." },
      ],
    },
  },
} as const;

type Dictionary = (typeof translations)[Language];

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const storageKey = "nerix-language";

function isLanguage(value: string | null): value is Language {
  return value === "ru" || value === "kk" || value === "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "ru";
    const saved = window.localStorage.getItem(storageKey);
    return isLanguage(saved) ? saved : "ru";
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, language);
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: translations[language],
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
