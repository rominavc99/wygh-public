import { inviteUrl } from "@/lib/groups";

type GroupRow = {
  id: string;
  name: string;
  suspended: boolean;
  inviteToken: string | null;
  createdAt: Date;
  tagline: string;
  greetingTemplate: string;
  sendTime: string;
  reminderEnabled: boolean;
  heroEnabled: boolean;
  heroTitle: string;
  heroParagraph: string;
  heroImageUrl: string;
  heroLinkUrl: string;
  heroLinkText: string;
  selectedPhraseId: string;
};

/** Un grupo con todos sus ajustes, como los edita /admin/grupos/<id>. */
export function groupSettingsDto(g: GroupRow) {
  return {
    id: g.id,
    name: g.name,
    suspended: g.suspended,
    inviteUrl: g.inviteToken ? inviteUrl(g.inviteToken) : null,
    createdAt: g.createdAt.toISOString(),
    newsletter: {
      tagline: g.tagline,
      greetingTemplate: g.greetingTemplate,
      sendTime: g.sendTime,
      reminderEnabled: g.reminderEnabled,
      heroEnabled: g.heroEnabled,
      heroTitle: g.heroTitle,
      heroParagraph: g.heroParagraph,
      heroImageUrl: g.heroImageUrl,
      heroLinkUrl: g.heroLinkUrl,
      heroLinkText: g.heroLinkText,
      selectedPhraseId: g.selectedPhraseId || null,
    },
  };
}

export const NEWSLETTER_KEYS = [
  "tagline",
  "greetingTemplate",
  "sendTime",
  "reminderEnabled",
  "heroEnabled",
  "heroTitle",
  "heroParagraph",
  "heroImageUrl",
  "heroLinkUrl",
  "heroLinkText",
  "selectedPhraseId",
] as const;
