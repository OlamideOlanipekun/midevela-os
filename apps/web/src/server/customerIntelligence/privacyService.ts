import prisma from "@/lib/prisma";

export interface RetentionPolicyResult {
  expiredSessionsDeleted: number;
  oldCustomerEventsDeleted: number;
  timestamp: string;
}

export async function executeRetentionPolicy(
  orgId?: string,
  eventRetentionDays = 90
): Promise<RetentionPolicyResult> {
  const now = new Date();

  // 1. Delete expired anonymous shopper sessions
  const sessionWhere: any = {
    isAnonymous: true,
    expiresAt: { lt: now },
  };
  if (orgId) sessionWhere.orgId = orgId;

  const deletedSessions = await prisma.shopperSession.deleteMany({
    where: sessionWhere,
  });

  // 2. Delete raw customer events older than eventRetentionDays
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - eventRetentionDays);

  const eventWhere: any = {
    createdAt: { lt: cutoffDate },
  };
  if (orgId) eventWhere.orgId = orgId;

  const deletedEvents = await prisma.customerEvent.deleteMany({
    where: eventWhere,
  });

  return {
    expiredSessionsDeleted: deletedSessions.count,
    oldCustomerEventsDeleted: deletedEvents.count,
    timestamp: now.toISOString(),
  };
}

export async function sanitizeAndAnonymizeCustomer(
  orgId: string,
  customerId: string
): Promise<void> {
  // Disassociate customer info from sessions
  await prisma.shopperSession.updateMany({
    where: { orgId, customerId },
    data: {
      customerId: null,
      isAnonymous: true,
    },
  });

  // Anonymize Customer row PII
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: "Anonymized Shopper",
      email: null,
      phone: null,
      preferences: [],
    },
  });
}
