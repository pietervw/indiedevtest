export const TESTER_SLOT_MAX = 14;

export type App = {
  id: number;
  name: string;
  category: string;
  platform: string;
  testers: number;
};

export const mockApps: App[] = [
  {
    id: 1,
    name: "TaskMaster Pro",
    category: "Productivity",
    platform: "Android",
    testers: 8,
  },
  {
    id: 2,
    name: "HabitQuest",
    category: "Game",
    platform: "iOS",
    testers: 3,
  },
  {
    id: 3,
    name: "MeditateDaily",
    category: "Utility",
    platform: "Android",
    testers: 11,
  },
  {
    id: 4,
    name: "FitTrack",
    category: "Health",
    platform: "iOS",
    testers: 6,
  },
  {
    id: 5,
    name: "BudgetBuddy",
    category: "Finance",
    platform: "Android",
    testers: 9,
  },
];
