import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@household/db";
import { verifyPassword } from "@household/domain";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          householdId: user.householdId,
          role: user.role,
          colorHex: user.colorHex,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.userId = user.id;
        token.householdId = (user as { householdId: string }).householdId;
        token.role = (user as { role: string }).role;
        // The active profile starts as whoever signed in; a PIN-based
        // profile switch (kiosk/shared device) updates this without
        // re-authenticating — see the session.switchProfile mutation.
        token.activeProfileId = user.id;
      }
      if (trigger === "update" && session?.activeProfileId) {
        token.activeProfileId = session.activeProfileId as string;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.userId as string;
      session.user.householdId = token.householdId as string;
      session.user.role = token.role as string;
      session.user.activeProfileId = (token.activeProfileId as string) ?? (token.userId as string);
      return session;
    },
  },
});
