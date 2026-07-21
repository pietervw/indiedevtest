"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  acceptTesterRequest,
  confirmTesterJoined,
  resendTesterInvitation,
} from "@/app/actions/requests";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardOwnerTester } from "@/lib/dashboard";
import { profilePath } from "@/lib/mock-data";

export function DashboardTesterTable({
  testers,
  platformLabel,
}: {
  testers: DashboardOwnerTester[];
  platformLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState<DashboardOwnerTester | null>(null);
  const [isConfirming, startConfirming] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [, startResending] = useTransition();
  const router = useRouter();

  function openConfirm(tester: DashboardOwnerTester) {
    setConfirming(tester);
    dialogRef.current?.showModal();
  }

  function closeConfirm() {
    dialogRef.current?.close();
    setConfirming(null);
  }

  function confirmJoined() {
    if (!confirming) return;
    startConfirming(async () => {
      await confirmTesterJoined(confirming.id);
      closeConfirm();
      router.refresh();
    });
  }

  function resendInvitation(requestId: string) {
    setResendingId(requestId);
    startResending(async () => {
      try {
        await resendTesterInvitation(requestId, { ok: false, message: "" }, new FormData());
      } finally {
        setResendingId(null);
      }
    });
  }

  return (
    <>
      <div className="mt-5 overflow-x-auto rounded-xl border-2 border-line">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b-2 border-line bg-paper-muted text-ink">
            <tr>
              <th className="px-4 py-3 font-display font-bold">Tester</th>
              <th className="px-4 py-3 font-display font-bold">Status</th>
              <th className="px-4 py-3 text-right font-display font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-line bg-paper">
            {testers.map((tester) => {
              const isApproved = tester.status === "accepted";
              const hasJoined = tester.assignmentStatus !== null;
              const approve = acceptTesterRequest.bind(null, tester.id);

              return (
                <tr key={tester.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={profilePath(tester.tester.profileSlug)}
                      className="font-semibold text-ink underline-offset-2 hover:underline"
                    >
                      {tester.tester.displayName}
                    </Link>
                    <a
                      href={`mailto:${tester.testerEmail}`}
                      className="mt-0.5 block text-xs text-ink-muted hover:underline"
                    >
                      {tester.testerEmail}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <TesterStatus tester={tester} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <form action={approve}>
                        <SubmitButton
                          size="sm"
                          pendingLabel="Approving…"
                          disabled={isApproved}
                        >
                          Approve
                        </SubmitButton>
                      </form>
                      <Button
                        type="button"
                        size="sm"
                        variant={isApproved && !hasJoined ? "primary" : "secondary"}
                        disabled={!isApproved || hasJoined}
                        onClick={() => openConfirm(tester)}
                      >
                        Confirm joined
                      </Button>
                      <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!isApproved || hasJoined}
                          onClick={() => resendInvitation(tester.id)}
                        >
                          {resendingId === tester.id ? "Resending…" : "Resend invitation"}
                        </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dialog
        ref={dialogRef}
        className="w-[min(32rem,calc(100%-2rem))] rounded-2xl border-2 border-ink bg-paper p-0 text-ink shadow-brutal backdrop:bg-ink/50"
        onClose={() => setConfirming(null)}
      >
        <div className="p-6">
          <h2 className="font-display text-xl font-extrabold">Confirm joined</h2>
          <p className="mt-3 text-ink-muted">
            Has {confirming?.tester.displayName ?? "this user"} joined your closed
            testing track on {platformLabel}?
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" size="sm" variant="secondary" onClick={closeConfirm} disabled={isConfirming}>
              No
            </Button>
            <Button type="button" size="sm" onClick={confirmJoined} disabled={isConfirming}>
              {isConfirming ? "Confirming…" : "Yes"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function TesterStatus({ tester }: { tester: DashboardOwnerTester }) {
  if (tester.assignmentStatus === "completed") {
    return <Badge variant="dark" size="sm">Completed</Badge>;
  }
  if (tester.assignmentStatus === "active") {
    return <Badge variant="dark" size="sm">Joined</Badge>;
  }
  if (tester.assignmentStatus === "incomplete" || tester.assignmentStatus === "cancelled") {
    return <Badge variant="muted" size="sm">{tester.assignmentStatus}</Badge>;
  }
  return tester.status === "accepted" ? (
    <Badge variant="outline" size="sm">Approved</Badge>
  ) : (
    <Badge variant="muted" size="sm">Awaiting approval</Badge>
  );
}
