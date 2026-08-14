import prisma from "@/lib/prisma";
import { ModelVersion, RankingWeights } from "./types";

export interface PromotionCheckResult {
  allowed: boolean;
  reason: string;
  candidateMetrics?: Record<string, number>;
}

/**
 * Model Governance & Lifecycle Engine (E10)
 * Prevents experimental AI models from silently corrupting production ranking.
 * Supports candidate evaluation, approval thresholds, version tracking, and instant rollbacks.
 */
export class ModelGovernance {
  /**
   * Register a new candidate model version.
   */
  public static async createCandidateModel(
    orgId: string,
    version: string,
    weights: RankingWeights,
    metrics?: Record<string, number>
  ): Promise<ModelVersion> {
    const existing = await prisma.rankingModel.findUnique({
      where: { orgId_version: { orgId, version } },
    });

    if (existing) {
      throw new Error(`Model version ${version} already exists for org ${orgId}`);
    }

    const created = await prisma.rankingModel.create({
      data: {
        orgId,
        version,
        status: "CANDIDATE",
        weights: weights as any,
        metrics: (metrics || {}) as any,
      },
    });

    return {
      id: created.id,
      orgId: created.orgId,
      version: created.version,
      status: created.status as any,
      weights: created.weights as unknown as RankingWeights,
      metrics: created.metrics as unknown as Record<string, number>,
    };
  }

  /**
   * Evaluate candidate model against minimum quality thresholds before promotion.
   */
  public static async evaluateCandidate(
    orgId: string,
    version: string,
    minConversionThreshold = 0.02
  ): Promise<PromotionCheckResult> {
    const candidate = await prisma.rankingModel.findUnique({
      where: { orgId_version: { orgId, version } },
    });

    if (!candidate) {
      return { allowed: false, reason: `Candidate model ${version} not found` };
    }

    if (candidate.status !== "CANDIDATE") {
      return { allowed: false, reason: `Model status is '${candidate.status}', expected 'CANDIDATE'` };
    }

    const metrics = (candidate.metrics as Record<string, number>) || {};
    const convRate = metrics.backtestConversionRate ?? 0;

    if (convRate < minConversionThreshold) {
      return {
        allowed: false,
        reason: `Backtest conversion rate (${(convRate * 100).toFixed(2)}%) is below mandatory threshold (${(
          minConversionThreshold * 100
        ).toFixed(2)}%)`,
        candidateMetrics: metrics,
      };
    }

    return {
      allowed: true,
      reason: "Model passed all governance quality checks and threshold requirements.",
      candidateMetrics: metrics,
    };
  }

  /**
   * Promote candidate model version to PRODUCTION.
   */
  public static async promoteToProduction(orgId: string, version: string): Promise<ModelVersion> {
    const evaluation = await this.evaluateCandidate(orgId, version);
    if (!evaluation.allowed) {
      throw new Error(`Cannot promote model: ${evaluation.reason}`);
    }

    // Demote current PRODUCTION models to ARCHIVED
    await prisma.rankingModel.updateMany({
      where: { orgId, status: "PRODUCTION" },
      data: { status: "ARCHIVED" },
    });

    // Promote candidate model
    const promoted = await prisma.rankingModel.update({
      where: { orgId_version: { orgId, version } },
      data: {
        status: "PRODUCTION",
        promotedAt: new Date(),
      },
    });

    return {
      id: promoted.id,
      orgId: promoted.orgId,
      version: promoted.version,
      status: promoted.status as any,
      weights: promoted.weights as unknown as RankingWeights,
      metrics: promoted.metrics as unknown as Record<string, number>,
      promotedAt: promoted.promotedAt,
    };
  }

  /**
   * Instantly rollback PRODUCTION model to the previous stable version.
   */
  public static async rollbackProduction(orgId: string): Promise<ModelVersion> {
    const currentProd = await prisma.rankingModel.findFirst({
      where: { orgId, status: "PRODUCTION" },
    });

    if (currentProd) {
      await prisma.rankingModel.update({
        where: { id: currentProd.id },
        data: { status: "ROLLED_BACK" },
      });
    }

    // Find latest ARCHIVED model
    const previousModel = await prisma.rankingModel.findFirst({
      where: { orgId, status: "ARCHIVED" },
      orderBy: { updatedAt: "desc" },
    });

    if (!previousModel) {
      throw new Error("No previous archived model available for rollback");
    }

    const restored = await prisma.rankingModel.update({
      where: { id: previousModel.id },
      data: {
        status: "PRODUCTION",
        promotedAt: new Date(),
      },
    });

    return {
      id: restored.id,
      orgId: restored.orgId,
      version: restored.version,
      status: restored.status as any,
      weights: restored.weights as unknown as RankingWeights,
      metrics: restored.metrics as unknown as Record<string, number>,
      promotedAt: restored.promotedAt,
    };
  }
}
