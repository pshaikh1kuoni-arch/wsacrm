import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy, shared service-role client for billing writes. User sessions
// cannot write billing_payments (migration 055 has no write policy), so
// the routes write through this client after they have checked the
// caller's role and Razorpay's payment. Mirrors the other admin-client
// files in src/lib.
let _adminClient: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}
