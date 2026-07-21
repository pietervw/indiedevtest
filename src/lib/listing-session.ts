export type ListingSessionPayload = {
  viewerId: string | null;
  /** Whether the signed-in viewer has a saved private testing contact email. */
  viewerHasContactEmail: boolean;
  isOwner: boolean;
  /** Owner-only flag for whether an invitation can be resent. */
  ownerHasPrivateInvitation: boolean;
  viewerRequestStatus: "pending" | "accepted" | "rejected" | "expired" | null;
  /** True once the owner confirmed the tester joined (assignment linked). */
  viewerHasJoined: boolean;
  /** Private invitation details for an accepted tester only. */
  viewerInvitation: {
    testingAccessUrl: string | null;
    testerInstructions: string | null;
    developerContactEmail: string | null;
  } | null;
  /** Confirmed tester may write a review (joined + listing open/closed + none yet). */
  canWriteReview: boolean;
  hasWrittenReview: boolean;
  pendingRequests: {
    id: string;
    testerEmail: string;
    tester: {
      displayName: string;
        profileSlug: string;
      imageUrl: string | null;
    };
  }[];
  acceptedRequests: {
    id: string;
    testerEmail: string;
    tester: {
      displayName: string;
        profileSlug: string;
      imageUrl: string | null;
    };
  }[];
  assignments: {
    id: string;
    status: "active" | "completed";
    platform: "android" | "ios";
    joinedAt: string;
    completedAt: string | null;
    tester: {
      displayName: string;
        profileSlug: string;
      imageUrl: string | null;
    };
  }[];
};
