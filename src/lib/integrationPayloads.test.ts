import { describe, expect, it } from "vitest";
import {
  buildJiraIssueSummary,
  buildJiraOriginReference,
  buildSlackNotificationMessage,
  isSlackBotToken,
  shouldNotifySlackUser,
} from "./integrationPayloads";

describe("integration payload helpers", () => {
  it("skips Slack notification when actor is the same internal user", () => {
    expect(shouldNotifySlackUser({ actorUserId: "u1", recipientUserId: "u1" })).toBe(false);
  });

  it("allows Slack notification for Slack-only contacts", () => {
    expect(shouldNotifySlackUser({ actorUserId: "u1", recipientSlackUserId: "U123" })).toBe(true);
  });

  it("builds an onboarding Slack message for unregistered contacts", () => {
    const message = buildSlackNotificationMessage({
      appUrl: "https://app.example.com",
      cardPath: "/admin/painel-comercial?card=lead-1",
      title: "Voce foi mencionado",
      body: "Rafael mencionou voce no card.",
      slackUserId: "U123",
      registrationStatus: "pending",
    });

    expect(message.text).toContain("Rafael mencionou voce no card.");
    expect(message.blocksText).toContain("https://app.example.com/primeiro-acesso?slack_id=U123");
  });

  it("builds a Jira summary with origin reference", () => {
    expect(buildJiraIssueSummary({ leadId: "abc", leadName: "Cliente Teste" })).toBe(
      "[Painel Comercial abc] Cliente Teste",
    );
  });

  it("builds one origin reference for the implementation issue", () => {
    expect(buildJiraOriginReference("abc")).toBe("painel-comercial:abc");
  });

  it("accepts only Slack bot tokens for automation", () => {
    expect(isSlackBotToken("xoxb-valid")).toBe(true);
    expect(isSlackBotToken("xoxp-user-token")).toBe(false);
    expect(isSlackBotToken("xoxe.xoxp-legacy-token")).toBe(false);
  });
});
