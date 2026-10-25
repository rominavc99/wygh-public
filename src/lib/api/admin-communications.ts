import { userRefDto } from "@/lib/api/dto";

type CommunicationRow = {
  id: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  audience: string;
  recipientIds: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  recipientCount: number;
  error: string | null;
  createdAt: Date;
  createdBy: { id: string; name: string; username: string | null };
};

export function communicationDto(c: CommunicationRow, withBody = false) {
  let ids: string[] = [];
  try {
    ids = c.recipientIds ? (JSON.parse(c.recipientIds) as string[]) : [];
  } catch {
    ids = [];
  }
  return {
    id: c.id,
    subject: c.subject,
    audience: c.audience,
    recipientIds: c.audience === "selected" ? ids : [],
    groupIds: c.audience === "groups" ? ids : [],
    status: c.status,
    scheduledAt: c.scheduledAt.toISOString(),
    sentAt: c.sentAt?.toISOString() ?? null,
    recipientCount: c.recipientCount,
    error: c.error,
    createdAt: c.createdAt.toISOString(),
    createdBy: userRefDto(c.createdBy),
    ...(withBody ? { bodyHtml: c.bodyHtml, bodyText: c.bodyText } : {}),
  };
}

/** El cuerpo JSON de una comunicación como el formulario del panel. */
export function communicationFields(b: Record<string, unknown>) {
  return {
    subject: b.subject,
    bodyHtml: b.bodyHtml,
    audience: b.audience ?? "all",
    recipientIds: Array.isArray(b.recipientIds) ? b.recipientIds : [],
    groupIds: Array.isArray(b.groupIds) ? b.groupIds : [],
    sendMode: b.scheduledAt ? "later" : "now",
    scheduledAt: b.scheduledAt,
  };
}
