// ============================================================
// Razorpay REST client — a thin, typed wrapper over fetch.
//
// Why not the `razorpay` npm package: we need three calls, the REST
// API is stable, and a plain fetch wrapper has no dependency, runs on
// any Node runtime, and is trivial to unit test with an injected
// fetch. The same module serves both uses of Razorpay in this app:
//
//   - WAGenie's own subscription billing (platform keys in the
//     environment: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).
//   - Later, the payment links of each workspace (their own keys).
//
// Server only. The key secret must never reach the browser.
// ============================================================

const RAZORPAY_API = 'https://api.razorpay.com/v1'

export interface RazorpayConfig {
  keyId: string
  keySecret: string
  /** True when the Key ID starts with rzp_test_ — no real money moves. */
  testMode: boolean
}

/**
 * Read the platform keys from the environment. Returns null when either
 * is missing, so callers can show "not set up yet" instead of crashing.
 */
export function getRazorpayConfig(
  env: Record<string, string | undefined> = process.env,
): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim()
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim()
  if (!keyId || !keySecret) return null
  return { keyId, keySecret, testMode: keyId.startsWith('rzp_test_') }
}

export class RazorpayError extends Error {
  readonly status: number
  readonly code: string | null
  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = 'RazorpayError'
    this.status = status
    this.code = code
  }
}

export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  receipt: string | null
  status: string
}

export interface RazorpayPayment {
  id: string
  order_id: string | null
  amount: number
  currency: string
  /** created | authorized | captured | refunded | failed */
  status: string
  method?: string
}

type FetchLike = typeof fetch

function authHeader(config: RazorpayConfig): string {
  const token = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')
  return `Basic ${token}`
}

async function request<T>(
  config: RazorpayConfig,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
  fetchImpl: FetchLike,
): Promise<T> {
  const res = await fetchImpl(`${RAZORPAY_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: authHeader(config),
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  })

  const payload = (await res.json().catch(() => null)) as
    | (T & { error?: { code?: string; description?: string } })
    | null

  if (!res.ok) {
    const err = payload?.error
    throw new RazorpayError(
      err?.description || `Razorpay answered ${res.status}`,
      res.status,
      err?.code ?? null,
    )
  }
  if (!payload) {
    throw new RazorpayError('Razorpay sent an empty answer', res.status)
  }
  return payload
}

/** Create an order. `amountPaise` is in paise: ₹2,500 is 250000. */
export function createOrder(
  config: RazorpayConfig,
  args: {
    amountPaise: number
    currency?: string
    receipt: string
    notes?: Record<string, string>
  },
  fetchImpl: FetchLike = fetch,
): Promise<RazorpayOrder> {
  return request<RazorpayOrder>(
    config,
    '/orders',
    {
      method: 'POST',
      body: {
        amount: args.amountPaise,
        currency: args.currency ?? 'INR',
        receipt: args.receipt,
        notes: args.notes ?? {},
      },
    },
    fetchImpl,
  )
}

/** Fetch one payment, so we trust Razorpay and not the browser. */
export function fetchPayment(
  config: RazorpayConfig,
  paymentId: string,
  fetchImpl: FetchLike = fetch,
): Promise<RazorpayPayment> {
  return request<RazorpayPayment>(
    config,
    `/payments/${encodeURIComponent(paymentId)}`,
    { method: 'GET' },
    fetchImpl,
  )
}
