import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// /api/calc(.*) is exempted from Clerk's auth.protect() — those handlers
// enforce their own auth (valid Clerk session OR x-api-key === ARE_API_KEY,
// per docs/calc-state-spec.md §5.4). Clerk context is still attached, so a
// browser's session cookie remains readable via auth() inside the handler.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/api/calc(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
