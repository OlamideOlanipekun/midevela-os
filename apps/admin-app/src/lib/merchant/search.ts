import type { Prisma } from "@prisma/client";
import type { MerchantFilters } from "./types";

export function buildMerchantWhere(filters: MerchantFilters): Prisma.OrganizationWhereInput {
  const where: Prisma.OrganizationWhereInput = {};
  const AND: Prisma.OrganizationWhereInput[] = [];

  if (filters.search) {
    const term = filters.search;
    AND.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { slug: { contains: term, mode: "insensitive" } },
        { users: { some: { email: { contains: term, mode: "insensitive" } } } },
      ],
    });
  }

  if (filters.country) {
    AND.push({ country: { equals: filters.country, mode: "insensitive" } });
  }

  if (filters.status) {
    AND.push({ subscription: { status: filters.status as any } });
  }

  if (filters.createdFrom) {
    AND.push({ createdAt: { gte: new Date(filters.createdFrom) } });
  }

  if (filters.createdTo) {
    AND.push({ createdAt: { lte: new Date(filters.createdTo) } });
  }

  if (AND.length > 0) {
    where.AND = AND;
  }

  return where;
}

export function buildMerchantOrderBy(sort?: string, order: "asc" | "desc" = "desc"): Prisma.OrganizationOrderByWithRelationInput {
  switch (sort) {
    case "name":
      return { name: order };
    case "created":
      return { createdAt: order };
    case "plan":
      return { subscription: { plan: { priceMonthly: order } } };
    default:
      return { createdAt: "desc" };
  }
}
