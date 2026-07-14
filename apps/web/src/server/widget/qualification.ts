import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import type { QualificationFlow, QualificationStep } from "@/server/widget/qualificationTemplates";

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
    select: { name: true, qualificationFlow: true },
  });
  if (!category) throw new ApiError(404, "Category not found.");

  const flow = (Array.isArray(category.qualificationFlow) ? category.qualificationFlow : []) as unknown as QualificationFlow;

  for (const step of flow) {
    if (!(step.key in answers)) {
      return { done: false, step, categoryName: category.name };
    }
  }
  return { done: true, categoryName: category.name };
}
