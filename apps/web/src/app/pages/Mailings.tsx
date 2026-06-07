import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Upload,
  Users,
} from "lucide-react";
import {
  createMailingAudience,
  createMailingCampaign,
  getMailingAudiences,
  getMailingCampaigns,
  getMailingContacts,
  getMailingRecipients,
  importMailingContacts,
  sendMailingCampaign,
  syncMailingCampaign,
  type MailingAudienceApiRecord,
  type MailingCampaignApiRecord,
  type MailingContactApiRecord,
  type MailingRecipientApiRecord,
} from "../api";

type CampaignForm = {
  name: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

const defaultCampaignForm: CampaignForm = {
  name: "",
  fromEmail: "",
  fromName: "",
  replyTo: "",
  subject: "",
  html: "",
  text: "",
};

const fieldInputClass =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25";

export default function Mailings() {
  const [audiences, setAudiences] = useState<MailingAudienceApiRecord[]>([]);
  const [contacts, setContacts] = useState<MailingContactApiRecord[]>([]);
  const [campaigns, setCampaigns] = useState<MailingCampaignApiRecord[]>([]);
  const [recipients, setRecipients] = useState<MailingRecipientApiRecord[]>([]);
  const [selectedAudienceId, setSelectedAudienceId] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [audienceName, setAudienceName] = useState("");
  const [rawContacts, setRawContacts] = useState("");
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(defaultCampaignForm);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedAudience = audiences.find((audience) => audience.id === selectedAudienceId) ?? null;
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null;

  const stats = useMemo(() => {
    const totalContacts = audiences.reduce((total, audience) => total + audience.contactsCount, 0);
    const activeContacts = audiences.reduce((total, audience) => total + audience.activeContactsCount, 0);
    const sent = campaigns.reduce((total, campaign) => total + campaign.sentCount, 0);
    const opened = campaigns.reduce((total, campaign) => total + campaign.openedCount, 0);
    const unsubscribed = campaigns.reduce((total, campaign) => total + campaign.unsubscribedCount, 0);

    return [
      { label: "Активные контакты", value: formatNumber(activeContacts), icon: Users },
      { label: "Всего в базах", value: formatNumber(totalContacts), icon: Database },
      { label: "Отправлено", value: formatNumber(sent), icon: Send },
      { label: "Открытия", value: formatNumber(opened), icon: Eye },
      { label: "Отписки", value: formatNumber(unsubscribed), icon: Ban },
    ];
  }, [audiences, campaigns]);

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!selectedAudienceId) {
      setContacts([]);
      return;
    }

    let active = true;
    getMailingContacts(selectedAudienceId)
      .then((response) => {
        if (active) setContacts(response.contacts);
      })
      .catch(() => {
        if (active) setContacts([]);
      });

    return () => {
      active = false;
    };
  }, [selectedAudienceId]);

  useEffect(() => {
    if (!selectedCampaign?.id) {
      setRecipients([]);
      return;
    }

    let active = true;
    getMailingRecipients(selectedCampaign.id)
      .then((response) => {
        if (active) setRecipients(response.recipients);
      })
      .catch(() => {
        if (active) setRecipients([]);
      });

    return () => {
      active = false;
    };
  }, [selectedCampaign?.id]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const [audiencesResponse, campaignsResponse] = await Promise.all([
        getMailingAudiences(),
        getMailingCampaigns(),
      ]);
      setAudiences(audiencesResponse.audiences);
      setCampaigns(campaignsResponse.campaigns);
      setSelectedAudienceId((current) => current || audiencesResponse.audiences[0]?.id || "");
      setSelectedCampaignId((current) => current || campaignsResponse.campaigns[0]?.id || "");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAudience = async () => {
    if (!audienceName.trim()) return;
    await runAction("audience", async () => {
      const response = await createMailingAudience({ name: audienceName });
      setNotice(`База "${response.audience.name}" готова.`);
      setSelectedAudienceId(response.audience.id);
      setAudienceName("");
      await loadDashboard();
    });
  };

  const handleImportContacts = async () => {
    if (!selectedAudienceId || !rawContacts.trim()) return;
    await runAction("import", async () => {
      const response = await importMailingContacts({
        audienceId: selectedAudienceId,
        rawContacts,
      });
      setNotice(
        `Импортировано: ${response.summary.imported}, обновлено: ${response.summary.updated}, активных: ${response.summary.totalActiveContacts}.`
      );
      setRawContacts("");
      await loadDashboard();
    });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setRawContacts((current) => `${current}${current ? "\n" : ""}${text}`);
  };

  const handleCreateCampaign = async () => {
    if (!selectedAudienceId) return;
    await runAction("campaign", async () => {
      const response = await createMailingCampaign({
        audienceId: selectedAudienceId,
        ...campaignForm,
      });
      setNotice(`Кампания "${response.campaign.name}" создана.`);
      setSelectedCampaignId(response.campaign.id);
      setCampaignForm((current) => ({
        ...current,
        name: "",
        subject: "",
      }));
      await loadDashboard();
    });
  };

  const handleSendCampaign = async (campaignId: string) => {
    await runAction(`send-${campaignId}`, async () => {
      const response = await sendMailingCampaign(campaignId);
      setNotice(`Отправка запущена: ${response.accepted} писем принято SMTP.BZ.`);
      setSelectedCampaignId(response.campaign.id);
      await loadDashboard();
    });
  };

  const handleSyncCampaign = async (campaignId: string) => {
    await runAction(`sync-${campaignId}`, async () => {
      const response = await syncMailingCampaign(campaignId);
      setNotice(
        `Синхронизация: обновлено ${response.updatedRecipients}, открытий ${response.opened}, отписок ${response.unsubscribed}.`
      );
      setSelectedCampaignId(response.campaign.id);
      await loadDashboard();
    });
  };

  const runAction = async (action: string, callback: () => Promise<void>) => {
    setBusyAction(action);
    setError(null);
    setNotice(null);

    try {
      await callback();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-5 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
              <Mail className="h-5 w-5" strokeWidth={1.6} />
            </div>
            <h2 className="text-2xl font-medium text-white">Рассылки</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
              Панель для баз контактов, массовых писем через SMTP.BZ и синхронизации статусов, открытий и отписок.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.7} />
            Обновить
          </button>
        </header>

        {notice ? (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>{notice}</span>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.04 }}
              className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                <stat.icon className="h-4 w-4" strokeWidth={1.7} />
              </div>
              <div className="text-2xl font-medium text-white">{stat.value}</div>
              <div className="mt-1 text-xs text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium text-white">Базы контактов</h3>
                  <p className="mt-1 text-sm text-gray-500">Отдельно для учебного центра, агрегатора и других проектов.</p>
                </div>
                <Users className="h-5 w-5 text-gray-500" strokeWidth={1.6} />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={audienceName}
                  onChange={(event) => setAudienceName(event.target.value)}
                  placeholder="Название базы"
                  className="min-h-11 flex-1 rounded-xl border border-white/10 bg-black px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-white/25"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateAudience()}
                  disabled={busyAction === "audience" || !audienceName.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.8} />
                  Создать
                </button>
              </div>

              <div className="mt-5 space-y-2">
                {audiences.length > 0 ? (
                  audiences.map((audience) => (
                    <button
                      key={audience.id}
                      type="button"
                      onClick={() => setSelectedAudienceId(audience.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        selectedAudienceId === audience.id
                          ? "border-white/20 bg-white/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20"
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-medium text-white">{audience.name}</span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {formatNumber(audience.activeContactsCount)} активных из {formatNumber(audience.contactsCount)}
                        </span>
                      </span>
                      <Database className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.7} />
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500">
                    Создайте первую базу, затем загрузите CSV или список email.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium text-white">Импорт базы</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Принимаются строки CSV, Excel-экспорт в тексте или список email по одному на строку.
                  </p>
                </div>
                <Upload className="h-5 w-5 text-gray-500" strokeWidth={1.6} />
              </div>

              <label className="mb-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 text-sm text-gray-400 transition-colors hover:border-white/25 hover:text-white">
                <Upload className="h-4 w-4" strokeWidth={1.7} />
                Загрузить CSV/TXT
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
              </label>

              <textarea
                value={rawContacts}
                onChange={(event) => setRawContacts(event.target.value)}
                placeholder={"Иван Иванов, ivan@example.com\nmanager@example.com"}
                className="min-h-44 w-full resize-y rounded-xl border border-white/10 bg-black p-4 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
              />

              <button
                type="button"
                onClick={() => void handleImportContacts()}
                disabled={busyAction === "import" || !selectedAudienceId || !rawContacts.trim()}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" strokeWidth={1.8} />
                Импортировать в {selectedAudience?.name ?? "базу"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-medium text-white">Новое письмо</h3>
                <p className="mt-1 text-sm text-gray-500">SMTP.BZ получит HTML, тему, отправителя и массив адресов выбранной базы.</p>
              </div>
              <FileText className="h-5 w-5 text-gray-500" strokeWidth={1.6} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Название кампании">
                <input
                  value={campaignForm.name}
                  onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })}
                  className={fieldInputClass}
                />
              </Field>
              <Field label="База">
                <select
                  value={selectedAudienceId}
                  onChange={(event) => setSelectedAudienceId(event.target.value)}
                  className={fieldInputClass}
                >
                  <option value="">Выберите базу</option>
                  {audiences.map((audience) => (
                    <option key={audience.id} value={audience.id}>
                      {audience.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Email отправителя">
                <input
                  value={campaignForm.fromEmail}
                  onChange={(event) => setCampaignForm({ ...campaignForm, fromEmail: event.target.value })}
                  placeholder="info@example.com"
                  className={fieldInputClass}
                />
              </Field>
              <Field label="Имя отправителя">
                <input
                  value={campaignForm.fromName}
                  onChange={(event) => setCampaignForm({ ...campaignForm, fromName: event.target.value })}
                  className={fieldInputClass}
                />
              </Field>
              <Field label="Email для ответа">
                <input
                  value={campaignForm.replyTo}
                  onChange={(event) => setCampaignForm({ ...campaignForm, replyTo: event.target.value })}
                  placeholder="support@example.com"
                  className={fieldInputClass}
                />
              </Field>
              <Field label="Тема письма">
                <input
                  value={campaignForm.subject}
                  onChange={(event) => setCampaignForm({ ...campaignForm, subject: event.target.value })}
                  className={fieldInputClass}
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="HTML письма">
                <textarea
                  value={campaignForm.html}
                  onChange={(event) => setCampaignForm({ ...campaignForm, html: event.target.value })}
                  className="min-h-48 w-full resize-y rounded-xl border border-white/10 bg-black p-4 font-mono text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Текстовая версия">
                <textarea
                  value={campaignForm.text}
                  onChange={(event) => setCampaignForm({ ...campaignForm, text: event.target.value })}
                  placeholder="Короткая TXT-версия письма"
                  className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black p-4 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={() => void handleCreateCampaign()}
              disabled={
                busyAction === "campaign" ||
                !selectedAudienceId ||
                !campaignForm.name.trim() ||
                !campaignForm.fromEmail.trim() ||
                !campaignForm.subject.trim() ||
                !campaignForm.html.trim()
              }
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
            >
              <FileText className="h-4 w-4" strokeWidth={1.8} />
              Создать кампанию
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.95fr]">
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-medium text-white">Кампании</h3>
                <p className="mt-1 text-sm text-gray-500">Отправка, синхронизация и быстрые показатели по каждой рассылке.</p>
              </div>
              <Mail className="h-5 w-5 text-gray-500" strokeWidth={1.6} />
            </div>

            <div className="space-y-3">
              {campaigns.length > 0 ? (
                campaigns.map((campaign) => (
                  <article
                    key={campaign.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      selectedCampaign?.id === campaign.id ? "border-white/20 bg-white/10" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCampaignId(campaign.id)}
                      className="w-full text-left"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-medium text-white">{campaign.name}</h4>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-400">
                              {statusLabel(campaign.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            {campaign.audienceName} · {campaign.subject}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-right text-xs text-gray-500">
                          <span>{formatNumber(campaign.sentCount)} sent</span>
                          <span>{formatNumber(campaign.openedCount)} open</span>
                          <span>{formatNumber(campaign.unsubscribedCount)} unsub</span>
                        </div>
                      </div>
                    </button>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void handleSendCampaign(campaign.id)}
                        disabled={busyAction === `send-${campaign.id}` || campaign.status === "sending"}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" strokeWidth={1.8} />
                        Отправить
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSyncCampaign(campaign.id)}
                        disabled={busyAction === `sync-${campaign.id}`}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${busyAction === `sync-${campaign.id}` ? "animate-spin" : ""}`}
                          strokeWidth={1.8}
                        />
                        Синхронизировать
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500">
                  Пока нет кампаний. Создайте письмо справа и отправьте его по выбранной базе.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium text-white">Получатели</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedCampaign ? selectedCampaign.name : "Выберите кампанию"}
                  </p>
                </div>
                <Users className="h-5 w-5 text-gray-500" strokeWidth={1.6} />
              </div>

              <div className="max-h-[440px] overflow-y-auto rounded-xl border border-white/10">
                {recipients.length > 0 ? (
                  recipients.map((recipient, index) => (
                    <div
                      key={recipient.id}
                      className={`grid grid-cols-[1fr_auto] gap-3 p-3 ${
                        index !== recipients.length - 1 ? "border-b border-white/5" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white">{recipient.email}</div>
                        <div className="mt-1 truncate text-xs text-gray-600">{recipient.name || "Без имени"}</div>
                      </div>
                      <span className="h-fit rounded-full border border-white/10 px-2 py-1 text-xs text-gray-400">
                        {recipientStatusLabel(recipient.status)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-sm text-gray-500">
                    Получатели появятся после запуска кампании.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
              <h3 className="text-lg font-medium text-white">Контакты выбранной базы</h3>
              <p className="mt-1 text-sm text-gray-500">{selectedAudience?.name ?? "База не выбрана"}</p>
              <div className="mt-4 max-h-[260px] overflow-y-auto rounded-xl border border-white/10">
                {contacts.length > 0 ? (
                  contacts.slice(0, 80).map((contact, index) => (
                    <div
                      key={contact.id}
                      className={`grid grid-cols-[1fr_auto] gap-3 p-3 ${
                        index !== contacts.slice(0, 80).length - 1 ? "border-b border-white/5" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white">{contact.email}</div>
                        <div className="mt-1 truncate text-xs text-gray-600">{contact.name || "Без имени"}</div>
                      </div>
                      <span className="h-fit rounded-full border border-white/10 px-2 py-1 text-xs text-gray-400">
                        {contact.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-sm text-gray-500">В выбранной базе пока нет контактов.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function statusLabel(status: MailingCampaignApiRecord["status"]) {
  const labels: Record<MailingCampaignApiRecord["status"], string> = {
    draft: "Черновик",
    sending: "Отправка",
    sent: "Отправлено",
    failed: "Ошибка",
  };
  return labels[status];
}

function recipientStatusLabel(status: MailingRecipientApiRecord["status"]) {
  const labels: Record<MailingRecipientApiRecord["status"], string> = {
    queued: "В очереди",
    sent: "Отправлено",
    opened: "Открыто",
    bounced: "Bounce",
    unsubscribed: "Отписка",
    failed: "Ошибка",
  };
  return labels[status];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Не удалось выполнить действие.";
}
