import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers/_app";
import { createContext } from "@/server/trpc/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    // The client only ever sees a generic message for unexpected failures
    // (see the errorFormatter in server/trpc/trpc.ts), so without this the
    // real cause would be lost entirely. Deliberate 4xx-style errors are
    // normal control flow and aren't worth logging.
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[trpc] ${path ?? "<no path>"} failed:`, error.cause ?? error);
      }
    },
  });

export { handler as GET, handler as POST };
