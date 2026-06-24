export type Day =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type WeekTimes = {
  [K in Day]: string[]; // multiple times per day
};

export type ClassSchedule = {
  id: number;
  slug: string;
  name: string;
  schedule: WeekTimes[]; // keep as array of week entries if needed
};

export const schedule: ClassSchedule[] = [
  {
    id: 1,
    name: "Me + 1 (2yr)",
    slug: "me-1-2yr",
    schedule: [
      {
        monday: ["—"],
        tuesday: ["6:00 PM - 6:30 PM"],
        wednesday: ["—"],
        thursday: ["—"],
        friday: ["—"],
        saturday: ["—"],
        sunday: ["—"],
      },
    ],
  },
  {
    id: 2,
    name: "Me + 1 (3-4yr)",
    slug: "me-1-3-4yr",
    schedule: [
      {
        monday: ["—"],
        tuesday: ["4:30 PM - 5:00 PM"],
        wednesday: ["—"],
        thursday: ["—"],
        friday: ["—"],
        saturday: ["—"],
        sunday: ["—"],
      },
    ],
  },
  {
    id: 3,
    name: "Preschool",
    slug: "preschool",
    schedule: [
      {
        monday: ["—"],
        tuesday: ["5:05 PM - 5:45 PM"],
        wednesday: ["—"],
        thursday: ["—"],
        friday: ["—"],
        saturday: ["—"],
        sunday: ["—"],
      },
    ],
  },
  {
    id: 4,
    name: "Beginner / Level 1",
    slug: "beginner-level-1",
    schedule: [
      {
        monday: ["4:45 PM - 5:40 PM", "5:45 PM - 6:40 PM"],
        tuesday: ["3:45 PM - 4:40 PM", "5:45 PM - 6:40 PM"],
        wednesday: ["—"],
        thursday: ["—"],
        friday: ["—"],
        saturday: ["—"],
        sunday: ["—"],
      },
    ],
  },
  { 
    id: 5,
    name: "Adv. Beginner / Level 1.5",
    slug: "adv-beginner-level-1-5",
    schedule: [
      {
        monday: ["3:45 PM — 4:40 PM", "5:45 PM - 6:40 PM"],
        tuesday: ["—"],
        wednesday: ["5:00 PM - 5:55 PM"],
        thursday: ["—"],
        friday: ["—"],
        saturday: ["—"],
        sunday: ["—"],
      },
    ],
  },
  {
    id: 6,
    name: "Intermediate / Level 2",
    slug: "intermediate-level-2",
    schedule: [
      {
        monday: ["4:45 PM - 5:40 PM"],
        tuesday: ["4:45 PM - 5:40 PM"],
        wednesday: ["5:00 PM - 5:55 PM"],
        thursday: ["—"],
        friday: ["—"],
        saturday: ["—"],
        sunday: ["—"],
      },
    ],
  },
  {
    id: 7,
    name: "Advanced / Level 3",
    slug: "advanced-level-3",
    schedule: [
      {
        monday: ["4:45 PM - 5:40 PM"],
        tuesday: ["-"],
        wednesday: ["5:00 PM - 5:55 PM"],
        thursday: ["—"],
        friday: ["—"],
        saturday: ["—"],
        sunday: ["—"],
      },
    ],
  },
  {
    id: 8,
    name: "Elite / Level 4",
    slug: "elite-level-4",
    schedule: [
      {
        monday: ["—"],
        tuesday: ["—"],
        wednesday: ["6:00 PM - 6:55 PM"],
        thursday: ["—"],
        friday: ["—"],
        saturday: ["—"],
        sunday: ["—"],
      },
    ],
  },
];

export function getClassSchedule(slug: string) {
  return schedule.find((m) => m.slug === slug);
}