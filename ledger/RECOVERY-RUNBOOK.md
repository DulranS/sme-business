# Owner account recovery — runbook

Most access problems don't need this document:

- **Forgotten password, email still accessible** → "Forgot your password?" on
  the login page (`sendPasswordResetEmail`, wired in `contexts/AuthContext.tsx`).
  Self-service, no action needed from you.
- **A manager or staff member is locked out** → the owner removes/re-invites
  them from **Team access** (`/team`). Also self-service.
- **A manager or staff member was wrongly given "owner"-level access** →
  can't happen by design. `firestore.rules` and `app/team/page.tsx` only ever
  let an invite grant `manager` or `staff` — the owner role is fixed to the
  uid the business was created under and can't be reassigned or invited away.

## The one scenario that needs you: the owner loses both password and email access

Because each business is rooted at its owner's Firebase Auth uid
(`users/{businessId}/...` where `businessId == owner's uid` — see the header
comment in `firestore.rules`), there is exactly one owner account per
business and no secondary recovery contact. If that person loses their
password **and** no longer has access to the email address on the account,
password reset can't reach them and there is no in-app path back in. This is
rare, but when it happens it's the true "11pm support fire" — handle it
yourself, deliberately, rather than building self-service recovery for an
edge case this small:

1. **Verify identity out-of-band** before touching anything — a phone call to
   a number you already had on file for them, not one they just gave you.
   Financial data is the highest-value target for exactly this social-
   engineering scenario.
2. In the Firebase Console → Authentication, locate their user by the email
   on file and update the email address to one they currently control, or
   send a fresh password-reset link directly from the console to the new
   address.
3. Confirm they can sign in, then ask them to update their email in
   **Settings → Account** to something they're confident they'll keep
   controlling.
4. Log what happened and when — who verified identity and how — in case the
   same business ever raises it again.

## If you outgrow this runbook

If manual recovery starts happening often enough to be a real time cost
(rather than a rare edge case), the next step is a secondary recovery email
or phone-based verification — but that's real scope (a new field on the
account, a new verification flow, a new thing that can itself be
compromised), not a quick addition, so don't build it speculatively ahead of
actually needing it.
