import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  messageKey: string;
  docsUrl?: string;
  docsLabelKey?: string;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    messageKey: "config.supabaseNotConfigured",
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabelKey: "config.setupInstructions",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
