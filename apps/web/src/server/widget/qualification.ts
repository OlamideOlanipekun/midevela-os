import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import type { QualificationFlow, QualificationStep } from "@/server/widget/qualificationTemplates";
import { computeBudgetOptions } from "@/server/widget/budget";

export interface QualificationResult {
  done: boolean;
  step?: QualificationStep;
  categoryName?: string;
}

/**
 * Walks a category's qualificationFlow given the answers collected so
 * far, returning the next unanswered step — or {done:true} once every
 * step has an answer. Pure config walk, no LLM: the widget never
 * hardcodes these steps, it only ever renders whatever this returns.
 *
 * Presence (not truthiness) decides "answered" — an option can legitimately
 * have value "" (e.g. "No preference"), which must count as answered.
 */
export async function nextQualificationStep(
  orgId: string,
  categoryId: string,
  answers: Record<string, string>
): Promise<QualificationResult> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, orgId },
    select: { id: true, name: true, qualificationFlow: true },
  });
  if (!category) throw new ApiError(404, "Category not found.");

  const flow = (Array.isArray(category.qualificationFlow) ? category.qualificationFlow : []) as unknown as QualificationFlow;

  for (const step of flow) {
    if (!(step.key in answers)) {
      if (step.type === "budget") {
        const dynamicStep = await withDynamicBudget(orgId, category.id, step);
        return { done: false, step: dynamicStep, categoryName: category.name };
      }
      return { done: false, step, categoryName: category.name };
    }
  }
  return { done: true, categoryName: category.name };
}

/**
 * Replaces a budget step's static options with ones computed from the
 * category's real, in-stock prices — falls back to the step's original
 * (template) options when the catalog doesn't have enough price variety
 * to bucket meaningfully (computeBudgetOptions returns []).
 */
async function withDynamicBudget(
  orgId: string,
  categoryId: string,
  step: QualificationStep
): Promise<QualificationStep> {
  const [org, children] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
    prisma.category.findMany({ where: { parentId: categoryId, orgId }, select: { id: true } }),
  ]);
  const categoryIds = [categoryId, ...children.map((c) => c.id)];
  const dynamicOptions = await computeBudgetOptions(orgId, categoryIds, org?.currency ?? "NGN");
  return dynamicOptions.length > 0 ? { ...step, options: dynamicOptions } : step;
}
