# Wallpaper Protection Deployment

The public website now receives sanitized wallpaper metadata from Firebase
Functions. Clean Cloudinary URLs and public IDs remain in the administrator-only
`wallpapers` collection and are never returned by the public metadata endpoints.

## Required Cloudinary secret

Set one JSON secret containing every Cloudinary product environment referenced by
the `wallpapers` collection:

```powershell
firebase functions:secrets:set CLOUDINARY_ACCOUNTS_JSON
```

Paste a single-line JSON value when prompted:

```json
{"cloud_name_one":{"apiKey":"API_KEY","apiSecret":"API_SECRET"},"cloud_name_two":{"apiKey":"API_KEY","apiSecret":"API_SECRET"}}
```

Do not add real credentials to `.env`, Git, HTML, or browser JavaScript.

## Deploy

```powershell
firebase deploy --only functions,firestore:rules
```

The deployed Functions are:

- `listWallpapers`: public sanitized gallery metadata.
- `getWallpaperMetadata`: public sanitized detail-page status.
- `wallpaperPreview`: reduced-resolution preview bytes.
- `downloadWallpaper`: free delivery or subscription-verified temporary premium delivery.

## Cloudinary asset protection

For strongest protection, upload or migrate premium originals as Cloudinary
`private` or `authenticated` delivery assets and save their `deliveryType` in the
administrator wallpaper record. Keep the protected original in `imageUrl` and
store a separate public, reduced derivative in the optional `previewUrl` field.
The public site receives only the Firebase `wallpaperPreview` proxy URL.

Public `upload` originals are hidden from the website source after this change,
but an old URL previously indexed or shared can still remain reachable at
Cloudinary. Moving premium originals to private/authenticated delivery is the
step that closes that historical URL path.

Premium access is granted only when the signed-in Firebase user maps to a Paddle
subscription whose mirrored status is `active` or `trialing`. A scheduled
cancellation does not remove access until Paddle changes the subscription status.
