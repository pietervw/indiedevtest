import { buildLlmsFullTxt, llmsTextResponse } from "@/lib/llms";

export const dynamic = "force-static";

export function GET() {
  return llmsTextResponse(buildLlmsFullTxt());
}
