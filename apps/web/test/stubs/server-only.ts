// Test-only stand-in for the `server-only` package, which enforces its
// server/client boundary via a bundler-specific trick that vitest doesn't
// need - importing the real package here would just fail to resolve.
export const serverOnlyStub = true;
