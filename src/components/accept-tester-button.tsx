"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptTesterRequest } from "@/app/actions/requests";
import { Button } from "@/components/ui/button";

export function AcceptTesterButton({
  requestId,
  disabled = false,
  label = "Approve tester",
  onSuccess,
}: {
  requestId: string;
  disabled?: boolean;
  label?: string;
  onSuccess?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  function accept() {
    setFeedback(null);
    startTransition(async () => {
      const result = await acceptTesterRequest(requestId);
      setFeedback({ ok: result.ok, message: result.message });
      if (result.ok) {
        await onSuccess?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="text-right">
      <Button
        type="button"
        size="sm"
        disabled={disabled || isPending}
        onClick={accept}
      >
        {isPending ? "Approving…" : label}
      </Button>
      {feedback ? (
        <p
          className={`mt-1 max-w-72 text-xs font-semibold ${
            feedback.ok ? "text-ink-muted" : "text-red-600"
          }`}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
