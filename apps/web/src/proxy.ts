import { NextResponse, type NextRequest } from "next/server";

const unauthorized = () =>
  new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Budgie"' },
  });

/**
 * Site-wide HTTP Basic Auth wall in front of the whole app - stops anonymous
 * strangers reaching sign-up/sign-in/the DB at all, before Next.js routing
 * or any app code runs. Off by default (SITE_AUTH_PASSWORD unset) so local
 * dev, CI, and e2e stay frictionless; set both env vars on the Netlify
 * production site to turn it on. This is a coarse outer wall shared by
 * everyone who should have access, not a substitute for per-user auth.
 */
export const proxy = (request: NextRequest) => {
  const password = process.env["SITE_AUTH_PASSWORD"];
  if (!password) return NextResponse.next();
  const user = process.env["SITE_AUTH_USER"] ?? "budgie";

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [suppliedUser, suppliedPassword] = atob(header.slice("Basic ".length)).split(":");
    if (suppliedUser === user && suppliedPassword === password) {
      return NextResponse.next();
    }
  }

  return unauthorized();
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
