export const TESTER_SLOT_MAX = 14;

export type AppDeveloper = {
  displayName: string;
  imageUrl: string | null;
  profileHref: string;
};

export type App = {
  id: string | number;
  name: string;
  category: string;
  platform: string;
  testers: number;
  logoUrl?: string;
  href?: string;
  developer?: AppDeveloper;
};

export const categoryLabel: Record<string, string> = {
  game: "Game",
  utility: "Utility",
  productivity: "Productivity",
};

export const platformLabel: Record<string, string> = {
  android: "Android",
  ios: "iOS",
};

export function profilePath(githubUsername: string) {
  return `/dev/${encodeURIComponent(githubUsername)}`;
}

export function appPath(id: string) {
  return `/apps/${id}`;
}

export const statusLabel: Record<string, string> = {
  draft: "Draft",
  open_for_testing: "Open for testing",
  closed_for_testing: "Closed for testing",
  testing_complete: "Testing complete",
  launched: "Launched",
};

