"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  acceptTesterRequest,
  confirmTesterJoined,
  resendTesterInvitation,
  undoTesterRequestDecline,
} from "@/app/actions/requests";
import { updateTesterFeedbackStatus } from "@/app/actions/feedback";
import { SubmitButton } from "@/components/submit-button";
import { DeclineTesterButton } from "@/components/decline-tester-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardOwnerTester, DashboardTesterActivity, DashboardTesterFeedback, DashboardTesterHistory } from "@/lib/dashboard";
import { profilePath } from "@/lib/mock-data";

export function DashboardTesterTable({
  testers,
  history,
  activity,
  feedback,
  canApprove,
  canResendInvitation,
  platformLabel,
}: {
  testers: DashboardOwnerTester[];
  history: DashboardTesterHistory[];
  activity: DashboardTesterActivity[];
  feedback: DashboardTesterFeedback[];
  canApprove: boolean;
  canResendInvitation: boolean;
  platformLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState<DashboardOwnerTester | null>(null);
  const [isConfirming, startConfirming] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
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
        const result = await resendTesterInvitation(requestId, { ok: false, message: "" }, new FormData());
        setResendMessage(result.message);
      } finally {
        setResendingId(null);
      }
    });
  }

  return (
    <>
      {testers.length > 0 ? (
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
                    <div className="flex flex-wrap justify-end gap-2">
                      <form action={approve}>
                        <SubmitButton
                          size="sm"
                          pendingLabel="Approving…"
                          disabled={isApproved || !canApprove}
                        >
                          Approve
                        </SubmitButton>
                      </form>
                      {!isApproved ? (
                        <DeclineTesterButton requestId={tester.id} />
                      ) : null}
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
                          disabled={!isApproved || hasJoined || !canResendInvitation}
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
      ) : null}
      {!canApprove && testers.some((tester) => tester.status === "pending") ? (
        <p className="mt-2 text-sm text-ink-muted">
          Reopen this listing for testing to approve pending testers.
        </p>
      ) : null}
      {resendMessage ? <p className="mt-2 text-sm text-ink-muted" role="status">{resendMessage}</p> : null}

      {history.length > 0 ? (
        <section className="mt-5 rounded-xl border-2 border-line bg-paper-muted p-4">
          <h3 className="font-display font-bold">Tester history</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                <span><Link href={profilePath(row.tester.profileSlug)} className="font-semibold underline">{row.tester.displayName}</Link> · {row.withdrawnAt ? "Withdrew" : row.status === "rejected" ? "Declined" : "Expired"}</span>
                {row.status === "rejected" ? (
                  <form action={undoTesterRequestDecline.bind(null, row.id)}>
                    <SubmitButton size="sm" variant="secondary" pendingLabel="Restoring…" disabled={!canApprove}>
                      Undo decline
                    </SubmitButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {!canApprove && history.some((row) => row.status === "rejected") ? (
            <p className="mt-2 text-sm text-ink-muted">
              Reopen this listing for testing to restore declined requests.
            </p>
          ) : null}
        </section>
      ) : null}

      {activity.length > 0 ? (
        <section className="mt-5 rounded-xl border-2 border-line bg-paper-muted p-4">
          <h3 className="font-display font-bold">Recent activity</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            {activity.map((event) => (
              <li key={event.id}><Link href={profilePath(event.tester.profileSlug)} className="font-semibold text-ink underline">{event.tester.displayName}</Link> · {activityLabel(event.type)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {feedback.length > 0 ? (
        <section className="mt-5 rounded-xl border-2 border-line bg-paper-muted p-4">
          <h3 className="font-display font-bold">Private tester feedback</h3>
          <ul className="mt-3 space-y-3">
            {feedback.map((item) => (
              <li key={item.id} className="rounded-lg border-2 border-line bg-paper p-3 text-sm">
                <p><Badge variant="dark" size="sm">{item.severity}</Badge> <span className="ml-2 font-semibold">{item.title}</span></p>
                <p className="mt-2 whitespace-pre-wrap text-ink-muted">{item.details}</p>
                {item.steps ? <p className="mt-2 whitespace-pre-wrap text-ink-muted"><span className="font-semibold text-ink">Steps:</span> {item.steps}</p> : null}
                {item.device ? <p className="mt-2 text-ink-muted"><span className="font-semibold text-ink">Device:</span> {item.device}</p> : null}
                <form action={updateTesterFeedbackStatus.bind(null, item.id)} className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="font-semibold text-ink" htmlFor={`feedback-status-${item.id}`}>Status</label>
                  <select id={`feedback-status-${item.id}`} name="status" defaultValue={item.status} className="h-9 rounded-lg border-2 border-ink bg-paper px-2 text-sm">
                    <option value="unresolved">Unresolved</option>
                    <option value="fixed">Fixed</option>
                    <option value="skipped">Skipped</option>
                  </select>
                  <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">Save</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[min(32rem,calc(100%-2rem))] rounded-2xl border-2 border-ink bg-paper p-0 text-ink shadow-brutal backdrop:bg-ink/50"
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

function activityLabel(type: DashboardTesterActivity["type"]) {
  return ({ requested: "requested to test", approved: "was approved", invitation_resent: "was sent an invitation", joined: "joined the track", completed: "completed testing", withdrew: "withdrew", declined: "was declined", decline_reversed: "was restored to pending" } as const)[type];
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
