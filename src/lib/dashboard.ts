import type {
  AppCategory,
  AppListingStatus,
  Platform,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";
import {
  expirePendingTesterRequests,
  openTesterRequestWhere,
} from "@/lib/expire-pending-tester-requests";
import { testingPeriodProgress } from "@/lib/mock-data";
import { isHttpUrl } from "@/lib/validation";

export type DashboardListing = {
  id: string;
  name: string;
  logoUrl: string;
  category: AppCategory;
  platform: Platform;
  status: AppListingStatus;
  testerCapacity: number | null;
  pendingRequestCount: number;
  acceptedTesterCount: number;
  joinedTesterCount: number;
  completedTesterCount: number;
  remainingTesterSpots: number | null;
  testerRequests: DashboardOwnerTester[];
};

/** Active tester pipeline row, visible only to the listing owner. */
export type DashboardOwnerTester = {
  id: string;
  status: "pending" | "accepted";
  testerEmail: string;
  tester: {
    displayName: string;
    imageUrl: string | null;
    profileSlug: string;
  };
  assignmentStatus: "active" | "completed" | "incomplete" | "cancelled" | null;
};

type DashboardListingRef = {
  id: string;
  name: string;
  logoUrl: string;
  platform: Platform;
};

type DashboardAssignmentListingRef = {
  id: string;
  name: string;
  logoUrl: string;
};

export type DashboardTesterInvitation = {
  testingAccessUrl: string | null;
  testerInstructions: string | null;
  developerContactEmail: string | null;
};

/** Pending or accepted-awaiting-join request row for the activity list. */
export type DashboardRequestItem = {
  id: string;
  listing: DashboardListingRef;
};

export type DashboardAcceptedRequest = DashboardRequestItem & {
  invitation: DashboardTesterInvitation;
};

/** A request received by one of the user's own listings. */
export type DashboardIncomingRequest = {
  id: string;
  listing: DashboardListingRef;
  testerEmail: string;
  tester: {
    displayName: string;
    imageUrl: string | null;
    profileSlug: string;
  };
};

export type DashboardActiveAssignment = {
  id: string;
  platform: Platform;
  daysRemainingLabel: string | null;
  listing: DashboardAssignmentListingRef;
  invitation: DashboardTesterInvitation;
};

/** Completed or incomplete assignment row for the activity list. */
export type DashboardPastAssignment = {
  id: string;
  platform: Platform;
  listing: DashboardAssignmentListingRef;
};

export type DashboardData = {
  listings: DashboardListing[];
  incomingRequests: DashboardIncomingRequest[];
  pendingRequests: DashboardRequestItem[];
  acceptedAwaitingJoin: DashboardAcceptedRequest[];
  activeAssignments: DashboardActiveAssignment[];
  completedAssignments: DashboardPastAssignment[];
  incompleteAssignments: DashboardPastAssignment[];
};

const EMPTY_DASHBOARD: DashboardData = {
  listings: [],
  incomingRequests: [],
  pendingRequests: [],
  acceptedAwaitingJoin: [],
  activeAssignments: [],
  completedAssignments: [],
  incompleteAssignments: [],
};

const listingSummarySelect = {
  id: true,
  name: true,
  logoUrl: true,
  platform: true,
} as const;

const testerSelect = {
  displayName: true,
  imageUrl: true,
  profileSlug: true,
} as const;

const testerListingSelect = {
  ...listingSummarySelect,
  testingAccessUrl: true,
  testerInstructions: true,
  user: { select: { contactEmail: true } },
} as const;

function testerInvitation(listing: {
  testingAccessUrl: string | null;
  testerInstructions: string | null;
  user: { contactEmail: string | null };
}): DashboardTesterInvitation {
  return {
    testingAccessUrl:
      listing.testingAccessUrl && isHttpUrl(listing.testingAccessUrl)
        ? listing.testingAccessUrl
        : null,
    testerInstructions: listing.testerInstructions,
    developerContactEmail: listing.user.contactEmail,
  };
}

/**
 * Private activity centre payload for the signed-in user. Tester contact email
 * is selected only for the owner of the listing that received the request.
 */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  if (!process.env.DATABASE_URL) {
    return EMPTY_DASHBOARD;
  }

  // Cover the user's own pending requests and pending queues on owned listings.
  await expirePendingTesterRequests({
    testerUserId: userId,
    ownerUserId: userId,
  });

  const now = new Date();

  const [listings, incomingRequests, testerRequests, assignments] = await Promise.all([
    prisma.appListing.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        category: true,
        platform: true,
        status: true,
        testerCapacity: true,
        testerRequests: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
            testerEmail: true,
            tester: { select: testerSelect },
            testAssignment: { select: { status: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        testAssignments: { select: { status: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.testerRequest.findMany({
      where: {
        status: "pending",
        expiresAt: { gt: now },
        appListing: { userId },
      },
      select: {
        id: true,
        testerEmail: true,
        tester: { select: testerSelect },
        appListing: { select: listingSummarySelect },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.testerRequest.findMany({
      where: {
        testerUserId: userId,
        ...openTesterRequestWhere(now),
      },
      select: {
        id: true,
        status: true,
        testAssignmentId: true,
        appListing: { select: testerListingSelect },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.testAssignment.findMany({
      where: {
        testerUserId: userId,
        status: { in: ["active", "completed", "incomplete"] },
      },
      select: {
        id: true,
        status: true,
        platform: true,
        joinedAt: true,
        appListing: { select: testerListingSelect },
      },
      orderBy: { joinedAt: "desc" },
    }),
  ]);

  const pendingRequests: DashboardRequestItem[] = [];
  const acceptedAwaitingJoin: DashboardAcceptedRequest[] = [];

  for (const request of testerRequests) {
    const listing = {
      id: request.appListing.id,
      name: request.appListing.name,
      logoUrl: request.appListing.logoUrl.trim(),
      platform: request.appListing.platform,
    };
    if (request.status === "pending") {
      pendingRequests.push({ id: request.id, listing });
    } else if (
      request.status === "accepted" &&
      request.testAssignmentId == null
    ) {
      acceptedAwaitingJoin.push({
        id: request.id,
        listing,
        invitation: testerInvitation(request.appListing),
      });
    }
  }

  const activeAssignments: DashboardActiveAssignment[] = [];
  const completedAssignments: DashboardPastAssignment[] = [];
  const incompleteAssignments: DashboardPastAssignment[] = [];

  for (const row of assignments) {
    const listing = {
      id: row.appListing.id,
      name: row.appListing.name,
      logoUrl: row.appListing.logoUrl.trim(),
    };
    if (row.status === "active") {
      const progress = testingPeriodProgress(row.joinedAt, row.platform);
      activeAssignments.push({
        id: row.id,
        platform: row.platform,
        daysRemainingLabel: progress.label,
        listing,
        invitation: testerInvitation(row.appListing),
      });
    } else if (row.status === "completed") {
      completedAssignments.push({
        id: row.id,
        platform: row.platform,
        listing,
      });
    } else if (row.status === "incomplete") {
      incompleteAssignments.push({
        id: row.id,
        platform: row.platform,
        listing,
      });
    }
  }

  return {
    listings: listings.map((listing) => {
      const pendingRequestCount = listing.testerRequests.filter(
        (request) => request.status === "pending" && request.expiresAt > now
      ).length;
      // Accepted requests consume capacity, including testers who have since
      // been confirmed joined or completed.
      const acceptedTesterCount = listing.testerRequests.filter(
        (request) => request.status === "accepted"
      ).length;
      const joinedTesterCount = listing.testAssignments.length;
      const completedTesterCount = listing.testAssignments.filter(
        (assignment) => assignment.status === "completed"
      ).length;
      return {
        id: listing.id,
        name: listing.name,
        logoUrl: listing.logoUrl.trim(),
        category: listing.category,
        platform: listing.platform,
        status: listing.status,
        testerCapacity: listing.testerCapacity,
        pendingRequestCount,
        acceptedTesterCount,
        joinedTesterCount,
        completedTesterCount,
        remainingTesterSpots:
          listing.testerCapacity === null
            ? null
            : Math.max(0, listing.testerCapacity - acceptedTesterCount),
        testerRequests: listing.testerRequests
          .filter(
            (request) =>
              request.status === "accepted" ||
              (request.status === "pending" && request.expiresAt > now)
          )
          .map((request) => ({
            id: request.id,
            status: request.status as "pending" | "accepted",
            testerEmail: request.testerEmail,
            tester: request.tester,
            assignmentStatus: request.testAssignment?.status ?? null,
          })),
      };
    }),
    incomingRequests: incomingRequests.map((request) => ({
      id: request.id,
      testerEmail: request.testerEmail,
      tester: request.tester,
      listing: {
        id: request.appListing.id,
        name: request.appListing.name,
        logoUrl: request.appListing.logoUrl.trim(),
        platform: request.appListing.platform,
      },
    })),
    pendingRequests,
    acceptedAwaitingJoin,
    activeAssignments,
    completedAssignments,
    incompleteAssignments,
  };
}
