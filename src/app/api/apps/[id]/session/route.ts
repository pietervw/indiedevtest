import { NextResponse } from "next/server";
import { getOptionalDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { expirePendingTesterRequests, openTesterRequestWhere } from "@/lib/expire-pending-tester-requests";
import {
  COUNTED_ASSIGNMENT_STATUSES,
  isCountedAssignmentStatus,
  isPublicListingStatus,
  isReviewableListingStatus,
} from "@/lib/listing-status";
import type { ListingSessionPayload } from "@/lib/listing-session";

type Props = { params: Promise<{ id: string }> };

const emptySession: ListingSessionPayload = {
  viewerId: null,
  isOwner: false,
  viewerRequestStatus: null,
  canWriteReview: false,
  hasWrittenReview: false,
  pendingRequests: [],
  acceptedRequests: [],
  assignments: [],
};

const testerSelect = {
  displayName: true,
  githubUsername: true,
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

  // Anonymous visitors need no DB work — public shell already has listing data.
  const viewer = await getOptionalDbUser();
  if (!viewer) {
    return NextResponse.json(emptySession);
  }

  const listing = await prisma.appListing.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });

  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = viewer.id === listing.userId;
  // Match /apps/[id]: non-owners must not learn that a draft (or other
  // non-public) listing id exists.
  if (!isOwner && !isPublicListingStatus(listing.status)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await expirePendingTesterRequests({ listingId: listing.id });

  const reviewListingOpen = isReviewableListingStatus(listing.status);
  const now = new Date();

  const [viewerRequest, assignment, existingReview, ownerRequests, assignments] =
    await Promise.all([
      !isOwner
        ? prisma.testerRequest.findUnique({
            where: {
              appListingId_testerUserId: {
                appListingId: listing.id,
                testerUserId: viewer.id,
              },
            },
            select: { status: true },
          })
        : null,
      !isOwner && reviewListingOpen
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
      !isOwner && reviewListingOpen
        ? prisma.review.findUnique({
            where: {
              appListingId_testerUserId: {
                appListingId: listing.id,
                testerUserId: viewer.id,
              },
            },
            select: { id: true },
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
            include: { tester: { select: testerSelect } },
            orderBy: { joinedAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

  const hasWrittenReview = Boolean(existingReview);
  const canWriteReview =
    !isOwner &&
    reviewListingOpen &&
    !hasWrittenReview &&
    Boolean(assignment && isCountedAssignmentStatus(assignment.status));

  const pendingRequests = ownerRequests.filter((req) => req.status === "pending");
  const acceptedRequests = ownerRequests.filter(
    (req) => req.status === "accepted" && req.testAssignmentId == null
  );

  const payload: ListingSessionPayload = {
    viewerId: viewer.id,
    isOwner,
    viewerRequestStatus: viewerRequest?.status ?? null,
    canWriteReview,
    hasWrittenReview,
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
      tester: row.tester,
    })),
  };

  return NextResponse.json(payload);
}
