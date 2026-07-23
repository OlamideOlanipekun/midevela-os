import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";

export async function listFeatureFlags() {
  const flags = await prisma.featureFlag.findMany({
    orderBy: { createdAt: "desc" },
  });
  return flags;
}

export async function toggleFeatureFlag(id: string, enabled: boolean) {
  const flag = await prisma.featureFlag.findUnique({ where: { id } });
  if (!flag) throw new ApiError(404, "Feature flag not found");

  return prisma.featureFlag.update({
    where: { id },
    data: { enabled },
  });
}
