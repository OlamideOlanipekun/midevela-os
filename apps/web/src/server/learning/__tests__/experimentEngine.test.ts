import { describe, it, expect } from "vitest";
import { ExperimentEngine } from "../experimentEngine";

describe("ExperimentEngine - Statistical Evaluation & Uplift", () => {
  it("evaluates statistical significance between Control and Treatment variants correctly", () => {
    const controlMetrics = {
      impressions: 1000,
      clicks: 200,
      carts: 80,
      purchases: 30, // 3% conversion
      revenue: 300000,
      ctr: 0.2,
      conversionRate: 0.03,
    };

    const treatmentMetrics = {
      impressions: 1000,
      clicks: 280,
      carts: 130,
      purchases: 65, // 6.5% conversion
      revenue: 650000,
      ctr: 0.28,
      conversionRate: 0.065,
    };

    const result = ExperimentEngine.evaluateSignificance(controlMetrics, treatmentMetrics);

    expect(result.upliftPct).toBeGreaterThan(100); // > 100% conversion uplift
    expect(result.zScore).toBeGreaterThan(1.96);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.isStatisticallySignificant).toBe(true);
  });

  it("returns not statistically significant when sample size or uplift is minimal", () => {
    const controlMetrics = {
      impressions: 50,
      clicks: 10,
      carts: 4,
      purchases: 2,
      revenue: 20000,
      ctr: 0.2,
      conversionRate: 0.04,
    };

    const treatmentMetrics = {
      impressions: 50,
      clicks: 11,
      carts: 5,
      purchases: 2,
      revenue: 20000,
      ctr: 0.22,
      conversionRate: 0.04,
    };

    const result = ExperimentEngine.evaluateSignificance(controlMetrics, treatmentMetrics);

    expect(result.isStatisticallySignificant).toBe(false);
    expect(result.upliftPct).toBe(0);
  });
});
