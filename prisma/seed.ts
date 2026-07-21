import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  PrismaClient,
  type AppCategory,
  type Platform,
} from "../src/generated/prisma";

config({ path: ".env.local" });
config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

type SeedUser = {
  clerkId: string;
  githubId: string;
  githubUsername: string;
  displayName: string;
  imageUrl: string;
  bio: string;
  twitterHandle: string;
  profileScoreJoined: number;
  profileScoreCompleted: number;
  reviewsWrittenCount: number;
};

type SeedApp = {
  ownerUsername: string;
  name: string;
  logoUrl: string;
  description: string;
  category: AppCategory;
  platform: Platform;
  testerUsernames: string[];
};

const users: SeedUser[] = [
  {
    clerkId: "seed_clerk_mira",
    githubId: "900001",
    githubUsername: "mira-codes",
    displayName: "Mira Chen",
    imageUrl: "https://api.dicebear.com/9.x/thumbs/png?seed=mira-codes&size=128",
    bio: "Building cozy habit games. Always happy to swap 14-day tests.",
    twitterHandle: "mira_codes",
    profileScoreJoined: 6,
    profileScoreCompleted: 4,
    reviewsWrittenCount: 3,
  },
  {
    clerkId: "seed_clerk_jonas",
    githubId: "900002",
    githubUsername: "jonasbuild",
    displayName: "Jonas Park",
    imageUrl: "https://api.dicebear.com/9.x/thumbs/png?seed=jonasbuild&size=128",
    bio: "Productivity tools for indie builders. Android-first.",
    twitterHandle: "jonasbuild",
    profileScoreJoined: 9,
    profileScoreCompleted: 7,
    reviewsWrittenCount: 5,
  },
  {
    clerkId: "seed_clerk_sofia",
    githubId: "900003",
    githubUsername: "sofiawaves",
    displayName: "Sofia Reyes",
    imageUrl: "https://api.dicebear.com/9.x/thumbs/png?seed=sofiawaves&size=128",
    bio: "Focus timers, calm UI, and ocean sounds.",
    twitterHandle: "sofiawaves",
    profileScoreJoined: 4,
    profileScoreCompleted: 2,
    reviewsWrittenCount: 1,
  },
  {
    clerkId: "seed_clerk_devon",
    githubId: "900004",
    githubUsername: "devonship",
    displayName: "Devon Blake",
    imageUrl: "https://api.dicebear.com/9.x/thumbs/png?seed=devonship&size=128",
    bio: "Pixel farms and tiny games. Shipping slowly on purpose.",
    twitterHandle: "devonship",
    profileScoreJoined: 11,
    profileScoreCompleted: 8,
    reviewsWrittenCount: 6,
  },
  {
    clerkId: "seed_clerk_aisha",
    githubId: "900005",
    githubUsername: "aisha-makes",
    displayName: "Aisha Okonkwo",
    imageUrl: "https://api.dicebear.com/9.x/thumbs/png?seed=aisha-makes&size=128",
    bio: "One-task focus apps. Looking for thoughtful testers.",
    twitterHandle: "aisha_makes",
    profileScoreJoined: 5,
    profileScoreCompleted: 3,
    reviewsWrittenCount: 2,
  },
];

const apps: SeedApp[] = [
  {
    ownerUsername: "mira-codes",
    name: "HabitQuest",
    logoUrl: "https://api.dicebear.com/9.x/shapes/png?seed=HabitQuest&size=128",
    description:
      "Turn daily habits into a cozy RPG. Looking for Android/iOS testers who will keep the app installed for 14 days and note any quest-reset bugs.",
    category: "game",
    platform: "ios",
    testerUsernames: ["jonasbuild", "sofiawaves", "devonship"],
  },
  {
    ownerUsername: "jonasbuild",
    name: "TaskForge",
    logoUrl: "https://api.dicebear.com/9.x/shapes/png?seed=TaskForge&size=128",
    description:
      "A brutalist to-do list for indie builders. Need testers to stress widget sync, offline mode, and the weekly review flow on a real device.",
    category: "productivity",
    platform: "android",
    testerUsernames: ["mira-codes", "aisha-makes", "devonship", "sofiawaves"],
  },
  {
    ownerUsername: "sofiawaves",
    name: "TideTimer",
    logoUrl: "https://api.dicebear.com/9.x/shapes/png?seed=TideTimer&size=128",
    description:
      "Pomodoro sessions that breathe like the ocean. Testers wanted for focus sounds, notification reliability, and dark-mode contrast checks.",
    category: "utility",
    platform: "ios",
    testerUsernames: ["mira-codes", "jonasbuild"],
  },
  {
    ownerUsername: "devonship",
    name: "PixelRanch",
    logoUrl: "https://api.dicebear.com/9.x/shapes/png?seed=PixelRanch&size=128",
    description:
      "A tiny pixel farm you check once a day. Need closed-testers to verify save integrity, cloud sync, and whether watering reminders actually fire.",
    category: "game",
    platform: "android",
    testerUsernames: ["aisha-makes", "jonasbuild", "mira-codes", "sofiawaves"],
  },
  {
    ownerUsername: "aisha-makes",
    name: "FocusLane",
    logoUrl: "https://api.dicebear.com/9.x/shapes/png?seed=FocusLane&size=128",
    description:
      "One lane. One task. No clutter. Looking for fellow indie testers to try deep-work mode and report any keyboard/IME glitches on mid-range phones.",
    category: "productivity",
    platform: "ios",
    testerUsernames: ["devonship", "jonasbuild", "mira-codes"],
  },
];

async function main() {
  console.log("Seeding community users + apps…");

  const userByUsername = new Map<string, string>();

  for (const user of users) {
    const row = await prisma.user.upsert({
      where: { githubUsername: user.githubUsername },
      create: {
        ...user,
        profileSlug: `seed-${user.githubUsername}`,
        onboardingCompletedAt: new Date(),
        profileCompletedAt: new Date(),
      },
      update: {
        displayName: user.displayName,
        imageUrl: user.imageUrl,
        bio: user.bio,
        twitterHandle: user.twitterHandle,
        profileScoreJoined: user.profileScoreJoined,
        profileScoreCompleted: user.profileScoreCompleted,
        reviewsWrittenCount: user.reviewsWrittenCount,
        onboardingCompletedAt: new Date(),
        profileCompletedAt: new Date(),
      },
    });
    userByUsername.set(user.githubUsername, row.id);
    console.log(`  user @${user.githubUsername}`);
  }

  for (const app of apps) {
    const ownerId = userByUsername.get(app.ownerUsername);
    if (!ownerId) {
      throw new Error(`Missing owner ${app.ownerUsername}`);
    }

    const existing = await prisma.appListing.findFirst({
      where: { userId: ownerId, name: app.name },
    });

    const listing = existing
      ? await prisma.appListing.update({
          where: { id: existing.id },
          data: {
            logoUrl: app.logoUrl,
            description: app.description,
            category: app.category,
            platform: app.platform,
            status: "open_for_testing",
          },
        })
      : await prisma.appListing.create({
          data: {
            userId: ownerId,
            name: app.name,
            logoUrl: app.logoUrl,
            description: app.description,
            category: app.category,
            platform: app.platform,
            status: "open_for_testing",
          },
        });

    for (const testerUsername of app.testerUsernames) {
      const testerId = userByUsername.get(testerUsername);
      if (!testerId || testerId === ownerId) continue;

      await prisma.testAssignment.upsert({
        where: {
          appListingId_testerUserId: {
            appListingId: listing.id,
            testerUserId: testerId,
          },
        },
        create: {
          appListingId: listing.id,
          testerUserId: testerId,
          platform: app.platform,
          joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
          status: "active",
        },
        update: {
          status: "active",
          platform: app.platform,
        },
      });
    }

    console.log(`  app ${app.name} (@${app.ownerUsername})`);
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
