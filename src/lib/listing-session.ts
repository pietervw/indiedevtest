export type ListingSessionPayload = {
  viewerId: string | null;
  isOwner: boolean;
  viewerRequestStatus: "pending" | "accepted" | "rejected" | "expired" | null;
  /** Confirmed tester may write a review (joined + listing open/closed + none yet). */
  canWriteReview: boolean;
  hasWrittenReview: boolean;
  pendingRequests: {
    id: string;
    testerEmail: string;
    tester: {
      displayName: string;
      githubUsername: string;
      imageUrl: string | null;
    };
  }[];
  acceptedRequests: {
    id: string;
    testerEmail: string;
    tester: {
      displayName: string;
      githubUsername: string;
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
      githubUsername: string;
      imageUrl: string | null;
    };
  }[];
};
