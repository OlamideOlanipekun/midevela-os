import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { LearningDashboardService } from "@/server/learning/learningDashboard";
import { ModelGovernance } from "@/server/learning/modelGovernance";
import { ExperimentEngine } from "@/server/learning/experimentEngine";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const overview = await LearningDashboardService.getOverview(org.id);
    return NextResponse.json(overview);
  });
}

export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const body = await req.json();
    const { action, version, experimentKey, controlMetrics, treatmentMetrics } = body;

    if (action === "promote_model") {
      if (!version) {
        return NextResponse.json({ error: "Version required" }, { status: 400 });
      }
      const model = await ModelGovernance.promoteToProduction(org.id, version);
      return NextResponse.json({ success: true, model });
    }

    if (action === "rollback_model") {
      const model = await ModelGovernance.rollbackProduction(org.id);
      return NextResponse.json({ success: true, model });
    }

    if (action === "evaluate_experiment") {
      if (!controlMetrics || !treatmentMetrics) {
        return NextResponse.json({ error: "Metrics required" }, { status: 400 });
      }
      const evalResult = ExperimentEngine.evaluateSignificance(controlMetrics, treatmentMetrics);
      return NextResponse.json({ success: true, evaluation: evalResult });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  });
}
