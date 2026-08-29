import { describe, expect, it, vi } from "vitest";

import {
  all,
  allSettled,
  andThen,
  attempt,
  attemptAsync,
  err,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  ok,
  unwrapOr,
  unwrapOrElse,
} from "../src/result";

describe("construction and guards", () => {
  it("narrows on ok", () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) expect(result.value).toBe(42);
  });

  it("narrows on err", () => {
    const result = err("boom");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toBe("boom");
  });
});

describe("map / mapErr", () => {
  it("maps the success channel only", () => {
    expect(map(ok(2), (n) => n * 2)).toEqual({ ok: true, value: 4 });

    const fn = vi.fn((n: number) => n * 2);
    map(err<string>("no"), fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("maps the error channel only", () => {
    expect(mapErr(err("no"), (e) => `${e}!`)).toEqual({ ok: false, error: "no!" });

    const fn = vi.fn((e: string) => e);
    mapErr(ok(1), fn);
    expect(fn).not.toHaveBeenCalled();
  });
});

const half = (n: number) => (n % 2 === 0 ? ok(n / 2) : err("odd" as const));

describe("andThen", () => {
  it("chains successes", () => {
    expect(andThen(ok(8), half)).toEqual({ ok: true, value: 4 });
  });

  it("stops at the first failure without running the next step", () => {
    const step = vi.fn(half);
    expect(andThen(err("earlier" as const), step)).toEqual({ ok: false, error: "earlier" });
    expect(step).not.toHaveBeenCalled();
  });

  it("propagates a failure raised by the step itself", () => {
    expect(andThen(ok(7), half)).toEqual({ ok: false, error: "odd" });
  });
});

describe("match / unwrap", () => {
  it("collapses both channels", () => {
    const handlers = { onOk: (n: number) => `ok:${n}`, onErr: (e: string) => `err:${e}` };
    expect(match(ok(1), handlers)).toBe("ok:1");
    expect(match(err("x"), handlers)).toBe("err:x");
  });

  it("falls back only on error", () => {
    expect(unwrapOr(ok(1), 99)).toBe(1);
    expect(unwrapOr(err("x"), 99)).toBe(99);
    expect(unwrapOrElse(err("boom"), (e) => e.length)).toBe(4);
  });
});

describe("all", () => {
  it("collects successes in order", () => {
    expect(all([ok(1), ok(2), ok(3)])).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it("short-circuits on the first error", () => {
    const result = all([ok(1), err("first"), err("second")]);
    expect(result).toEqual({ ok: false, error: "first" });
  });

  it("treats an empty list as success", () => {
    expect(all([])).toEqual({ ok: true, value: [] });
  });
});

describe("allSettled", () => {
  it("gathers every error", () => {
    expect(allSettled([ok(1), err("a"), err("b")])).toEqual({ ok: false, error: ["a", "b"] });
  });

  it("returns values when nothing failed", () => {
    expect(allSettled([ok(1), ok(2)])).toEqual({ ok: true, value: [1, 2] });
  });
});

describe("attempt", () => {
  it("captures a throw as a value", () => {
    const result = attempt(
      () => {
        throw new Error("kaboom");
      },
      (thrown) => (thrown instanceof Error ? thrown.message : "unknown"),
    );
    expect(result).toEqual({ ok: false, error: "kaboom" });
  });

  it("passes through a successful call", () => {
    expect(
      attempt(
        () => 5,
        () => "never",
      ),
    ).toEqual({ ok: true, value: 5 });
  });

  it("captures a rejection", async () => {
    const result = await attemptAsync(
      () => Promise.reject(new Error("nope")),
      (thrown) => (thrown instanceof Error ? thrown.message : "unknown"),
    );
    expect(result).toEqual({ ok: false, error: "nope" });
  });

  it("awaits a resolved promise", async () => {
    await expect(
      attemptAsync(
        () => Promise.resolve(1),
        () => "never",
      ),
    ).resolves.toEqual({
      ok: true,
      value: 1,
    });
  });
});
