/**
 * A hand-rolled Result type. Errors are values, not exceptions.
 *
 * Deliberately dependency-free and data-first: every helper takes the Result as
 * its first argument, so it reads left-to-right without needing a wrapper class.
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

export const map = <T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
  result.ok ? result : err(fn(result.error));

/** The error channels merge into a union. */
export const andThen = <T, E, U, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> => (result.ok ? fn(result.value) : result);

export const match = <T, E, U>(
  result: Result<T, E>,
  handlers: { readonly onOk: (value: T) => U; readonly onErr: (error: E) => U },
): U => (result.ok ? handlers.onOk(result.value) : handlers.onErr(result.error));

export const unwrapOr = <T, E>(result: Result<T, E>, fallback: T): T =>
  result.ok ? result.value : fallback;

export const unwrapOrElse = <T, E>(result: Result<T, E>, fn: (error: E) => T): T =>
  result.ok ? result.value : fn(result.error);

/**
 * Collect an array of Results into a Result of an array.
 * Short-circuits on the first error, which is what you want for form validation
 * of dependent fields and for batch writes.
 */
export const all = <T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
};

/** Gather every error rather than stopping at the first. For independent fields. */
export const allSettled = <T, E>(
  results: readonly Result<T, E>[],
): Result<readonly T[], readonly E[]> => {
  const values: T[] = [];
  const errors: E[] = [];
  for (const result of results) {
    if (result.ok) values.push(result.value);
    else errors.push(result.error);
  }
  return errors.length > 0 ? err(errors) : ok(values);
};

export const attempt = <T, E>(fn: () => T, onThrow: (thrown: unknown) => E): Result<T, E> => {
  try {
    return ok(fn());
  } catch (thrown) {
    return err(onThrow(thrown));
  }
};

export const attemptAsync = async <T, E>(
  fn: () => Promise<T>,
  onThrow: (thrown: unknown) => E,
): Promise<Result<T, E>> => {
  try {
    return ok(await fn());
  } catch (thrown) {
    return err(onThrow(thrown));
  }
};
