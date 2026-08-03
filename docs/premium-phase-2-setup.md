# PMW Visuals Premium Paddle Setup

The website now uses Paddle as the premium checkout provider.

## Current Setup

- Paddle client-side token is stored in `js/paddle-config.js`.
- The checkout page is `premium.html`.
- Premium access is still controlled by Firebase account status through `js/premium-access.js`.
- Premium wallpapers are still protected by `premium-wallpapers.html`.

## Required Paddle Setup

1. Open your Paddle dashboard.
2. Confirm the live products and prices listed in `docs/paddle-live-migration.md`.
3. Confirm `js/paddle-config.js` uses the live client-side token, `production` environment, and live `pri_...` IDs.
4. Confirm the live checkout domain is approved before opening checkout to real customers.

```js
export const PADDLE_CONFIG = {
  clientToken: "live_...",
  environment: "production",
  prices: {
    Pro: { monthly: "pri_...", yearly: "pri_..." },
    Advance: { monthly: "pri_...", yearly: "pri_..." },
    Elite: { monthly: "pri_...", yearly: "pri_..." }
  }
};
```

## Important

The client-side token is safe to keep in the public website. Do not put private Paddle API keys or webhook secrets in this repository.

## Premium Activation

Premium activation is handled by the verified Paddle webhook in Firebase Functions. The function mirrors customers, subscriptions, transactions, and webhook events into Firestore.

The current premium check accepts either:

- Firebase custom claim `premium: true`
- Firebase custom claim `role: "premium"`
- Firestore user field `premium: true`
- Firestore user field `role: "premium"`
- Firestore user field `plan: "premium"`

## Testing

Use sandbox only for testing. Use production only after Paddle business verification, domain approval, and live notification setup are complete.
