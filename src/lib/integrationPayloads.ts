type SlackNotificationInput = {
  appUrl: string;
  cardPath: string;
  title: string;
  body: string;
  slackUserId?: string | null;
  registrationStatus?: string | null;
};

type SlackNotificationTarget = {
  actorUserId?: string | null;
  recipientUserId?: string | null;
  recipientSlackUserId?: string | null;
};

type JiraSummaryInput = {
  leadId: string;
  leadName?: string | null;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const isSlackBotToken = (token?: string | null) => !!token?.startsWith("xoxb-");

export const shouldNotifySlackUser = ({
  actorUserId,
  recipientUserId,
  recipientSlackUserId,
}: SlackNotificationTarget) => {
  if (!recipientUserId && !recipientSlackUserId) return false;
  if (actorUserId && recipientUserId && actorUserId === recipientUserId) return false;
  return true;
};

export const buildSlackNotificationMessage = ({
  appUrl,
  cardPath,
  title,
  body,
  slackUserId,
  registrationStatus,
}: SlackNotificationInput) => {
  const baseUrl = trimTrailingSlash(appUrl || "");
  const cardUrl = `${baseUrl}${cardPath.startsWith("/") ? "" : "/"}${cardPath}`;
  const onboardingUrl =
    registrationStatus === "pending" && slackUserId
      ? `${baseUrl}/primeiro-acesso?slack_id=${encodeURIComponent(slackUserId)}`
      : null;
  const actionUrl = onboardingUrl || cardUrl;
  const blocksText = `*${title}*\n${body}\n\n<${actionUrl}|${onboardingUrl ? "Fazer primeiro acesso" : "Abrir card"}>`;

  return {
    text: `${title}: ${body}`,
    blocksText,
    actionUrl,
  };
};

export const buildJiraIssueSummary = ({ leadId, leadName }: JiraSummaryInput) =>
  `[Painel Comercial ${leadId}] ${leadName?.trim() || "Card sem nome"}`;

export const buildJiraOriginReference = (leadId: string) => `painel-comercial:${leadId}`;
