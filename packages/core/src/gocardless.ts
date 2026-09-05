/**
 * GoCardless Bank Account Data (formerly Nordigen) client - read-only Open
 * Banking access, no I/O beyond `fetch`. Every call returns a Result rather
 * than throwing, so a DAL caller decides how to surface a failed sync.
 */

import { attemptAsync, err, ok, type Result } from "./result";
import { unsafePence, type Pence } from "./money";

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

export type GoCardlessError =
  | { readonly kind: "network"; readonly message: string }
  | { readonly kind: "http"; readonly status: number; readonly body: string }
  | { readonly kind: "parse"; readonly message: string };

export type GoCardlessCredentials = {
  readonly secretId: string;
  readonly secretKey: string;
};

export type AccessToken = { readonly value: string };

const request = async <T>(
  url: string,
  init: RequestInit,
): Promise<Result<{ readonly body: T; readonly headers: Headers }, GoCardlessError>> => {
  const attempted = await attemptAsync<Response, GoCardlessError>(
    () => fetch(url, init),
    (thrown) => ({
      kind: "network",
      message: thrown instanceof Error ? thrown.message : String(thrown),
    }),
  );
  if (!attempted.ok) return attempted;

  const response = attempted.value;
  if (!response.ok) {
    const body = await response.text();
    return err({ kind: "http", status: response.status, body });
  }

  const parsed = await attemptAsync<T, GoCardlessError>(
    () => response.json() as Promise<T>,
    (thrown) => ({
      kind: "parse",
      message: thrown instanceof Error ? thrown.message : String(thrown),
    }),
  );
  if (!parsed.ok) return parsed;

  return ok({ body: parsed.value, headers: response.headers });
};

export const getAccessToken = async (
  credentials: GoCardlessCredentials,
): Promise<Result<AccessToken, GoCardlessError>> => {
  const result = await request<{ readonly access: string }>(`${BASE_URL}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: credentials.secretId, secret_key: credentials.secretKey }),
  });
  if (!result.ok) return result;
  return ok({ value: result.value.body.access });
};

const authedRequest = <T>(
  token: AccessToken,
  path: string,
  init: RequestInit = {},
): Promise<Result<{ readonly body: T; readonly headers: Headers }, GoCardlessError>> =>
  request<T>(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token.value}`,
      "Content-Type": "application/json",
    },
  });

export type Institution = {
  readonly id: string;
  readonly name: string;
  readonly logo: string;
};

export const listInstitutions = async (
  token: AccessToken,
  country = "gb",
): Promise<Result<readonly Institution[], GoCardlessError>> => {
  const result = await authedRequest<
    readonly { readonly id: string; readonly name: string; readonly logo: string }[]
  >(token, `/institutions/?country=${country}`);
  if (!result.ok) return result;
  return ok(result.value.body);
};

export type Requisition = {
  readonly requisitionId: string;
  readonly link: string;
};

export const createRequisition = async (
  token: AccessToken,
  params: {
    readonly institutionId: string;
    readonly redirectUrl: string;
    readonly reference: string;
  },
): Promise<Result<Requisition, GoCardlessError>> => {
  const agreementResult = await authedRequest<{ readonly id: string }>(
    token,
    "/agreements/enduser/",
    {
      method: "POST",
      body: JSON.stringify({
        institution_id: params.institutionId,
        max_historical_days: 730,
        access_valid_for_days: 90,
      }),
    },
  );
  if (!agreementResult.ok) return agreementResult;

  const requisitionResult = await authedRequest<{ readonly id: string; readonly link: string }>(
    token,
    "/requisitions/",
    {
      method: "POST",
      body: JSON.stringify({
        redirect: params.redirectUrl,
        institution_id: params.institutionId,
        reference: params.reference,
        agreement: agreementResult.value.body.id,
      }),
    },
  );
  if (!requisitionResult.ok) return requisitionResult;

  return ok({
    requisitionId: requisitionResult.value.body.id,
    link: requisitionResult.value.body.link,
  });
};

export type RequisitionStatus = {
  readonly status: string;
  readonly accountIds: readonly string[];
};

export const getRequisition = async (
  token: AccessToken,
  requisitionId: string,
): Promise<Result<RequisitionStatus, GoCardlessError>> => {
  const result = await authedRequest<{
    readonly status: string;
    readonly accounts: readonly string[];
  }>(token, `/requisitions/${requisitionId}/`);
  if (!result.ok) return result;
  return ok({ status: result.value.body.status, accountIds: result.value.body.accounts });
};

export type BankTransaction = {
  readonly date: string;
  readonly amountPence: Pence;
  readonly payeeName: string | null;
  readonly memo: string | null;
  readonly externalId: string;
};

export type RateLimit = {
  readonly remaining: number | null;
  readonly resetAt: Date | null;
};

const parseAmountPence = (decimal: string): Pence => unsafePence(Math.round(Number(decimal) * 100));

const parseRateLimit = (headers: Headers): RateLimit => {
  const remainingHeader = headers.get("HTTP_X-RATELIMIT-ACCOUNT-SUCCESS-REMAINING");
  const resetHeader = headers.get("HTTP_X-RATELIMIT-ACCOUNT-SUCCESS-RESET");
  const remaining = remainingHeader === null ? null : Number(remainingHeader);
  const resetAt = resetHeader === null ? null : new Date(Date.now() + Number(resetHeader) * 1000);
  return { remaining: remaining === null || Number.isNaN(remaining) ? null : remaining, resetAt };
};

type RawTransaction = {
  readonly transactionId?: string;
  readonly internalTransactionId?: string;
  readonly bookingDate?: string;
  readonly valueDate?: string;
  readonly transactionAmount: { readonly amount: string };
  readonly creditorName?: string;
  readonly debtorName?: string;
  readonly remittanceInformationUnstructured?: string;
};

export const getAccountTransactions = async (
  token: AccessToken,
  gocardlessAccountId: string,
): Promise<
  Result<
    { readonly transactions: readonly BankTransaction[]; readonly rateLimit: RateLimit },
    GoCardlessError
  >
> => {
  const result = await authedRequest<{
    readonly transactions: { readonly booked: readonly RawTransaction[] };
  }>(token, `/accounts/${gocardlessAccountId}/transactions/`);
  if (!result.ok) return result;

  const transactions = result.value.body.transactions.booked.map((raw) => {
    const payeeName = raw.creditorName ?? raw.debtorName ?? null;
    return {
      date: raw.bookingDate ?? raw.valueDate ?? "",
      amountPence: parseAmountPence(raw.transactionAmount.amount),
      payeeName,
      memo: raw.remittanceInformationUnstructured ?? null,
      externalId: raw.transactionId ?? raw.internalTransactionId ?? "",
    };
  });

  return ok({ transactions, rateLimit: parseRateLimit(result.value.headers) });
};
