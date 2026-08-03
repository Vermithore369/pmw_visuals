# Paddle Fulfillment Setup

This site uses Firebase Authentication, Firestore, and Firebase Cloud Functions to mirror Paddle subscription state.

## Function Endpoints

After deploying Firebase Functions, use these endpoints:

- Webhook: `https://us-central1-pmw-visuals-b14e8.cloudfunctions.net/paddleWebhook`
- Customer portal: `https://us-central1-pmw-visuals-b14e8.cloudfunctions.net/createPaddlePortalSession`

## Required Environment Variables

Create `functions/.env` locally using `functions/.env.example` as the template. Keep real keys out of Git.

Required values:

- `PADDLE_ENV=production` for live, or `PADDLE_ENV=sandbox` only while testing sandbox checkout
- `PADDLE_API_KEY`
- `PADDLE_NOTIFICATION_WEBHOOK_SECRET`
- `PADDLE_PRO_MONTHLY_PRICE_ID`
- `PADDLE_PRO_YEARLY_PRICE_ID`
- `PADDLE_ADVANCE_MONTHLY_PRICE_ID`
- `PADDLE_ADVANCE_YEARLY_PRICE_ID`
- `PADDLE_ELITE_MONTHLY_PRICE_ID`
- `PADDLE_ELITE_YEARLY_PRICE_ID`

## Paddle Notification Destination

Create a notification destination in the matching Paddle environment:

1. Open Paddle Sandbox for testing, or Paddle Live for production.
2. Go to **Developer tools > Notifications**.
3. Add a destination with the webhook URL above.
4. Select these events:
   - `customer.created`
   - `customer.updated`
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `transaction.completed`
5. Copy the destination signing secret into `PADDLE_NOTIFICATION_WEBHOOK_SECRET`.

The signing secret is not the Paddle API key. The webhook handler rejects deliveries unless Paddle signature verification passes.

For live checkout, make sure the live Paddle checkout domain is approved before sending real customers to the pricing page.

## Firestore Collections

The webhook creates and updates these collections:

- `paddleCustomers`
- `paddleSubscriptions`
- `paddleTransactions`
- `paddleWebhookEvents`

Existing user documents remain in `users/{uid}`. When a Paddle customer email matches a Firebase user email, the function updates:

- `premium`
- `role`
- `plan`
- `paddleCustomerId`
- `paddleSubscriptionId`
- `paddleSubscriptionStatus`

Access is granted only when the subscription status is `active` or `trialing`. A scheduled cancellation does not remove access until Paddle sends a real canceled status.

## Deploy

From the repository root:

```bash
cd functions
pnpm install
cd ..
firebase deploy --only functions
```

Do not delete notification destinations, Paddle products/prices, customers, subscriptions, transactions, or Firestore mirror rows as cleanup. They are part of the fulfillment system.
