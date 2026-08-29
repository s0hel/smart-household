import { router } from "../trpc";
import { householdRouter } from "./household";
import { familyMemberRouter } from "./familyMember";
import { eventRouter } from "./event";
import { taskRouter } from "./task";
import { listRouter } from "./list";
import { calendarAccountRouter } from "./calendarAccount";
import { recipeRouter } from "./recipe";
import { mealPlanRouter } from "./mealPlan";
import { rewardRouter } from "./reward";
import { rewardRedemptionRouter } from "./rewardRedemption";

export const appRouter = router({
  household: householdRouter,
  familyMember: familyMemberRouter,
  event: eventRouter,
  task: taskRouter,
  list: listRouter,
  calendarAccount: calendarAccountRouter,
  recipe: recipeRouter,
  mealPlan: mealPlanRouter,
  reward: rewardRouter,
  rewardRedemption: rewardRedemptionRouter,
});

export type AppRouter = typeof appRouter;
