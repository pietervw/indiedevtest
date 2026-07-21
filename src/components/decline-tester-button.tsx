"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { rejectTesterRequest } from "@/app/actions/requests";
import { Button } from "@/components/ui/button";

/** Small confirmation guard; the owner can undo a decline from tester history. */
export function DeclineTesterButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => {
    if (!window.confirm("Decline this tester request? You can undo this from tester history.")) return;
    startTransition(async () => { await rejectTesterRequest(requestId); router.refresh(); });
  }}>{pending ? "Declining…" : "Decline"}</Button>;
}
