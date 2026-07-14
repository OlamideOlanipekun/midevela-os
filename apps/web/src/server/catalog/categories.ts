import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { iconFor } from "@/server/catalog/icons";
import { getDefaultQualificationFlow, type QualificationFlow } from "@/server/widget/qualificationTemplates";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface WidgetCategory {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  icon: string;
  productCount: number;
}

/**
 * Categories the widget's category grid should show — only ones that
 * actually have products, so the funnel never dead-ends on an empty
 * category. Ordered by the merchant's chosen displayOrder.
 */
export async function listCategoriesForWidget(orgId: string): Promise<WidgetCategory[]> {
  const categories = await prisma.category.findMany({
    where: { orgId },
    include: { _count: { select: { products: true } } },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return categories
    .filter((c) => c._count.products > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug ?? slugify(c.name),
      image: c.image,
      icon: c.icon ?? iconFor(c.name),
      productCount: c._count.products,
    }));
}

export interface DashboardCategory extends WidgetCategory {
  displayOrder: number;
  qualificationFlow: QualificationFlow;
}

/** All categories (including empty ones) for dashboard management. */
export async function listCategoriesForDashboard(orgId: string): Promise<DashboardCategory[]> {
  const categories = await prisma.category.findMany({
    where: { orgId },
    include: { _count: { select: { products: true } } },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug ?? slugify(c.name),
    image: c.image,
    icon: c.icon ?? iconFor(c.name),
    displayOrder: c.displayOrder,
    qualificationFlow: (Array.isArray(c.qualificationFlow) ? c.qualificationFlow : []) as unknown as QualificationFlow,
    productCount: c._count.products,
  }));
}

export interface CategoryInput {
  name: string;
  image?: string | null;
  icon?: string | null;
  qualificationFlow?: QualificationFlow;
}

/**
 * Looked up by product-management flows that only have a category *name*
 * (manual product add/edit, the crawler). Creates the category — seeded
 * with a slug, icon, and a default qualification flow inferred from the
 * name/org industry — the first time it's used; otherwise returns the
 * existing row untouched.
 */
export async function getOrCreateCategoryByName(orgId: string, name?: string) {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = await prisma.category.findUnique({ where: { orgId_name: { orgId, name: trimmed } } });
  if (existing) return existing;

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { industry: true } });
  const maxOrder = await prisma.category.aggregate({ where: { orgId }, _max: { displayOrder: true } });

  return prisma.category.create({
    data: {
      orgId,
      name: trimmed,
      slug: slugify(trimmed),
      icon: iconFor(trimmed),
      qualificationFlow: getDefaultQualificationFlow(trimmed, org?.industry) as unknown as Prisma.InputJsonValue,
      displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
    },
  });
}

export async function createCategory(orgId: string, input: CategoryInput) {
  const name = input.name?.trim();
  if (!name) throw new ApiError(400, "Category name is required.");

  const existing = await prisma.category.findUnique({ where: { orgId_name: { orgId, name } } });
  if (existing) throw new ApiError(409, "A category with this name already exists.");

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { industry: true } });
  const maxOrder = await prisma.category.aggregate({ where: { orgId }, _max: { displayOrder: true } });

  return prisma.category.create({
    data: {
      orgId,
      name,
      slug: slugify(name),
      image: input.image ?? null,
      icon: input.icon ?? iconFor(name),
      qualificationFlow: (input.qualificationFlow ?? getDefaultQualificationFlow(name, org?.industry)) as unknown as Prisma.InputJsonValue,
      displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
    },
  });
}

export async function updateCategory(
  orgId: string,
  id: string,
  input: Partial<CategoryInput> & { displayOrder?: number }
) {
  const existing = await prisma.category.findFirst({ where: { id, orgId } });
  if (!existing) throw new ApiError(404, "Category not found.");

  const name = input.name?.trim();
  return prisma.category.update({
    where: { id },
    data: {
      ...(name ? { name, slug: slugify(name) } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.qualificationFlow !== undefined
        ? { qualificationFlow: input.qualificationFlow as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
    },
  });
}

/** Products keep their name/data — deleting a category just unassigns
 *  them (Product.categoryId onDelete: SetNull), it never deletes products. */
export async function deleteCategory(orgId: string, id: string) {
  const existing = await prisma.category.findFirst({ where: { id, orgId }, select: { id: true } });
  if (!existing) throw new ApiError(404, "Category not found.");
  await prisma.category.delete({ where: { id } });
}

export async function reorderCategories(orgId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.category.updateMany({ where: { id, orgId }, data: { displayOrder: index } }))
  );
}

/** Bulk-categorize products — the way to fix uncategorized crawled
 *  products without editing them one at a time. categoryId of null
 *  un-assigns them back to "uncategorized". */
export async function assignProductsToCategory(orgId: string, categoryId: string | null, productIds: string[]) {
  if (categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: categoryId, orgId }, select: { id: true } });
    if (!cat) throw new ApiError(404, "Category not found.");
  }
  await prisma.product.updateMany({
    where: { id: { in: productIds }, orgId },
    data: { categoryId },
  });
}
