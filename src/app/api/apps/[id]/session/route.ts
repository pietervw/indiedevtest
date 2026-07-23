import { NextResponse } from "next/server";
import { getOptionalDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { expirePendingTesterRequests, openTesterRequestWhere } from "@/lib/expire-pending-tester-requests";
import {
  COUNTED_ASSIGNMENT_STATUSES,
  isEvidenceEligibleAssignmentStatus,
  isEvidenceOpenListingStatus,
  isPublicListingStatus,
} from "@/lib/listing-status";
import type { ListingSessionPayload } from "@/lib/listing-session";
import { isCompleteEvidence } from "@/lib/test-evidence";
import { isHttpUrl } from "@/lib/validation";

type Props = { params: Promise<{ id: string }> };

const emptySession: ListingSessionPayload = {
  viewerId: null,
  viewerHasContactEmail: false,
  isOwner: false,
  ownerHasPrivateInvitation: false,
  viewerRequestStatus: null,
  viewerHasJoined: false,
  viewerInvitation: null,
  canSubmitEvidence: false,
  canApproveTesters: false,
  pendingRequests: [],
  acceptedRequests: [],
  assignments: [],
};

const testerSelect = {
  displayName: true,
  profileSlug: true,
  imageUrl: true,
} as const;

/**
 * Viewer/owner session data for a listing. Keeps /apps/[id] RSC free of auth()
 * so the public shell can use the memory-cached listing payload.
 */
export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(emptySession);
  }

  const viewer = await getOptionalDbUser();
  if (!viewer) {
    return NextResponse.json(emptySession);
  }

  const listing = await prisma.appListing.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      moderationStatus: true,
      testingAccessUrl: true,
      testerInstructions: true,
      user: { select: { contactEmail: true } },
    },
  });

  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = viewer.id === listing.userId;
  if (
    !isOwner &&
    (!isPublicListingStatus(listing.status) || listing.moderationStatus !== "visible")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const testingAccessUrl =
    listing.testingAccessUrl && isHttpUrl(listing.testingAccessUrl)
      ? listing.testingAccessUrl
      : null;

  await expirePendingTesterRequests({ listingId: listing.id });

  const evidenceListingOpen = isEvidenceOpenListingStatus(listing.status);
  const now = new Date();

  const [viewerRequest, assignment, ownerRequests, assignments] =
    await Promise.all([
      !isOwner
        ? prisma.testerRequest.findUnique({
            where: {
              appListingId_testerUserId: {
                appListingId: listing.id,
                testerUserId: viewer.id,
              },
            },
            select: { status: true, testAssignmentId: true },
          })
        : null,
      !isOwner && evidenceListingOpen
        ? prisma.testAssignment.findUnique({
            where: {
              appListingId_testerUserId: {
                appListingId: listing.id,
                testerUserId: viewer.id,
              },
            },
            select: { status: true },
          })
        : null,
      isOwner
        ? prisma.testerRequest.findMany({
            where: {
              appListingId: listing.id,
              ...openTesterRequestWhere(now),
            },
            include: { tester: { select: testerSelect } },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      isOwner
        ? prisma.testAssignment.findMany({
            where: {
              appListingId: listing.id,
              status: { in: [...COUNTED_ASSIGNMENT_STATUSES] },
            },
            include: {
              tester: { select: testerSelect },
            },
            orderBy: { joinedAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

  const ownerEvidenceByTester =
    isOwner && assignments.length > 0
      ? await prisma.review.findMany({
          where: {
            appListingId: listing.id,
            testerUserId: { in: assignments.map((row) => row.testerUserId) },
          },
          select: {
            testerUserId: true,
            improvementSuggestion: true,
            _count: { select: { screenshots: true } },
          },
        })
      : [];

  const evidenceCompleteByTester = new Map(
    ownerEvidenceByTester.map((row) => [
      row.testerUserId,
      isCompleteEvidence({
        improvementSuggestion: row.improvementSuggestion,
        screenshotCount: row._count.screenshots,
      }),
    ])
  );

  const canSubmitEvidence =
    !isOwner &&
    evidenceListingOpen &&
    Boolean(
      assignment && isEvidenceEligibleAssignmentStatus(assignment.status)
    );

  const pendingRequests = ownerRequests.filter((req) => req.status === "pending");
  const acceptedRequests = ownerRequests.filter(
    (req) => req.status === "accepted" && req.testAssignmentId == null
  );

  const payload: ListingSessionPayload = {
    viewerId: viewer.id,
    viewerHasContactEmail: Boolean(viewer.contactEmail),
    isOwner,
    ownerHasPrivateInvitation:
      isOwner &&
      Boolean(
        testingAccessUrl ||
          listing.testerInstructions ||
          listing.user.contactEmail
      ),
    viewerRequestStatus: viewerRequest?.status ?? null,
    viewerHasJoined: viewerRequest?.testAssignmentId != null,
    viewerInvitation:
      !isOwner && viewerRequest?.status === "accepted"
        ? {
            testingAccessUrl,
            testerInstructions: listing.testerInstructions,
            developerContactEmail: listing.user.contactEmail,
          }
        : null,
    canSubmitEvidence,
    canApproveTesters: listing.status === "open_for_testing",
    pendingRequests: pendingRequests.map((req) => ({
      id: req.id,
      testerEmail: req.testerEmail,
      tester: req.tester,
    })),
    acceptedRequests: acceptedRequests.map((req) => ({
      id: req.id,
      testerEmail: req.testerEmail,
      tester: req.tester,
    })),
    assignments: assignments.map((row) => ({
      id: row.id,
      status: row.status as "active" | "completed",
      platform: row.platform,
      joinedAt: row.joinedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      hasCompleteEvidence: evidenceCompleteByTester.get(row.testerUserId) ?? false,
      tester: row.tester,
    })),
  };

  return NextResponse.json(payload);
}
