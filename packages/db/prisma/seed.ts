import { PrismaClient } from "@prisma/client";
import { hashPassword, hashPin } from "@household/domain";

const prisma = new PrismaClient();

/** Returns the Date for `daysFromMonday` days after this week's Monday, at `hour`:`minute` local time. */
function thisWeek(daysFromMonday: number, hour: number, minute = 0): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const target = new Date(monday);
  target.setDate(monday.getDate() + daysFromMonday);
  target.setHours(hour, minute, 0, 0);
  return target;
}

async function main() {
  console.log("Seeding demo household...");

  const household = await prisma.household.create({
    data: {
      name: "The Rahman Household",
      timezone: "America/New_York",
    },
  });

  const [sohel, partner, imran, zara] = await Promise.all([
    prisma.user.create({
      data: {
        householdId: household.id,
        name: "Sohel",
        email: "sohel@example.com",
        role: "ADMIN",
        colorHex: "#2851A3",
        passwordHash: await hashPassword("password123"),
      },
    }),
    prisma.user.create({
      data: {
        householdId: household.id,
        name: "Partner",
        email: "partner@example.com",
        role: "PARENT",
        colorHex: "#1F6F5C",
        passwordHash: await hashPassword("password123"),
      },
    }),
    prisma.user.create({
      data: {
        householdId: household.id,
        name: "Imran",
        role: "CHILD",
        colorHex: "#6B3FA0",
        pinHash: await hashPin("1234"),
      },
    }),
    prisma.user.create({
      data: {
        householdId: household.id,
        name: "Zara",
        role: "CHILD",
        colorHex: "#B5541F",
        pinHash: await hashPin("5678"),
      },
    }),
  ]);

  // --- Events -----------------------------------------------------------
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

  await prisma.event.create({
    data: {
      householdId: household.id,
      title: "Dentist",
      startAt: thisWeek(4, 17, 0), // Friday 5:00pm
      endAt: thisWeek(4, 17, 45),
      location: "Bright Smiles Dental",
      colorHex: zara.colorHex,
      assignees: { create: [{ userId: zara.id }] },
    },
  });

  await prisma.event.create({
    data: {
      householdId: household.id,
      title: "Dinner",
      startAt: thisWeek(4, 18, 30),
      endAt: thisWeek(4, 19, 30),
      colorHex: "#A8842A",
      assignees: { create: [{ userId: sohel.id }, { userId: partner.id }, { userId: imran.id }, { userId: zara.id }] },
    },
  });

  await prisma.event.create({
    data: {
      householdId: household.id,
      title: "Birthday Party",
      startAt: thisWeek(5, 10, 0), // Saturday 10:00am
      endAt: thisWeek(5, 12, 0),
      colorHex: "#9B2242",
      assignees: { create: [{ userId: imran.id }, { userId: zara.id }] },
    },
  });

  // --- Rewards ------------------------------------------------------------
  const [gamingTime, pickDinner, allowance, outing] = await Promise.all([
    prisma.reward.create({
      data: { householdId: household.id, name: "30 minutes extra gaming", costPoints: 50 },
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
  ]);
  void gamingTime;
  void pickDinner;
  void allowance;
  void outing;

  // --- Tasks / chores -------------------------------------------------------
  const trashTask = await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Take trash out",
      type: "CHORE",
      assigneeId: imran.id,
      frequency: "FREQ=DAILY",
      points: 2,
      dueAt: thisWeek(4, 20, 0),
    },
  });

  await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Clean room",
      type: "CHORE",
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
      assigneeId: zara.id,
      frequency: "FREQ=DAILY",
      points: 3,
      dueAt: thisWeek(4, 8, 0),
    },
  });

  await prisma.task.create({
    data: {
      householdId: household.id,
      title: "Grocery shopping",
      type: "ONE_TIME",
      assigneeId: sohel.id,
      dueAt: thisWeek(4, 18, 0),
      points: 0,
    },
  });

  // --- Chore completion history (so the Rewards page has points to redeem) --
  for (let daysAgo = 1; daysAgo <= 30; daysAgo++) {
    const occurrenceDate = new Date();
    occurrenceDate.setHours(0, 0, 0, 0);
    occurrenceDate.setDate(occurrenceDate.getDate() - daysAgo);

    await prisma.choreCompletion.create({
      data: { taskId: trashTask.id, occurrenceDate, completedById: imran.id, pointsAwarded: 2 },
    });
    await prisma.choreCompletion.create({
      data: { taskId: feedDogTask.id, occurrenceDate, completedById: zara.id, pointsAwarded: 3 },
    });
  }

  // --- Recipes + meal plan --------------------------------------------------
  const [tacos, stirFry] = await Promise.all([
    prisma.recipe.create({
      data: {
        householdId: household.id,
        name: "Chicken Tacos",
        servings: 4,
        prepMinutes: 15,
        cookMinutes: 20,
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
        ingredients: {
          create: [
            { name: "Rice", quantity: "2 cups", category: "Pantry", order: 0 },
            { name: "Chicken breast", quantity: "1 lb", category: "Meat", order: 1 },
            { name: "Tomatoes", quantity: "1", category: "Produce", order: 2 },
          ],
        },
      },
    }),
  ]);

  await Promise.all([
    prisma.mealPlanEntry.create({
      data: { householdId: household.id, date: thisWeek(1, 0, 0), mealType: "DINNER", recipeId: tacos.id },
    }),
    prisma.mealPlanEntry.create({
      data: { householdId: household.id, date: thisWeek(3, 0, 0), mealType: "DINNER", recipeId: stirFry.id },
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
          { label: "Milk", category: "Dairy", order: 3 },
          { label: "Cheese", category: "Dairy", order: 4 },
          { label: "Chicken breast", category: "Meat", order: 5 },
          { label: "Rice", category: "Pantry", order: 6 },
          { label: "Pasta", category: "Pantry", order: 7 },
        ],
      },
    },
  });

  console.log(`Seeded household "${household.name}" (${household.id})`);
  console.log(`Sign in as ${sohel.email} / password123`);
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
