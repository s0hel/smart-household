import { router } from "../trpc";
import { householdRouter } from "./household";
import { familyMemberRouter } from "./familyMember";
import { eventRouter } from "./event";
import { taskRouter } from "./task";
import { listRouter } from "./list";
import { calendarAccountRouter } from "./calendarAccount";

export const appRouter = router({
  household: householdRouter,
  familyMember: familyMemberRouter,
  event: eventRouter,
  task: taskRouter,
  list: listRouter,
  calendarAccount: calendarAccountRouter,
});

export type AppRouter = typeof appRouter;
