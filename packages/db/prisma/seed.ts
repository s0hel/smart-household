import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword, hashPin } from "@household/domain";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const HOUSEHOLD_NAME = "The Demo Household";

/** Returns the Date for `daysFromMonday` days after the Monday of `weekOffset` weeks from this week, at `hour`:`minute` local time. */
function atWeek(weekOffset: number, daysFromMonday: number, hour: number, minute = 0): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const target = new Date(monday);
  target.setDate(monday.getDate() + weekOffset * 7 + daysFromMonday);
  target.setHours(hour, minute, 0, 0);
  return target;
}

/** Same as `atWeek` but for this week — kept for readability at call sites. */
function thisWeek(daysFromMonday: number, hour: number, minute = 0): Date {
  return atWeek(0, daysFromMonday, hour, minute);
}

/** Midnight `daysAgo` days before today, for keying ChoreCompletion.occurrenceDate. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

/** Simple string hash -> [0, 1), used to make completion history look organic but deterministic. */
function pseudoRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return (h >>> 0) / 0xffffffff;
}

async function main() {
  console.log("Seeding demo household...");

  // Re-seedable: wipe any prior run of the same demo household (cascades to
  // every child record) instead of hard-failing on the User.email unique
  // constraint the second time this script runs against the same DB.
  const existing = await prisma.household.findFirst({ where: { name: HOUSEHOLD_NAME } });
  if (existing) {
    console.log(`Removing existing "${HOUSEHOLD_NAME}" (${existing.id}) before reseeding...`);
    await prisma.household.delete({ where: { id: existing.id } });
  }

  const household = await prisma.household.create({
    data: {
      name: HOUSEHOLD_NAME,
      timezone: "America/New_York",
    },
  });

  const [sohel, amina, imran, zara, grandma] = await Promise.all([
    prisma.user.create({
      data: {
        householdId: household.id,
        name: "Sohel",
        email: "sohel@example.com",
        role: "ADMIN",
        colorHex: "#2851A3",
        birthdate: new Date(1988, 4, 12),
        passwordHash: await hashPassword("password123"),
      },
    }),
    prisma.user.create({
      data: {
        householdId: household.id,
        name: "Zarina",
        email: "zarina@example.com",
        role: "PARENT",
        colorHex: "#1F6F5C",
        birthdate: new Date(1989, 8, 3),
        passwordHash: await hashPassword("password123"),
      },
    }),
    prisma.user.create({
      data: {
        householdId: household.id,
        name: "Imran",
        role: "CHILD",
        colorHex: "#6B3FA0",
        birthdate: new Date(2015, 2, 22),
        pinHash: await hashPin("1234"),
      },
    }),
    prisma.user.create({
      data: {
        householdId: household.id,
        name: "Zara",
        role: "CHILD",
        colorHex: "#B5541F",
        birthdate: new Date(2017, 10, 9),
        pinHash: await hashPin("5678"),
      },
    }),
    prisma.user.create({
      data: {
        householdId: household.id,
        name: "Senora",
        email: "senora@example.com",
        role: "READONLY",
        colorHex: "#0E7C86",
        passwordHash: await hashPassword("password123"),
      },
    }),
  ]);
  void grandma;

  // --- Events ---------------------------------------------------------------
  // Spread across last week / this week / next week so the calendar demos
  // week navigation, not just a single static view.
  const soccer = await prisma.event.create({
    data: {
      householdId: household.id,
      title: "Soccer Practice",
      startAt: thisWeek(1, 17, 30), // Tuesday 5:30pm
      endAt: thisWeek(1, 19, 0),
      location: "Memorial Park",
      colorHex: imran.colorHex,
      travelTimeMinutes: 18,
      assignees: { create: [{ userId: imran.id }] },
      checklist: {
        create: [
          { label: "Soccer shoes", order: 0 },
          { label: "Water", order: 1 },
          { label: "Jersey", order: 2 },
        ],
      },
    },
  });

  await Promise.all([
    // Recurring-ish soccer practice, seeded as individual rows last/this/next
    // week (occurrence expansion isn't implemented yet — see CLAUDE.md).
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Soccer Practice",
        startAt: atWeek(-1, 1, 17, 30),
        endAt: atWeek(-1, 1, 19, 0),
        location: "Memorial Park",
        colorHex: imran.colorHex,
        travelTimeMinutes: 18,
        assignees: { create: [{ userId: imran.id }] },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Soccer Practice",
        startAt: atWeek(1, 1, 17, 30),
        endAt: atWeek(1, 1, 19, 0),
        location: "Memorial Park",
        colorHex: imran.colorHex,
        travelTimeMinutes: 18,
        assignees: { create: [{ userId: imran.id }] },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Ballet Class",
        startAt: atWeek(-1, 2, 16, 0), // Wednesday 4:00pm
        endAt: atWeek(-1, 2, 17, 0),
        location: "Twinkle Toes Studio",
        colorHex: zara.colorHex,
        travelTimeMinutes: 10,
        assignees: { create: [{ userId: zara.id }] },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Ballet Class",
        startAt: thisWeek(2, 16, 0),
        endAt: thisWeek(2, 17, 0),
        location: "Twinkle Toes Studio",
        colorHex: zara.colorHex,
        travelTimeMinutes: 10,
        assignees: { create: [{ userId: zara.id }] },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Ballet Class",
        startAt: atWeek(1, 2, 16, 0),
        endAt: atWeek(1, 2, 17, 0),
        location: "Twinkle Toes Studio",
        colorHex: zara.colorHex,
        travelTimeMinutes: 10,
        assignees: { create: [{ userId: zara.id }] },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Dentist",
        startAt: thisWeek(4, 17, 0), // Friday 5:00pm
        endAt: thisWeek(4, 17, 45),
        location: "Bright Smiles Dental",
        colorHex: zara.colorHex,
        assignees: { create: [{ userId: zara.id }] },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Pediatrician check-up",
        startAt: atWeek(1, 0, 9, 30), // next Monday 9:30am
        endAt: atWeek(1, 0, 10, 15),
        location: "Willow Creek Pediatrics",
        colorHex: imran.colorHex,
        travelTimeMinutes: 15,
        assignees: { create: [{ userId: imran.id }, { userId: amina.id }] },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Dinner",
        startAt: thisWeek(4, 18, 30),
        endAt: thisWeek(4, 19, 30),
        colorHex: "#A8842A",
        assignees: {
          create: [{ userId: sohel.id }, { userId: amina.id }, { userId: imran.id }, { userId: zara.id }],
        },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Date Night",
        startAt: thisWeek(5, 19, 0), // Saturday 7:00pm
        endAt: thisWeek(5, 21, 30),
        location: "Bellini's Trattoria",
        colorHex: "#8C2F39",
        assignees: { create: [{ userId: sohel.id }, { userId: amina.id }] },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Birthday Party",
        startAt: thisWeek(5, 10, 0), // Saturday 10:00am
        endAt: thisWeek(5, 12, 0),
        location: "Jump Zone Trampoline Park",
        colorHex: "#9B2242",
        travelTimeMinutes: 12,
        assignees: { create: [{ userId: imran.id }, { userId: zara.id }] },
        checklist: {
          create: [
            { label: "Wrapped gift", order: 0 },
            { label: "RSVP card", order: 1 },
          ],
        },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Sohel: Quarterly Planning Offsite",
        startAt: atWeek(-1, 2, 9, 0),
        endAt: atWeek(-1, 3, 17, 0),
        location: "Downtown Conference Center",
        colorHex: sohel.colorHex,
        assignees: { create: [{ userId: sohel.id }] },
      },
    }),
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Parent-Teacher Conferences",
        startAt: atWeek(1, 3, 15, 0),
        endAt: atWeek(1, 3, 19, 0),
        location: "Lincoln Elementary",
        colorHex: "#A8842A",
        assignees: { create: [{ userId: sohel.id }, { userId: amina.id }] },
      },
    }),
    // Multi-day all-day event, to demo the all-day span rendering.
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "Family Trip to Grandma's",
        startAt: atWeek(2, 4, 0, 0), // next-next Friday
        endAt: atWeek(2, 6, 0, 0), // through Sunday
        allDay: true,
        location: "Rukhsana's House",
        colorHex: "#0E7C86",
        assignees: {
          create: [{ userId: sohel.id }, { userId: amina.id }, { userId: imran.id }, { userId: zara.id }],
        },
      },
    }),
    // Single-day all-day event.
    prisma.event.create({
      data: {
        householdId: household.id,
        title: "School Closed - Teacher In-Service Day",
        startAt: atWeek(-1, 4, 0, 0),
        endAt: atWeek(-1, 4, 0, 0),
        allDay: true,
        colorHex: "#9B2242",
        assignees: { create: [{ userId: imran.id }, { userId: zara.id }] },
      },
    }),
  ]);

  // --- Rewards ------------------------------------------------------------
  const [gamingTime, pickDinner, allowance, outing, lateBedtime] = await Promise.all([
    prisma.reward.create({
      data: { householdId: household.id, name: "30 minutes extra gaming", costPoints: 50, requiresApproval: false },
    }),
    prisma.reward.create({
      data: { householdId: household.id, name: "Pick Friday dinner", costPoints: 100 },
    }),
    prisma.reward.create({
      data: { householdId: household.id, name: "$10 allowance", costPoints: 200 },
    }),
    prisma.reward.create({
      data: { householdId: household.id, name: "Special outing", costPoints: 500 },
    }),
    prisma.reward.create({
      data: {
        householdId: household.id,
        name: "Retired: Stay up 30 min late",
        costPoints: 30,
        active: false,
        description: "Replaced by the gaming-time reward — kept for redemption history.",
      },
    }),
  ]);

  // --- Tasks / chores --------------------------------------------------------
  const trashTask = await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Take trash out",
      type: "CHORE",
      icon: "🗑️",
      assigneeId: imran.id,
      frequency: "FREQ=DAILY",
      points: 2,
      dueAt: thisWeek(4, 20, 0),
    },
  });

  const cleanRoomTask = await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Clean room",
      type: "CHORE",
      icon: "🧹",
      assigneeId: imran.id,
      frequency: "FREQ=WEEKLY",
      points: 10,
      dueAt: thisWeek(6, 20, 0),
    },
  });

  const feedDogTask = await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Feed dog",
      type: "CHORE",
      icon: "🐕",
      assigneeId: zara.id,
      frequency: "FREQ=DAILY",
      points: 3,
      dueAt: thisWeek(4, 8, 0),
    },
  });

  const setTableTask = await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Set the dinner table",
      type: "CHORE",
      icon: "🍽️",
      assigneeId: zara.id,
      frequency: "FREQ=DAILY",
      points: 2,
      dueAt: thisWeek(4, 18, 0),
    },
  });

  const morningRoutineTask = await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Morning routine (brush teeth, get dressed, pack bag)",
      type: "ROUTINE",
      icon: "🌅",
      assigneeId: imran.id,
      frequency: "FREQ=DAILY",
      points: 1,
      dueAt: thisWeek(4, 7, 30),
    },
  });

  await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Water the garden",
      type: "RECURRING",
      icon: "🌱",
      assigneeId: amina.id,
      frequency: "FREQ=WEEKLY;BYDAY=SA",
      points: 0,
      dueAt: thisWeek(5, 9, 0),
    },
  });

  await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Grocery shopping",
      type: "ONE_TIME",
      icon: "🛒",
      assigneeId: sohel.id,
      dueAt: thisWeek(4, 18, 0),
      points: 0,
    },
  });

  await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Book Imran's dentist appointment",
      type: "ONE_TIME",
      assigneeId: amina.id,
      dueAt: daysAgo(-2), // overdue by 2 days
      points: 0,
    },
  });

  await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Sign permission slip for field trip",
      type: "ONE_TIME",
      icon: "📝",
      assigneeId: zara.id,
      dueAt: thisWeek(0, 8, 0),
      points: 0,
    },
  });

  await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Wash the car",
      type: "CHORE",
      icon: "🚗",
      assigneeId: sohel.id,
      frequency: "FREQ=WEEKLY",
      points: 15,
      dueAt: thisWeek(6, 11, 0),
      active: false, // paused chore, to demo the "active" toggle
    },
  });

  // --- Chore completion history (so Rewards has real balances to redeem) ----
  // 45 days of history per recurring chore, with realistic gaps rather than
  // a perfect streak, weighted per-task so balances differ meaningfully.
  const completionRuns: Array<{ task: { id: string }; completedById: string; points: number; hitRate: number }> = [
    { task: trashTask, completedById: imran.id, points: 2, hitRate: 0.85 },
    { task: cleanRoomTask, completedById: imran.id, points: 10, hitRate: 0.6 },
    { task: morningRoutineTask, completedById: imran.id, points: 1, hitRate: 0.9 },
    { task: feedDogTask, completedById: zara.id, points: 3, hitRate: 0.8 },
    { task: setTableTask, completedById: zara.id, points: 2, hitRate: 0.7 },
  ];

  for (const run of completionRuns) {
    for (let n = 1; n <= 45; n++) {
      // Weekly-frequency chores only land once a week; daily ones land most days.
      const isWeekly = run.task.id === cleanRoomTask.id;
      if (isWeekly && n % 7 !== 0) continue;

      const roll = pseudoRandom(`${run.task.id}:${n}`);
      if (roll > run.hitRate) continue; // missed that day/week

      const occurrenceDate = daysAgo(n);
      // Most completions are approved; leave the most recent handful pending
      // approval so the rewards/approval queue has something to show.
      const isRecentAndUnapproved = n <= 2 && roll > run.hitRate - 0.15;

      await prisma.choreCompletion.create({
        data: {
          taskId: run.task.id,
          occurrenceDate,
          completedById: run.completedById,
          pointsAwarded: run.points,
          approvedAt: isRecentAndUnapproved ? null : occurrenceDate,
          approvedById: isRecentAndUnapproved ? null : sohel.id,
        },
      });
    }
  }

  // --- Reward redemptions ----------------------------------------------------
  await prisma.rewardRedemption.create({
    data: {
      rewardId: gamingTime.id,
      userId: imran.id,
      status: "APPROVED",
      requestedAt: daysAgo(10),
      decidedAt: daysAgo(10),
      decidedById: sohel.id,
    },
  });
  await prisma.rewardRedemption.create({
    data: {
      rewardId: pickDinner.id,
      userId: zara.id,
      status: "APPROVED",
      requestedAt: daysAgo(6),
      decidedAt: daysAgo(5),
      decidedById: amina.id,
    },
  });
  await prisma.rewardRedemption.create({
    data: {
      rewardId: allowance.id,
      userId: imran.id,
      status: "DENIED",
      requestedAt: daysAgo(20),
      decidedAt: daysAgo(19),
      decidedById: sohel.id,
    },
  });
  await prisma.rewardRedemption.create({
    data: {
      rewardId: outing.id,
      userId: zara.id,
      status: "PENDING",
      requestedAt: daysAgo(1),
    },
  });
  await prisma.rewardRedemption.create({
    data: {
      rewardId: lateBedtime.id,
      userId: imran.id,
      status: "APPROVED",
      requestedAt: daysAgo(40),
      decidedAt: daysAgo(40),
      decidedById: amina.id,
    },
  });

  // --- Recipes + meal plan ----------------------------------------------------
  const [tacos, stirFry, pancakes, pasta, salad] = await Promise.all([
    prisma.recipe.create({
      data: {
        householdId: household.id,
        name: "Chicken Tacos",
        servings: 4,
        prepMinutes: 15,
        cookMinutes: 20,
        instructions: "Season and grill the chicken, slice, and serve in warmed shells with toppings.",
        ingredients: {
          create: [
            { name: "Chicken breast", quantity: "1.5 lb", category: "Meat", order: 0 },
            { name: "Taco shells", quantity: "8", category: "Pantry", order: 1 },
            { name: "Lettuce", quantity: "1 head", category: "Produce", order: 2 },
            { name: "Cheese", quantity: "1 cup shredded", category: "Dairy", order: 3 },
            { name: "Tomatoes", quantity: "2", category: "Produce", order: 4 },
          ],
        },
      },
    }),
    prisma.recipe.create({
      data: {
        householdId: household.id,
        name: "Veggie Stir Fry",
        servings: 4,
        prepMinutes: 10,
        cookMinutes: 15,
        instructions: "Stir-fry the chicken and vegetables, serve over rice.",
        ingredients: {
          create: [
            { name: "Rice", quantity: "2 cups", category: "Pantry", order: 0 },
            { name: "Chicken breast", quantity: "1 lb", category: "Meat", order: 1 },
            { name: "Tomatoes", quantity: "1", category: "Produce", order: 2 },
          ],
        },
      },
    }),
    prisma.recipe.create({
      data: {
        householdId: household.id,
        name: "Weekend Pancakes",
        servings: 4,
        prepMinutes: 10,
        cookMinutes: 15,
        ingredients: {
          create: [
            { name: "Pancake mix", quantity: "2 cups", category: "Pantry", order: 0 },
            { name: "Milk", quantity: "1.5 cups", category: "Dairy", order: 1 },
            { name: "Eggs", quantity: "2", category: "Dairy", order: 2 },
          ],
        },
      },
    }),
    prisma.recipe.create({
      data: {
        householdId: household.id,
        name: "Spaghetti and Meatballs",
        servings: 4,
        prepMinutes: 15,
        cookMinutes: 30,
        ingredients: {
          create: [
            { name: "Pasta", quantity: "1 lb", category: "Pantry", order: 0 },
            { name: "Ground beef", quantity: "1 lb", category: "Meat", order: 1 },
            { name: "Tomatoes", quantity: "3", category: "Produce", order: 2 },
            { name: "Cheese", quantity: "1/2 cup shredded", category: "Dairy", order: 3 },
          ],
        },
      },
    }),
    prisma.recipe.create({
      data: {
        householdId: household.id,
        name: "Garden Salad",
        servings: 4,
        prepMinutes: 10,
        cookMinutes: 0,
        ingredients: {
          create: [
            { name: "Lettuce", quantity: "1 head", category: "Produce", order: 0 },
            { name: "Tomatoes", quantity: "2", category: "Produce", order: 1 },
            { name: "Bananas", quantity: "0", category: "Produce", order: 2 },
          ],
        },
      },
    }),
  ]);

  await Promise.all([
    prisma.mealPlanEntry.create({
      data: { householdId: household.id, date: thisWeek(0, 0, 0), mealType: "BREAKFAST", recipeId: pancakes.id },
    }),
    prisma.mealPlanEntry.create({
      data: { householdId: household.id, date: thisWeek(1, 0, 0), mealType: "DINNER", recipeId: tacos.id },
    }),
    prisma.mealPlanEntry.create({
      data: { householdId: household.id, date: thisWeek(2, 0, 0), mealType: "LUNCH", recipeId: salad.id },
    }),
    prisma.mealPlanEntry.create({
      data: { householdId: household.id, date: thisWeek(3, 0, 0), mealType: "DINNER", recipeId: stirFry.id },
    }),
    prisma.mealPlanEntry.create({
      data: { householdId: household.id, date: thisWeek(4, 0, 0), mealType: "DINNER", recipeId: pasta.id },
    }),
    prisma.mealPlanEntry.create({
      data: {
        householdId: household.id,
        date: thisWeek(5, 0, 0),
        mealType: "DINNER",
        customTitle: "Leftovers / takeout",
        notes: "Pick Friday dinner winner picks tonight too",
      },
    }),
    prisma.mealPlanEntry.create({
      data: { householdId: household.id, date: atWeek(1, 0, 0, 0), mealType: "BREAKFAST", recipeId: pancakes.id },
    }),
    prisma.mealPlanEntry.create({
      data: { householdId: household.id, date: atWeek(1, 3, 0, 0), mealType: "DINNER", recipeId: tacos.id },
    }),
  ]);

  // --- Lists ---------------------------------------------------------------
  await prisma.list.create({
    data: {
      householdId: household.id,
      name: "Grocery List",
      type: "GROCERY",
      items: {
        create: [
          { label: "Bananas", category: "Produce", order: 0 },
          { label: "Lettuce", category: "Produce", order: 1 },
          { label: "Tomatoes", category: "Produce", order: 2 },
          { label: "Milk", category: "Dairy", order: 3, checked: true },
          { label: "Cheese", category: "Dairy", order: 4 },
          { label: "Chicken breast", category: "Meat", order: 5 },
          { label: "Ground beef", category: "Meat", order: 6 },
          { label: "Rice", category: "Pantry", order: 7 },
          { label: "Pasta", category: "Pantry", order: 8, checked: true },
          { label: "Eggs", category: "Dairy", order: 9 },
          { label: "Pancake mix", category: "Pantry", order: 10 },
        ],
      },
    },
  });

  await prisma.list.create({
    data: {
      householdId: household.id,
      name: "Family Trip Packing List",
      type: "CUSTOM",
      items: {
        create: [
          { label: "Pack Imran's soccer cleats", assigneeId: imran.id, order: 0, checked: true },
          { label: "Pack Zara's ballet shoes", assigneeId: zara.id, order: 1 },
          { label: "Charge cameras", assigneeId: sohel.id, order: 2 },
          { label: "Print directions", assigneeId: amina.id, order: 3, checked: true },
          { label: "Book pet sitter", assigneeId: amina.id, order: 4, dueDate: daysAgo(-3) },
          { label: "Gas up the car", assigneeId: sohel.id, order: 5 },
        ],
      },
    },
  });

  await prisma.list.create({
    data: {
      householdId: household.id,
      name: "Home Projects",
      type: "CUSTOM",
      items: {
        create: [
          { label: "Fix squeaky garage door", notes: "WD-40 the hinges", order: 0 },
          { label: "Repaint the fence", order: 1 },
          { label: "Clean out the garage", assigneeId: sohel.id, order: 2 },
          { label: "Organize the pantry", assigneeId: amina.id, order: 3, checked: true },
        ],
      },
    },
  });

  console.log(`Seeded household "${household.name}" (${household.id})`);
  console.log(`Sign in as ${sohel.email} / password123 (also: ${amina.email}, ${grandma.email})`);
  console.log(`Children switch profiles via PIN: Imran (1234), Zara (5678)`);
  console.log(`Event seeded: ${soccer.title}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
