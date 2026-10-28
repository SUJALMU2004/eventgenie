import type { EventType, Priority } from "@/schemas/event";

export type BudgetCategory = { id: Priority; label: string; weight: number };
export type TaskTemplate = {
  title: string;
  description: string;
  daysBefore: number;
  category: Priority;
};
export const eventLabels: Record<EventType, string> = {
  wedding: "Wedding",
  birthday: "Birthday",
  community: "Community event",
};
export const eventDescriptions: Record<EventType, string> = {
  wedding: "A beautiful beginning, thoughtfully planned.",
  birthday: "Another year. A moment worth making.",
  community: "Bring people together. Make something special.",
};

export const budgetCategories: Record<EventType, readonly BudgetCategory[]> = {
  wedding: [
    { id: "venue", label: "Venue", weight: 20 },
    { id: "catering", label: "Catering", weight: 30 },
    { id: "decor", label: "Decoration", weight: 12 },
    { id: "photography", label: "Photography", weight: 12 },
    { id: "entertainment", label: "Entertainment", weight: 6 },
    { id: "clothing", label: "Clothing & miscellaneous", weight: 10 },
  ],
  birthday: [
    { id: "venue", label: "Venue", weight: 15 },
    { id: "catering", label: "Food & drinks", weight: 25 },
    { id: "decor", label: "Decoration", weight: 12 },
    { id: "cake", label: "Cake", weight: 10 },
    { id: "entertainment", label: "Entertainment", weight: 18 },
    { id: "photography", label: "Photography", weight: 10 },
  ],
  community: [
    { id: "venue", label: "Venue & infrastructure", weight: 25 },
    { id: "catering", label: "Food & refreshments", weight: 20 },
    { id: "av", label: "Audio / visual", weight: 15 },
    { id: "logistics", label: "Logistics", weight: 12 },
    { id: "activities", label: "Activities", weight: 10 },
    { id: "safety", label: "Safety & support", weight: 8 },
  ],
};

export const vendorTemplates: Record<
  EventType,
  readonly { category: string; purpose: string; questions: string[] }[]
> = {
  wedding: [
    {
      category: "Wedding venue",
      purpose: "Space for ceremonies and reception",
      questions: [
        "Which ceremony spaces and accessible facilities are included?",
        "What is the cancellation policy?",
      ],
    },
    {
      category: "Wedding caterer",
      purpose: "Meals aligned with dietary and cultural preferences",
      questions: [
        "Can you provide a tasting and allergen information?",
        "Are service and cleanup included?",
      ],
    },
    {
      category: "Wedding photographer",
      purpose: "Document the ceremonies and family moments",
      questions: ["What coverage hours and delivery schedule are included?"],
    },
    {
      category: "Florist & decorator",
      purpose: "Reusable ceremony and reception decor",
      questions: ["Can decor be reused between ceremonies?"],
    },
  ],
  birthday: [
    {
      category: "Cake baker",
      purpose: "An occasion cake with clear portions and ingredients",
      questions: [
        "How many portions and which allergens?",
        "Is safe delivery included?",
      ],
    },
    {
      category: "Party caterer",
      purpose: "Easy-to-serve food and drinks",
      questions: ["Are dietary options and serving equipment included?"],
    },
    {
      category: "Activity host",
      purpose: "Age-appropriate games and entertainment",
      questions: ["Can activities accommodate different ages and abilities?"],
    },
    {
      category: "Party venue",
      purpose: "A comfortable space for the celebration",
      questions: ["What setup time and noise restrictions apply?"],
    },
  ],
  community: [
    {
      category: "Community venue",
      purpose: "Accessible gathering space and infrastructure",
      questions: ["What permissions, capacity and access arrangements apply?"],
    },
    {
      category: "AV supplier",
      purpose: "Clear announcements and reliable sound",
      questions: ["Is a technician and backup power plan included?"],
    },
    {
      category: "Refreshment supplier",
      purpose: "Safe, labelled food and drinking water",
      questions: ["How will allergens, waste and water be managed?"],
    },
    {
      category: "Safety support",
      purpose: "First aid and an inclusive safety plan",
      questions: ["Who is responsible for first aid and emergency access?"],
    },
  ],
};

const commonTasks: TaskTemplate[] = [
  {
    title: "Set the spending priorities",
    description: "Review the allocation together and protect the contingency.",
    daysBefore: 90,
    category: "venue",
  },
  {
    title: "Confirm the guest estimate",
    description: "Choose a realistic headcount before requesting quotes.",
    daysBefore: 75,
    category: "catering",
  },
  {
    title: "Shortlist an accessible venue",
    description: "Check capacity, step-free access, toilets and travel.",
    daysBefore: 70,
    category: "venue",
  },
  {
    title: "Compare written supplier quotes",
    description: "Ask for itemised inclusions, taxes and cancellation terms.",
    daysBefore: 60,
    category: "logistics",
  },
  {
    title: "Choose the menu",
    description: "Include dietary choices and clear allergen labels.",
    daysBefore: 40,
    category: "catering",
  },
  {
    title: "Prepare invitation wording",
    description:
      "Include date, location and accessibility contact instructions.",
    daysBefore: 30,
    category: "activities",
  },
  {
    title: "Plan reusable decorations",
    description: "Focus on one welcoming focal point to keep costs manageable.",
    daysBefore: 25,
    category: "decor",
  },
  {
    title: "Confirm supplier arrangements",
    description: "Record arrival windows and agree responsibilities.",
    daysBefore: 14,
    category: "logistics",
  },
  {
    title: "Check the final headcount",
    description: "Confirm meal numbers and dietary needs.",
    daysBefore: 7,
    category: "catering",
  },
  {
    title: "Walk through the event schedule",
    description: "Share a concise running order with helpers.",
    daysBefore: 2,
    category: "activities",
  },
  {
    title: "Pack the essentials",
    description: "Bring water, signage, supplies and a simple first-aid kit.",
    daysBefore: 1,
    category: "safety",
  },
  {
    title: "Celebrate and check the space",
    description: "Welcome guests and keep walkways clear throughout.",
    daysBefore: 0,
    category: "venue",
  },
];
export const taskTemplates: Record<EventType, readonly TaskTemplate[]> = {
  wedding: [
    ...commonTasks,
    {
      title: "Agree the wedding ceremony sequence",
      description:
        "Coordinate traditions and timings with the couple and families.",
      daysBefore: 65,
      category: "activities",
    },
    {
      title: "Brief the wedding photographer",
      description:
        "Share the ceremony schedule and essential family photographs.",
      daysBefore: 20,
      category: "photography",
    },
    {
      title: "Arrange wedding outfits and fittings",
      description: "Allow time for alterations and comfortable footwear.",
      daysBefore: 45,
      category: "clothing",
    },
  ],
  birthday: [
    ...commonTasks,
    {
      title: "Order the birthday cake",
      description: "Confirm portions, flavours, allergens and delivery time.",
      daysBefore: 15,
      category: "cake",
    },
    {
      title: "Choose birthday games",
      description: "Match games to the celebrant's interests and guest ages.",
      daysBefore: 20,
      category: "entertainment",
    },
    {
      title: "Prepare the birthday moment",
      description: "Agree a time for cake, candles and a short toast.",
      daysBefore: 3,
      category: "cake",
    },
  ],
  community: [
    ...commonTasks,
    {
      title: "Check community event permissions",
      description:
        "Ask the venue or local authority which permissions apply; requirements vary.",
      daysBefore: 65,
      category: "logistics",
    },
    {
      title: "Assign volunteer roles",
      description:
        "Cover welcome, accessible seating, refreshments and cleanup.",
      daysBefore: 21,
      category: "activities",
    },
    {
      title: "Review accessibility and safety",
      description:
        "Confirm first aid, emergency access, signage and quiet seating.",
      daysBefore: 10,
      category: "safety",
    },
  ],
};
