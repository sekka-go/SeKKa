> Historical engineering context — not current product requirements or evidence of active frontend integration. [PRD v3.1](PRD.md) is the sole authority; [current status](IMPLEMENTATION_STATUS.md) records today’s implementation gaps.

# Open decisions and launch blockers

These are not approvals granted by implementation.

| Item | Required decision / evidence | Current behavior |
|---|---|---|
| Payment partner and custody/refunds | Suitable provider and signed-off operating policies | Real-money gate false; no provider API or wallet credit endpoint exposed |
| Incomplete dual confirmation | Deadline, escalation, evidence and refunds | Security retained; never forfeited automatically |
| Cancellation before first service | Approved refund and seat-release policy | Cancellation mutation not offered |
| Multiple open bookings | Per-seat reservation policy and limits | Production financial gate closed; no commercial policy inferred |
| Renewal priority | Exact window, eligibility, protection across weekly/monthly directions, last-48h rule | Renewal disabled; not safe to activate money before implementation |
| Legal terms and retention | Approved terms/privacy text, document retention and deletion policy | Profile registration gate false |
| Phone OTP provider | Provider setup, delivery testing, pricing approval | Supabase adapter coded; live SMS not verified |
| Official Egyptian holidays | Approved date coverage with official announcements incl shifted holidays | No calendar seeded; quotes fail closed |
| Captain multiple-line overlap | Duration/travel-time margin and schedule validation | Second active route blocked pending review |
| Discovery maps | Geocoding/route fit provider and accuracy/cost evidence | Text endpoints and ±30-minute filters only; no spatial ranking claim |
| Verified supply | Ten real verified lines | Not seeded or fabricated |
| Historic identities/data | UUID mapping/re-verification and compatible record review | No legacy rows migrated |
| Notification delivery | Push provider/VAPID approval | In-app only; no push success claimed |

Implementing the remaining policy-independent work does not authorize commercial launch or production cutover.
