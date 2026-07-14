import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { NAMED_QUALIFICATION_TEMPLATES } from "@/server/widget/qualificationTemplates";

/** Read-only list of qualification-flow templates the dashboard's category
 *  editor can offer ("editable in the dashboard" = pick one of these). */
export async function GET() {
  return withErrorHandling(async () => {
    await requireOrg();
    const templates = Object.entries(NAMED_QUALIFICATION_TEMPLATES).map(([key, t]) => ({
      key,
      label: t.label,
      flow: t.flow,
    }));
    return NextResponse.json({ templates });
  });
}
