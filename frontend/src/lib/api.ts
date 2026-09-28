const isBrowser = typeof window !== "undefined";
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || (isBrowser ? "/api" : "http://127.0.0.1:8000/api");

/**
 * Safely parses any value (number, numeric string, null, undefined) into a valid number.
 * Returns fallback (default 0) if value is null, undefined, NaN, or non-numeric.
 */
export function safeDecimal(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "number") return isNaN(val) || !isFinite(val) ? fallback : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

/**
 * Formats a value as USD currency ($X,XXX.XX).
 * When preserveNull is true, returns "—" if amount is null or undefined.
 */
export function formatUSD(
  amount: number | string | null | undefined,
  preserveNull: boolean = false
): string {
  if (amount === null || amount === undefined || amount === "") {
    return preserveNull ? "—" : "$0.00";
  }
  const num = safeDecimal(amount, 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Standard central money formatter.
 * By default, preserves accounting NULL as "—" rather than coercing to zero.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string = "USD",
  preserveNull: boolean = true
): string {
  if (amount === null || amount === undefined || amount === "") {
    return preserveNull ? "—" : formatCurrency(0, currency);
  }
  const num = safeDecimal(amount, 0);
  return formatCurrency(num, currency);
}

/**
 * Safe percentage formatter. Returns "—" if null/undefined when preserveNull is true.
 */
export function formatPercentage(
  val: number | string | null | undefined,
  decimals: number = 2,
  preserveNull: boolean = false
): string {
  if (val === null || val === undefined || val === "") {
    return preserveNull ? "—" : "0.00%";
  }
  const num = safeDecimal(val, 0);
  return `${num.toFixed(decimals)}%`;
}

/**
 * Safely formats any currency code or symbol.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "USD"
): string {
  if (amount === null || amount === undefined) {
    return currency === "USD" ? "$0.00" : `0.00 ${currency}`;
  }
  const num = safeDecimal(amount, 0);
  const curr = String(currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${curr}`;
  }
}

/**
 * Safely evaluates transport carrier balances according to Section 6.
 * Negative balance on transport account = AQ Companies paid more than billed = Credit in our favor.
 */
export function formatCarrierCredit(balance: number | string | null | undefined): {
  label: string;
  formattedAmount: string;
  isCreditInFavor: boolean;
  statusClass: string;
} {
  const num = safeDecimal(balance, 0);
  if (num < 0) {
    const absVal = Math.abs(num);
    return {
      label: "CREDIT IN AQ COMPANIES FAVOR",
      formattedAmount: formatUSD(absVal),
      isCreditInFavor: true,
      statusClass:
        "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    };
  } else if (num > 0) {
    return {
      label: "PAYABLE TO CARRIER",
      formattedAmount: formatUSD(num),
      isCreditInFavor: false,
      statusClass:
        "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    };
  } else {
    return {
      label: "SETTLED / ZERO BALANCE",
      formattedAmount: "$0.00",
      isCreditInFavor: false,
      statusClass:
        "text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    };
  }
}

/**
 * Safe rate formatter (e.g. $4.5000 / KG)
 */
export function formatRate(rate: number | string | null | undefined): string {
  if (rate === null || rate === undefined || rate === "") return "$0.0000";
  const num = safeDecimal(rate, 0);
  return `$${num.toFixed(4)}`;
}

/**
 * Safe weight formatter (e.g. 10,000.000 KG)
 */
export function formatWeight(kg: number | string | null | undefined): string {
  if (kg === null || kg === undefined || kg === "") return "0.000 KG";
  const num = safeDecimal(kg, 0);
  return `${num.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} KG`;
}

/**
 * Safe integer/number formatter (e.g. 1,500)
 */
export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = safeDecimal(val, 0);
  return num.toLocaleString("en-US");
}

/**
 * Safe date formatter. Guards against invalid dates and hydration issues.
 */
export function formatDate(
  dateVal: string | number | Date | null | undefined,
  fallback: string = "—"
): string {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback;
    return d.toISOString().split("T")[0];
  } catch {
    return fallback;
  }
}

/**
 * Safe string helper that prevents undefined/null crashes on string operations.
 */
export function safeString(val: unknown, fallback: string = ""): string {
  if (val === null || val === undefined) return fallback;
  return String(val);
}

/**
 * Generates a unique client-side idempotency token for financial mutations (Req 41).
 */
export function generateIdempotencyKey(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 9);
  return `idemp_${ts}_${rand}`;
}

/**
 * Result structure for in-flight transaction verification (Req 15).
 */
export interface TransactionStatusResult {
  status: "POSTED" | "NOT POSTED" | "REVIEW REQUIRED";
  message: string;
  referenceId?: string;
  transactionNumber?: string;
}

/**
 * Checks transaction posting status using an Idempotency-Key if connection drops (Req 15).
 */
export async function checkTransactionStatus(
  idempotencyKey: string
): Promise<TransactionStatusResult> {
  if (!idempotencyKey) {
    return {
      status: "REVIEW REQUIRED",
      message: "No idempotency key available. Please check the ledger to verify if transaction was recorded.",
    };
  }
  try {
    const res = await fetchApi<{ status?: string; transaction_number?: string }>(
      `/accounting/transactions/status?idempotency_key=${encodeURIComponent(idempotencyKey)}`
    );
    if (res?.status === "POSTED") {
      return {
        status: "POSTED",
        message: "Transaction was successfully recorded in the database.",
        transactionNumber: res.transaction_number,
      };
    }
    return {
      status: "NOT POSTED",
      message: "Transaction was not recorded by the server. You may safely retry.",
    };
  } catch {
    return {
      status: "REVIEW REQUIRED",
      message: "Unable to verify transaction status. Check recent ledger entries before retrying.",
    };
  }
}

/**
 * Saves a local offline draft of a form to device storage (Req 14).
 * Tagged with LOCAL DRAFT — NOT POSTED.
 */
export function saveLocalDraft<T>(key: string, data: T): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(
      `aq_draft_${key}`,
      JSON.stringify({
        data,
        savedAt: new Date().toISOString(),
        badge: "LOCAL DRAFT — NOT POSTED",
      })
    );
  } catch (e) {
    console.warn("Failed to save local draft", e);
  }
}

/**
 * Retrieves a saved offline draft with metadata (Req 14).
 */
export function getLocalDraft<T>(
  key: string
): { data: T; savedAt: string; badge: string } | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(`aq_draft_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clears a local draft once successfully posted to backend.
 */
export function removeLocalDraft(key: string): void {
  if (!isBrowser) return;
  try {
    localStorage.removeItem(`aq_draft_${key}`);
  } catch {}
}

/**
 * Clears sensitive local storage on logout while preserving user non-confidential preferences (Req 20).
 */
export function clearSensitiveCache(): void {
  if (!isBrowser) return;
  try {
    const preservedKeys = ["aq_theme", "aq_last_company_id", "aq_filter_defaults"];
    const preserved: Record<string, string> = {};
    preservedKeys.forEach((key) => {
      const val = localStorage.getItem(key);
      if (val !== null) preserved[key] = val;
    });

    localStorage.clear();

    Object.entries(preserved).forEach(([k, v]) => {
      localStorage.setItem(k, v);
    });
  } catch (e) {
    console.warn("Failed to clear sensitive cache", e);
  }
}

/**
 * Central HTTP client with financial offline safety, auto-idempotency, and error tracing (Req 14, 15, 41, 46).
 */
export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  // FINANCIAL OFFLINE SAFETY — ABSOLUTE RULE (Req 14):
  // Financial mutations must NEVER pretend to succeed offline or blindly queue.
  if (isMutation && isBrowser && !navigator.onLine) {
    throw new Error(
      "INTERNET CONNECTION REQUIRED TO POST FINANCIAL TRANSACTIONS. Offline financial posting is strictly disabled to prevent double-posting and ledger discrepancies. (Ref: OFFLINE-BLOCKED)"
    );
  }

  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  const idempotencyKey = isMutation ? generateIdempotencyKey() : undefined;

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-ID": requestId,
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    ...(options?.headers as Record<string, string>),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 401 && isBrowser) {
        window.dispatchEvent(new CustomEvent("aq_session_expired"));
      }

      let errorMsg = `API error ${res.status}`;
      try {
        const errJson = await res.json();
        errorMsg = errJson.detail || errJson.message || JSON.stringify(errJson);
      } catch {
        // ignore
      }
      throw new Error(`${errorMsg} (Ref: ${requestId})`);
    }

    return res.json();
  } catch (err: any) {
    // If it's our deliberate offline safety error, re-throw as is
    if (err.message && err.message.includes("INTERNET CONNECTION REQUIRED")) {
      throw err;
    }
    // Network failure during in-flight request (Req 15)
    if (err.name === "TypeError" && err.message === "Failed to fetch") {
      throw new Error(
        `Network connection dropped while posting transaction. (Idempotency Key: ${
          idempotencyKey || "N/A"
        }, Ref: ${requestId}). Do NOT tap post again blindly. Verify transaction in ledger or refresh.`
      );
    }
    throw err;
  }
}
