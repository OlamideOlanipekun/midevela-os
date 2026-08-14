import prisma from "@/lib/prisma";
import crypto from "crypto";
import { ExperimentConfig, ExperimentVariant, VariantMetrics } from "./types";

export interface StatisticalEvaluationResult {
  controlVariantId: string;
  treatmentVariantId: string;
  controlConversionRate: number;
  treatmentConversionRate: number;
  upliftPct: number;
  zScore: number;
  pValue: number;
  isStatisticallySignificant: boolean;
}

/**
 * Experimentation & A/B Testing Engine (E8 + E9)
 * Provides deterministic visitor traffic splitting across recommendation strategies,
 * metric tracking, and statistical significance evaluation.
 */
export class ExperimentEngine {
  /**
   * Assign a session to an experiment variant deterministically based on hash.
   */
  public static async getOrAssignVariant(
    orgId: string,
    experimentKey: string,
    sessionId: string
  ): Promise<ExperimentVariant | null> {
    const experiment = await prisma.experiment.findUnique({
      where: { orgId_key: { orgId, key: experimentKey } },
    });

    if (!experiment || experiment.status !== "RUNNING") {
      return null;
    }

    const variants = (experiment.variants as unknown as ExperimentVariant[]) || [];
    if (variants.length === 0) return null;

    // Check existing assignment
    const existingAssignment = await prisma.experimentAssignment.findUnique({
      where: { experimentId_sessionId: { experimentId: experiment.id, sessionId } },
    });

    if (existingAssignment) {
      const variant = variants.find((v) => v.id === existingAssignment.variantId);
      if (variant) return variant;
    }

    // Deterministic hashing bucket
    const hash = crypto.createHash("md5").update(`${experiment.id}:${sessionId}`).digest("hex");
    const bucket = parseInt(hash.slice(0, 8), 16) / 0xffffffff; // 0.0 to 1.0

    let cumulative = 0;
    let selectedVariant = variants[0];

    for (const v of variants) {
      cumulative += v.weight;
      if (bucket <= cumulative) {
        selectedVariant = v;
        break;
      }
    }

    // Save assignment asynchronously
    try {
      await prisma.experimentAssignment.create({
        data: {
          orgId,
          experimentId: experiment.id,
          sessionId,
          variantId: selectedVariant.id,
        },
      });
    } catch {
      // Ignore conflict if created concurrently
    }

    return selectedVariant;
  }

  /**
   * Track outcome events for an experiment variant.
   */
  public static async recordMetric(
    orgId: string,
    experimentKey: string,
    variantId: string,
    metricType: "impression" | "click" | "cart" | "purchase",
    revenue = 0
  ): Promise<void> {
    const experiment = await prisma.experiment.findUnique({
      where: { orgId_key: { orgId, key: experimentKey } },
    });

    if (!experiment) return;

    const metrics = (experiment.metrics as unknown as Record<string, VariantMetrics>) || {};
    const current = metrics[variantId] || {
      impressions: 0,
      clicks: 0,
      carts: 0,
      purchases: 0,
      revenue: 0,
      ctr: 0,
      conversionRate: 0,
    };

    if (metricType === "impression") current.impressions += 1;
    if (metricType === "click") current.clicks += 1;
    if (metricType === "cart") current.carts += 1;
    if (metricType === "purchase") {
      current.purchases += 1;
      current.revenue += revenue;
    }

    current.ctr = current.impressions > 0 ? current.clicks / current.impressions : 0;
    current.conversionRate = current.impressions > 0 ? current.purchases / current.impressions : 0;

    metrics[variantId] = current;

    await prisma.experiment.update({
      where: { id: experiment.id },
      data: { metrics: metrics as any },
    });
  }

  /**
   * Evaluate statistical significance between Control (Variant A) and Treatment (Variant B).
   */
  public static evaluateSignificance(
    controlMetrics: VariantMetrics,
    treatmentMetrics: VariantMetrics
  ): StatisticalEvaluationResult {
    const n1 = controlMetrics.impressions || 1;
    const p1 = controlMetrics.conversionRate;
    const n2 = treatmentMetrics.impressions || 1;
    const p2 = treatmentMetrics.conversionRate;

    const upliftPct = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0;

    // Pooled proportion for z-test
    const pPool = (controlMetrics.purchases + treatmentMetrics.purchases) / (n1 + n2);
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

    const zScore = se > 0 ? (p2 - p1) / se : 0;
    // Approximating two-tailed p-value from z-score
    const pValue = Number((2 * (1 - this.normalCdf(Math.abs(zScore)))).toFixed(4));
    const isStatisticallySignificant = pValue < 0.05 && Math.abs(zScore) >= 1.96;

    return {
      controlVariantId: "A",
      treatmentVariantId: "B",
      controlConversionRate: Number((p1 * 100).toFixed(2)),
      treatmentConversionRate: Number((p2 * 100).toFixed(2)),
      upliftPct: Number(upliftPct.toFixed(2)),
      zScore: Number(zScore.toFixed(4)),
      pValue,
      isStatisticallySignificant,
    };
  }

  private static normalCdf(x: number): number {
    const t = 1 / (1 + 0.2316419 * x);
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const p =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return 1 - p;
  }
}
