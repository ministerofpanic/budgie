import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMagicLinkEmail } from "@/lib/email";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("EMAIL_FROM", "Budgie <sign-in@example.test>");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sendMagicLinkEmail", () => {
  it("posts the expected payload to Resend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "email-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMagicLinkEmail("person@example.test", "https://budgie.test/verify");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      from: string;
      to: string;
      subject: string;
      html: string;
    };
    expect(body.from).toBe("Budgie <sign-in@example.test>");
    expect(body.to).toBe("person@example.test");
    expect(body.subject).toBe("Sign in to Budgie");
    expect(body.html).toContain("https://budgie.test/verify");
  });

  it("returns an http error rather than throwing on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "bad" }, 422)));

    const result = await sendMagicLinkEmail("person@example.test", "https://budgie.test/verify");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("http");
  });

  it("returns a network error when fetch rejects, instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND api.resend.com")),
    );

    const result = await sendMagicLinkEmail("person@example.test", "https://budgie.test/verify");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("network");
  });
});
