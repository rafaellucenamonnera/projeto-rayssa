ALTER TABLE public.whatsapp_extractions ADD COLUMN IF NOT EXISTS jira_issue_key text;
CREATE INDEX IF NOT EXISTS idx_whatsapp_extractions_jira_key ON public.whatsapp_extractions (jira_issue_key) WHERE jira_issue_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gmail_processed_messages_jira_key ON public.gmail_processed_messages (jira_issue_key) WHERE jira_issue_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_representative_cards_jira_key ON public.representative_cards (jira_issue_key) WHERE jira_issue_key IS NOT NULL;