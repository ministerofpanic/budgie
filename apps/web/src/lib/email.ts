import "server-only";

import { attemptAsync, type Result } from "@budgie/core/result";

export type EmailError =
  | { readonly kind: "network"; readonly message: string }
  | { readonly kind: "http"; readonly status: number; readonly body: string };

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set - copy .env.example to .env and fill it in.`);
  return value;
};

const magicLinkHtml = (url: string): string => `
  <p>Sign in to Budgie by clicking the link below. It expires in 5 minutes.</p>
  <p><a href="${url}">Sign in to Budgie</a></p>
  <p>If you didn't request this, you can safely ignore this email.</p>
`;

// A plain-text alternative alongside the HTML body - HTML-only mail from a
// brand-new sending domain is a common spam signal, and a multipart email
// with both parts reads as more legitimate to most filters.
const magicLinkText = (url: string): string =>
  `Sign in to Budgie by opening the link below. It expires in 5 minutes.\n\n${url}\n\nIf you didn't request this, you can safely ignore this email.`;

/** Sends the magic-link sign-in email via Resend's REST API - a single call
 * type, so a raw `fetch` is simpler than pulling in Resend's SDK (same
 * reasoning as `gocardless.ts`/`exchange-rate.ts` in @budgie/core). */
export const sendMagicLinkEmail = async (
  email: string,
  url: string,
): Promise<Result<void, EmailError>> => {
  const result = await attemptAsync<Response, EmailError>(
    () =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env("EMAIL_FROM"),
          to: email,
          subject: "Sign in to Budgie",
          html: magicLinkHtml(url),
          text: magicLinkText(url),
        }),
      }),
    (thrown) => ({
      kind: "network",
      message: thrown instanceof Error ? thrown.message : String(thrown),
    }),
  );
  if (!result.ok) return result;

  if (!result.value.ok) {
    const body = await result.value.text();
    return { ok: false, error: { kind: "http", status: result.value.status, body } };
  }

  return { ok: true, value: undefined };
};
