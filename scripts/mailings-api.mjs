#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const action = readEnv("NOMDUCHAT_MAILING_ACTION", "help");
const apiUrl = trimTrailingSlash(readEnv("NOMDUCHAT_API_URL", ""));
const accessToken = readEnv("NOMDUCHAT_MAILINGS_API_TOKEN", "") || readEnv("NOMDUCHAT_ADMIN_ACCESS_TOKEN", "");
const dryRun = readBooleanEnv("NOMDUCHAT_MAILING_DRY_RUN", false);

if (action === "help" || process.argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

if (!dryRun) {
  if (!apiUrl) fail("NOMDUCHAT_API_URL is required.");
  if (!accessToken) fail("NOMDUCHAT_MAILINGS_API_TOKEN or NOMDUCHAT_ADMIN_ACCESS_TOKEN is required.");
}

const result = await run();
console.log(JSON.stringify(result, null, 2));

async function run() {
  switch (action) {
    case "create_audience":
      return createAudience();
    case "import_contacts":
      return importContacts();
    case "create_campaign":
      return createCampaign();
    case "send_campaign":
      return sendCampaign();
    case "sync_campaign":
      return syncCampaign();
    case "create_and_send":
      return createAndSend();
    default:
      fail(`Unknown NOMDUCHAT_MAILING_ACTION: ${action}`);
  }
}

async function createAudience() {
  const name = requiredEnv("NOMDUCHAT_MAILING_AUDIENCE_NAME");
  if (dryRun) return dryRunResult("create_audience", { name });

  return request("/mailings/audiences", {
    method: "POST",
    body: { name },
  });
}

async function importContacts(audienceId = readEnv("NOMDUCHAT_MAILING_AUDIENCE_ID", "")) {
  const resolvedAudienceId = audienceId || fail("NOMDUCHAT_MAILING_AUDIENCE_ID is required.");
  const rawContacts = await readTextInput("NOMDUCHAT_MAILING_CONTACTS", "NOMDUCHAT_MAILING_CONTACTS_FILE");
  if (!rawContacts.trim()) fail("Contacts are empty. Set NOMDUCHAT_MAILING_CONTACTS or NOMDUCHAT_MAILING_CONTACTS_FILE.");
  if (dryRun) return dryRunResult("import_contacts", { audienceId: resolvedAudienceId, contactsPreview: preview(rawContacts) });

  return request(`/mailings/audiences/${encodeURIComponent(resolvedAudienceId)}/import`, {
    method: "POST",
    body: { rawContacts },
  });
}

async function createCampaign(audienceId = readEnv("NOMDUCHAT_MAILING_AUDIENCE_ID", "")) {
  const resolvedAudienceId = audienceId || fail("NOMDUCHAT_MAILING_AUDIENCE_ID is required.");
  const payload = {
    audienceId: resolvedAudienceId,
    name: requiredEnv("NOMDUCHAT_MAILING_CAMPAIGN_NAME"),
    fromEmail: requiredEnv("NOMDUCHAT_MAILING_FROM_EMAIL"),
    fromName: readEnv("NOMDUCHAT_MAILING_FROM_NAME", ""),
    replyTo: readEnv("NOMDUCHAT_MAILING_REPLY_TO", ""),
    subject: requiredEnv("NOMDUCHAT_MAILING_SUBJECT"),
    html: await readTextInput("NOMDUCHAT_MAILING_HTML", "NOMDUCHAT_MAILING_HTML_FILE"),
    text: await readTextInput("NOMDUCHAT_MAILING_TEXT", "NOMDUCHAT_MAILING_TEXT_FILE", false),
  };

  if (!payload.html.trim()) fail("HTML body is empty. Set NOMDUCHAT_MAILING_HTML or NOMDUCHAT_MAILING_HTML_FILE.");
  if (dryRun) {
    return dryRunResult("create_campaign", {
      ...payload,
      html: preview(payload.html),
      text: preview(payload.text),
    });
  }

  return request("/mailings/campaigns", {
    method: "POST",
    body: payload,
  });
}

async function sendCampaign(campaignId = readEnv("NOMDUCHAT_MAILING_CAMPAIGN_ID", "")) {
  const resolvedCampaignId = campaignId || fail("NOMDUCHAT_MAILING_CAMPAIGN_ID is required.");
  if (dryRun) return dryRunResult("send_campaign", { campaignId: resolvedCampaignId });

  return request(`/mailings/campaigns/${encodeURIComponent(resolvedCampaignId)}/send`, {
    method: "POST",
    body: {},
  });
}

async function syncCampaign(campaignId = readEnv("NOMDUCHAT_MAILING_CAMPAIGN_ID", "")) {
  const resolvedCampaignId = campaignId || fail("NOMDUCHAT_MAILING_CAMPAIGN_ID is required.");
  if (dryRun) return dryRunResult("sync_campaign", { campaignId: resolvedCampaignId });

  return request(`/mailings/campaigns/${encodeURIComponent(resolvedCampaignId)}/sync`, {
    method: "POST",
    body: {},
  });
}

async function createAndSend() {
  if (dryRun) {
    const html = await readTextInput("NOMDUCHAT_MAILING_HTML", "NOMDUCHAT_MAILING_HTML_FILE");
    const text = await readTextInput("NOMDUCHAT_MAILING_TEXT", "NOMDUCHAT_MAILING_TEXT_FILE", false);
    const contacts = await readTextInput("NOMDUCHAT_MAILING_CONTACTS", "NOMDUCHAT_MAILING_CONTACTS_FILE", false);
    const audienceId = readEnv("NOMDUCHAT_MAILING_AUDIENCE_ID", "");
    const audienceName = readEnv("NOMDUCHAT_MAILING_AUDIENCE_NAME", "");
    if (!audienceId && !audienceName) fail("NOMDUCHAT_MAILING_AUDIENCE_ID or NOMDUCHAT_MAILING_AUDIENCE_NAME is required.");

    return dryRunResult("create_and_send", {
      audienceId,
      audienceName,
      campaignName: requiredEnv("NOMDUCHAT_MAILING_CAMPAIGN_NAME"),
      fromEmail: requiredEnv("NOMDUCHAT_MAILING_FROM_EMAIL"),
      fromName: readEnv("NOMDUCHAT_MAILING_FROM_NAME", ""),
      replyTo: readEnv("NOMDUCHAT_MAILING_REPLY_TO", ""),
      subject: requiredEnv("NOMDUCHAT_MAILING_SUBJECT"),
      html: preview(html),
      text: preview(text),
      contactsPreview: preview(contacts),
    });
  }

  let audienceId = readEnv("NOMDUCHAT_MAILING_AUDIENCE_ID", "");

  if (!audienceId && readEnv("NOMDUCHAT_MAILING_AUDIENCE_NAME", "")) {
    const audienceResponse = await createAudience();
    audienceId = audienceResponse.audience?.id;
  }
  if (!audienceId) fail("NOMDUCHAT_MAILING_AUDIENCE_ID or NOMDUCHAT_MAILING_AUDIENCE_NAME is required.");

  if (readEnv("NOMDUCHAT_MAILING_CONTACTS", "") || readEnv("NOMDUCHAT_MAILING_CONTACTS_FILE", "")) {
    await importContacts(audienceId);
  }

  const campaignResponse = await createCampaign(audienceId);
  const campaignId = campaignResponse.campaign?.id;
  if (!campaignId) return campaignResponse;

  const sendResponse = await sendCampaign(campaignId);
  return {
    campaign: campaignResponse.campaign,
    send: sendResponse,
  };
}

async function request(endpoint, init = {}) {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) {
    const message = body?.error?.message ?? body?.message ?? text ?? `nomduchat API failed with ${response.status}.`;
    fail(message);
  }

  return body;
}

async function readTextInput(valueEnv, fileEnv, required = true) {
  const directValue = readEnv(valueEnv, "");
  if (directValue) return directValue;

  const filePath = readEnv(fileEnv, "");
  if (!filePath) {
    if (required) fail(`${valueEnv} or ${fileEnv} is required.`);
    return "";
  }

  const resolved = path.resolve(process.cwd(), filePath);
  return readFile(resolved, "utf8");
}

function readEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : value.trim();
}

function requiredEnv(name) {
  const value = readEnv(name, "");
  return value || fail(`${name} is required.`);
}

function readBooleanEnv(name, fallback) {
  const value = readEnv(name, "");
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function preview(value) {
  if (!value) return "";
  return value.length > 240 ? `${value.slice(0, 240)}...` : value;
}

function dryRunResult(nextAction, payload) {
  return {
    dryRun: true,
    action: nextAction,
    payload,
  };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function printHelp() {
  console.log(`
nomduchat mailing API runner

Required:
  NOMDUCHAT_API_URL
  NOMDUCHAT_MAILINGS_API_TOKEN (preferred) or NOMDUCHAT_ADMIN_ACCESS_TOKEN
  NOMDUCHAT_MAILING_ACTION=create_audience|import_contacts|create_campaign|send_campaign|sync_campaign|create_and_send

Common:
  NOMDUCHAT_MAILING_DRY_RUN=true|false

Audience:
  NOMDUCHAT_MAILING_AUDIENCE_ID
  NOMDUCHAT_MAILING_AUDIENCE_NAME

Contacts:
  NOMDUCHAT_MAILING_CONTACTS
  NOMDUCHAT_MAILING_CONTACTS_FILE

Campaign:
  NOMDUCHAT_MAILING_CAMPAIGN_ID
  NOMDUCHAT_MAILING_CAMPAIGN_NAME
  NOMDUCHAT_MAILING_FROM_EMAIL
  NOMDUCHAT_MAILING_FROM_NAME
  NOMDUCHAT_MAILING_REPLY_TO
  NOMDUCHAT_MAILING_SUBJECT
  NOMDUCHAT_MAILING_HTML
  NOMDUCHAT_MAILING_HTML_FILE
  NOMDUCHAT_MAILING_TEXT
  NOMDUCHAT_MAILING_TEXT_FILE
`);
}
