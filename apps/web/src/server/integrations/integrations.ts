import prisma from "@/lib/prisma";
import { requireOrg } from "@/server/auth/context";

export interface IntegrationDto {
  id: string;
  channel: string;
  status: string;
  label: string;
  desc: string;
  icon: string;
}

const CHANNEL_META: Record<string, { label: string; desc: string; icon: string }> = {
  WEBSITE:    { label: "Website Widget",    desc: "Your embedded AI widget",              icon: "globe" },
  WHATSAPP:   { label: "WhatsApp",           desc: "Connect your WhatsApp Business number", icon: "message-circle" },
  INSTAGRAM:  { label: "Instagram",          desc: "Handle DMs and comments with AI",      icon: "camera" },
  FACEBOOK:   { label: "Facebook Messenger", desc: "Automate responses on your Facebook page", icon: "message-square" },
  EMAIL:      { label: "Email",              desc: "AI-powered email follow-ups",          icon: "mail" },
};

export async function listIntegrations(): Promise<IntegrationDto[]> {
  const { org } = await requireOrg();
  const records = await prisma.channelIntegration.findMany({
    where: { orgId: org.id },
  });

  const mapped = records.map(toDto);
  for (const [channel, meta] of Object.entries(CHANNEL_META)) {
    if (!mapped.some((m) => m.channel === channel)) {
      mapped.push({
        id: `${channel}-new`,
        channel,
        status: "DISABLED",
        ...meta,
      });
    }
  }
  return mapped.sort((a, b) => a.label.localeCompare(b.label));
}

export async function connectChannel(channel: string): Promise<IntegrationDto> {
  const { org } = await requireOrg();
  const record = await prisma.channelIntegration.upsert({
    where: { orgId_channel: { orgId: org.id, channel: channel as any } },
    update: { status: "CONNECTED" },
    create: { orgId: org.id, channel: channel as any, status: "CONNECTED" },
  });
  return toDto(record);
}

export async function disconnectChannel(channel: string): Promise<IntegrationDto> {
  const { org } = await requireOrg();
  const record = await prisma.channelIntegration.upsert({
    where: { orgId_channel: { orgId: org.id, channel: channel as any } },
    update: { status: "DISABLED" },
    create: { orgId: org.id, channel: channel as any, status: "DISABLED" },
  });
  return toDto(record);
}

function toDto(record: { id: string; channel: string; status: string }): IntegrationDto {
  const meta = CHANNEL_META[record.channel] ?? { label: record.channel, desc: "", icon: "globe" };
  return { id: record.id, channel: record.channel, status: record.status, ...meta };
}
