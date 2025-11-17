# RowFantasy Project Inventory

Generated: 2025-11-17

## Edge Functions

| Path | Purpose | Auth Mode | Callable By |
|------|---------|-----------|-------------|
| `supabase/functions/admin-contest-results/index.ts` | Import race results and score contests | Service Role | Admin |
| `supabase/functions/admin-contest-void/index.ts` | Void contests and issue refunds | Service Role | Admin |
| `supabase/functions/cms-get/index.ts` | Fetch CMS pages by slug | Anon | Public |
| `supabase/functions/compliance-export-daily/index.ts` | Export daily compliance logs | Service Role | System/Admin |
| `supabase/functions/contest-enter/index.ts` | Enter a contest (deprecated - use matchmaking) | JWT | User |
| `supabase/functions/contest-entrants/index.ts` | List entrants for a contest pool | JWT | User |
| `supabase/functions/contest-matchmaking/index.ts` | Join matchmaking queue and create entries | JWT | User |
| `supabase/functions/contest-scoring/index.ts` | Score completed contests | Service Role | Admin |
| `supabase/functions/contest-settle/index.ts` | Settle contest payouts (deprecated) | Service Role | Admin |
| `supabase/functions/contest-settlement/index.ts` | Settle contest pools and distribute payouts | Service Role | Admin |
| `supabase/functions/contest-withdraw/index.ts` | Withdraw from pending contest | JWT | User |
| `supabase/functions/help-articles/index.ts` | CRUD help articles | JWT (admin) | Admin |
| `supabase/functions/legal-state-banner/index.ts` | Get state-specific legal banner | Anon | Public |
| `supabase/functions/payments-reconciliation/index.ts` | Reconcile payment provider transactions | Service Role | System/Admin |
| `supabase/functions/payments-webhook/index.ts` | Process payment provider webhooks | Anon (signed) | Payment Provider |
| `supabase/functions/privacy-requests/index.ts` | Handle GDPR/CCPA requests | JWT | User/Admin |
| `supabase/functions/profile-contests/index.ts` | Get user's contest history | JWT | User |
| `supabase/functions/profile-overview/index.ts` | Get user profile overview and KPIs | JWT | User |
| `supabase/functions/profile-username/index.ts` | Update username with cooldown | JWT | User |
| `supabase/functions/race-results-import/index.ts` | Import race results CSV | Service Role | Admin |
| `supabase/functions/responsible-limits/index.ts` | Manage responsible gaming limits | JWT | User/Admin |
| `supabase/functions/support-tickets/index.ts` | Create and manage support tickets | JWT/Anon | User/Public |
| `supabase/functions/user-admin-check/index.ts` | Check if user has admin role | JWT | User |
| `supabase/functions/user-consents/index.ts` | Record user consents (ToS, Privacy) | JWT | User |
| `supabase/functions/wallet-balance/index.ts` | Get user wallet balance | JWT | User |
| `supabase/functions/wallet-deposit-init/index.ts` | Initialize deposit session | JWT | User |
| `supabase/functions/wallet-deposit/index.ts` | Process deposit (deprecated) | Service Role | System |
| `supabase/functions/wallet-transactions/index.ts` | Get user transaction history | JWT | User |
| `supabase/functions/wallet-withdraw-cancel/index.ts` | Cancel pending withdrawal | JWT | User |
| `supabase/functions/wallet-withdraw-request/index.ts` | Request withdrawal with limits | JWT | User |
| `supabase/functions/wallet-withdraw/index.ts` | Process withdrawal (deprecated) | Service Role | System |

## Database Objects

### Tables (26)
| Table | RLS Enabled | Purpose |
|-------|-------------|---------|
| `audit_logs` | ✅ | System audit trail |
| `cms_pages` | ✅ | Content management pages |
| `compliance_audit_logs` | ✅ | Compliance event logging |
| `contest_entries` | ✅ | User contest entries |
| `contest_instances` | ✅ | Contest instance lifecycle |
| `contest_pools` | ✅ | Contest pools for matchmaking |
| `contest_scores` | ✅ | Contest scoring results |
| `contest_templates` | ✅ | Contest template definitions |
| `feature_flags` | ✅ | Runtime feature toggles |
| `geofence_logs` | ✅ | Geolocation compliance logs |
| `help_articles` | ✅ | Help center content |
| `kyc_verifications` | ✅ | KYC verification records |
| `license_registry` | ✅ | State license tracking |
| `match_queue` | ✅ | Matchmaking queue |
| `payment_sessions` | ✅ | Payment provider sessions |
| `privacy_requests` | ✅ | GDPR/CCPA requests |
| `profiles` | ✅ | User profile data |
| `race_results_imports` | ✅ | Race result import logs |
| `rate_limits` | ✅ | API rate limiting |
| `state_regulation_rules` | ✅ | State-by-state regulations |
| `support_tickets` | ✅ | Support ticket system |
| `transactions` | ✅ | Financial transactions |
| `user_consents` | ✅ | User consent records |
| `user_roles` | ✅ | User role assignments |
| `wallets` | ✅ | User wallet balances |
| `webhook_dedup` | ✅ | Webhook deduplication |

### Enums (3)
- `app_role`: admin, user
- `transaction_status`: pending, processing, completed, failed, cancelled
- `transaction_type`: deposit, withdrawal, entry_fee, refund, payout, bonus, adjustment, entry_fee_hold, entry_fee_release, provider_fee, platform_fee, tax

### Functions (6)
- `cleanup_old_rate_limits()`: Cleanup expired rate limit records
- `cleanup_old_webhooks()`: Cleanup old webhook dedup records
- `has_role(user_id, role)`: Check if user has specific role
- `initiate_withdrawal_atomic(...)`: Atomic withdrawal validation and locking
- `update_wallet_balance(...)`: Atomic wallet balance updates
- `handle_new_user()`: Trigger to create profile, wallet, and role on signup
- `update_updated_at_column()`: Trigger to auto-update updated_at timestamps

### Triggers
- `handle_new_user`: ON auth.users INSERT → creates profile, wallet, role

## Frontend Routes

| Route | Component | Purpose | Auth Required |
|-------|-----------|---------|---------------|
| `/` | `Index.tsx` | Landing page with hero and features | No |
| `/lobby` | `Lobby.tsx` | Browse available contests | No |
| `/contest/:id` | `ContestDetail.tsx` | Contest details and entry | Yes (for entry) |
| `/regatta/:id` | `RegattaDetail.tsx` | Regatta information | No |
| `/my-entries` | `MyEntries.tsx` | User's contest entries | Yes |
| `/profile` | `Profile.tsx` | User profile, wallet, transactions | Yes |
| `/admin` | `Admin.tsx` | Admin dashboard | Yes (admin role) |
| `/legal` | `Legal.tsx` | Legal information | No |
| `/terms` | `Terms.tsx` | Terms of service | No |
| `/privacy` | `Privacy.tsx` | Privacy policy | No |
| `/responsible-play` | `ResponsiblePlay.tsx` | Responsible gaming info | No |
| `/help` | `HelpCenter.tsx` | Help center articles | No |
| `/contact` | `Contact.tsx` | Contact form | No |
| `/login` | `Login.tsx` | User login | No |
| `/signup` | `Signup.tsx` | User registration | No |
| `*` | `NotFound.tsx` | 404 page | No |

## Shared Modules

| Path | Purpose |
|------|---------|
| `supabase/functions/shared/auth-helpers.ts` | Authentication utilities |
| `supabase/functions/shared/compliance-checks.ts` | Compliance validation |
| `supabase/functions/shared/crypto-utils.ts` | Cryptographic utilities |
| `supabase/functions/shared/error-handler.ts` | Error handling and mapping |
| `supabase/functions/shared/geo-eligibility.ts` | Geofencing and IP validation |
| `supabase/functions/shared/scoring-logic.ts` | Contest scoring algorithms |
| `supabase/functions/shared/payment-providers/factory.ts` | Payment provider factory |
| `supabase/functions/shared/payment-providers/types.ts` | Payment provider interfaces |
| `supabase/functions/shared/payment-providers/mock-adapter.ts` | Mock payment provider |
| `supabase/functions/shared/payment-providers/highrisk-adapter.ts` | HighRisk payment provider |
| `supabase/functions/shared/payment-providers/ach-adapter.ts` | ACH payment provider |

## TODO/FIXME Markers

*None found in codebase.*

## Test Status

*No test files currently in project.*

## Notes

- All RLS policies are enabled and enforced
- Service role functions require admin authentication at application layer
- Payment webhooks use signature verification instead of JWT
- Contest entry flow uses matchmaking system (newer functions supersede deprecated ones)
- Feature flags table exists but needs restructuring per Phase 5 requirements
