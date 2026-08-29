import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      householdId: string;
      role: string;
      activeProfileId: string;
    } & DefaultSession["user"];
  }

  interface User {
    householdId: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    householdId: string;
    role: string;
    activeProfileId: string;
  }
}
