# Paddle Live Migration Notes

Status: live catalog created and local checkout config switched to live IDs. Do not open live checkout to customers until Paddle verifies the business and approves the checkout domain.

## Live Catalog Created

The sandbox catalog was recreated in live as three clean products, each with monthly and yearly subscription prices. The product names were then updated in Paddle from `Starter`, `Pro`, and `Advanced` to `Pro`, `Advance`, and `Elite`.

| Tier | Live product ID |
| --- | --- |
| Pro | `pro_01kxsfyjjvz298v8w0yyc0a7sv` |
| Advance | `pro_01kxsfym65bz37fhp98ybjbyfv` |
| Elite | `pro_01kxsfyn5xhpxdkz3r4y2e0hp0` |

## Price ID Mapping

| Tier | Billing | Sandbox price ID | Live price ID |
| --- | --- | --- | --- |
| Pro | Monthly | `pri_01kx81warb6jfesz3awzzxyn4v` | `pri_01kxsfyk134yk1y741d0vcm45c` |
| Pro | Yearly | `pri_01kx826h5xqqt2sje6j94azkgj` | `pri_01kxsfyktcfcqnckvgjchebghv` |
| Advance | Monthly | `pri_01kx81z21ke3yfeh52y6s79j34` | `pri_01kxsfymg1vph3sg7dw4amqcq6` |
| Advance | Yearly | `pri_01kx828jc4dzy23nwe7fe79hz2` | `pri_01kxsfymt7297wfdk1a4s5vgsv` |
| Elite | Monthly | `pri_01kx820hy8vw78t19xfs9w5n4g` | `pri_01kxsfynf6yx2790jnrheb3hp4` |
| Elite | Yearly | `pri_01kx82a4xbqsjs2bv0hhm6avay` | `pri_01kxsfynvy8602e8pyyx255wvc` |

## Client-Side Tokens

| Environment | Client-side token |
| --- | --- |
| Sandbox | `test_9462cd67818764d9e2dc77a8831` |
| Live | `live_e1acf603a496c5dc11e7662eb81` |

`js/paddle-config.js` now uses the live client-side token, `production` environment, and the live price IDs above.

## Live Webhook IP Allowlist

The Firebase webhook fetches Paddle's current live IPs from:

```text
https://api.paddle.com/ips
```

Current response observed on 2026-07-18:

```text
34.237.3.244/32
34.195.105.136/32
34.232.58.13/32
35.155.119.135/32
34.212.5.7/32
52.11.166.252/32
```

The list is not hard-coded in the function. It is fetched dynamically and cached for one hour. The allowlist is enforced only when `PADDLE_ENV` is `production` or `live`.

## Live Setup Still Needed

1. In Paddle live, confirm business/identity verification is complete.
2. In Paddle live, add and approve the checkout domain:

```text
pmwvisuals.com
```

3. In Paddle live, set the default payment link under **Checkout > Checkout settings** to:

```text
https://pmwvisuals.com/premium.html
```

4. Create a live notification destination pointing to:

```text
https://us-central1-pmw-visuals-b14e8.cloudfunctions.net/paddleWebhook
```

5. Select these events:

```text
customer.created
customer.updated
subscription.created
subscription.activated
subscription.updated
subscription.canceled
transaction.completed
```

6. Set Firebase Functions to live before deploying the live backend:

```bash
firebase functions:secrets:set PADDLE_API_KEY
firebase functions:secrets:set PADDLE_NOTIFICATION_WEBHOOK_SECRET
firebase deploy --only functions
```

When Firebase asks for `PADDLE_ENV`, enter:

```text
production
```

7. Set these live price IDs in Firebase environment/params if you want exact plan names mirrored in Firestore:

```text
PADDLE_PRO_MONTHLY_PRICE_ID=pri_01kxsfyk134yk1y741d0vcm45c
PADDLE_PRO_YEARLY_PRICE_ID=pri_01kxsfyktcfcqnckvgjchebghv
PADDLE_ADVANCE_MONTHLY_PRICE_ID=pri_01kxsfymg1vph3sg7dw4amqcq6
PADDLE_ADVANCE_YEARLY_PRICE_ID=pri_01kxsfymt7297wfdk1a4s5vgsv
PADDLE_ELITE_MONTHLY_PRICE_ID=pri_01kxsfynf6yx2790jnrheb3hp4
PADDLE_ELITE_YEARLY_PRICE_ID=pri_01kxsfynvy8602e8pyyx255wvc
```

8. Verify live checkout opens on the approved real domain before opening it to customers.
