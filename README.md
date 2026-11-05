# Team Friendship Frontend

## Colour theme

The sidebar's **Dark mode** switch applies to all pages, including admin and
authentication pages. The shared layout loads `public/scripts/theme.js` before
the stylesheet to restore the saved theme without a light-theme flash.
The browser stores the choice under `friendshop-theme` in localStorage. Until a
choice is saved, the theme follows the device's colour preference. Open tabs
synchronise preference changes. If storage is blocked, the switch still works
on the current page and displays a warning that the preference cannot be saved.
Shared CSS colour variables cover surfaces, forms, navigation, buttons and
semantic alerts. Product images are not inverted. Theme settings are local to
the browser, not the user's account or other devices.

## Development checks

The home page's featured products use a small browser-side carousel script.
Three products are visible and each arrow moves by one product without navigating.
The row also supports touch/trackpad scrolling and keyboard arrows, and respects
reduced-motion preferences. Without JavaScript, the product row remains scrollable.
These are curated featured products, not automatically ranked by sales.

Use Node.js 22 (see [.nvmrc](.nvmrc)) and install dependencies with `npm ci`.

| Command | Purpose |
| --- | --- |
| `npm run build` | Type-check and bundle the application. |
| `npm run lint` | Check lint rules, formatting and import order with Biome; warnings also fail. |
| `npm run lint:fix` | Apply safe automatic fixes and report remaining issues. |
| `npm test` | Run Vitest once; failing or missing tests fail the command. |

[biome.json](biome.json) defines recommended lint rules, two-space
indentation, single JavaScript quotes and semicolons. Generated files and
Git-ignored files are excluded.

Husky installs the [pre-push hook](.husky/pre-push) during `npm ci`.
It runs `npm run lint` and blocks pushes on failure. Fix diagnostics with
`npm run lint:fix` and resolve any remaining issues before retrying.
Local hooks can be bypassed, so CI runs the checks independently.

## Reset password page

Set `BACKEND_URL` to the backend origin. The reset email link should point to
`/reset_password` with both `email` and `token` query parameters. The email is
displayed read-only and the token is kept in a hidden form field. Each password
field has its own Show/Hide control.
The page is rendered server-side by [resetPasswordController.ts](src/controllers/resetPasswordController.ts)
using [resetPasswordService.ts](src/services/resetPasswordService.ts).
The password Show/Hide eye is also server-side: it is a submit button that posts
to `/reset_password/toggle-password` (or `/login/toggle-password` on the login
page), and [passwordVisibilityService.ts](src/services/passwordVisibilityService.ts)
decides which fields to re-render as visible. No browser JavaScript is used.
Submitting the form posts to `/reset_password`, where the server checks that the
new password has at least 8 characters, one number and one special character,
and that both passwords match. The frontend then posts the email, token and new
password to the backend's `/reset-password` endpoint. The backend validates the
single-use token and saves the hashed password in the database; its response is
shown on the reset page. Errors are shown under each field.
When reset submission is implemented, the account must be identified using a
validated reset token, not the editable URL email parameter.

## Admin portal (frontend integration)

The existing login form redirects users to `/admin` when the backend's successful
`POST /login` response includes `customer.role: "admin"`. Customer login and
return destinations are unchanged. The frontend does not contain an admin
password, create accounts, connect to PostgreSQL, or grant access by email.
The backend must provision `admin@friendshop.com` with the agreed password,
store its password hash, and authenticate it using the existing login endpoint.

The portal is rendered by [adminController.ts](src/controllers/adminController.ts)
using [adminService.ts](src/services/adminService.ts). It uses the existing
HttpOnly session cookies and sends the access token to the backend as a Bearer
token. Every request checks `/me`; only `role: "admin"` can access the page or
submit a reorder. The admin sidebar link is visible only to verified admins.
Responses use `Cache-Control: no-store`; stock changes are POST-only and protected
by the application's same-origin middleware.

### Backend API required (not implemented in this frontend)

These are proposed contracts for the backend implementation, not existing
endpoints. Until the backend supports them, admin access/data will not work.
Errors are displayed explicitly; missing data is never displayed as zero totals.

- `POST /login`: keep the existing token response and add
  `customer: { "role": "admin" }` for administrators. Other users must not be able
  to assign themselves a role during login or registration.
- `GET /me`: keep `customerId` and add a trusted `role` (`"admin"` or `"customer"`).
  Check the stored role on the backend, including after session refresh.
- `GET /admin/dashboard?period=today|week|month`: require a valid admin access
  token and return the following JSON:

  ```json
  {
    "period": "today",
    "totalOrders": 12,
    "revenue": 1234.50,
    "currency": "GBP",
    "lowStockProducts": [
      { "productID": 1, "productName": "Example product", "productStock": 0 },
      { "productID": 2, "productName": "Another product", "productStock": 4 }
    ]
  }
  ```

  Compute totals in PostgreSQL on the backend. `today` means local midnight
  onward, `week` means Monday midnight onward, and `month` means the first day
  of the current month onward, each through the current time. Use one explicit
  business timezone for all boundaries (proposed: `Europe/London`).
  `totalOrders` is a distinct order count, not the sum of item quantities.
  Revenue is a numeric amount in pounds, not pennies or a formatted string;
  agree eligible order statuses on the backend (proposed: paid/completed orders,
  excluding cancelled/refunded orders). The current schema has no historical
  order-line price: the backend needs that information to calculate accurate
  historical revenue rather than using today's product prices.
  Return **all** current products with `productStock < 5`, independent of the
  sales period. Quantities must be nonnegative integers. Zero-stock products
  are separated into a prominent red section; quantities 1-4 show amber alerts.
- `POST /admin/products/:id/reorder`: require admin authorisation, accept no
  quantity from the frontend, and atomically increment the database's
  `productStock` by **20**. Return HTTP 200 with
  `{ "product": { "productID": 1, "productName": "Example product", "productStock": 20 } }`.
  This is a simple inventory increment, not a supplier purchase order.
  Return 404 for an unknown product, 401 for an invalid/expired session, and
  403 for a non-admin. Never rely on the frontend to enforce these permissions.

The period dropdown uses an **Update overview** submit button, with no browser
JavaScript. Reorder success redirects back to the selected period and fetches
fresh stock from the backend. A failed/uncertain update shows an error rather
than changing the displayed quantity optimistically; refresh before retrying an
uncertain update to avoid adding stock twice.

## Continuous integration

The [Frontend CI workflow](.github/workflows/github-actions.yml) installs
locked dependencies, builds, lints and runs Vitest on:

- Opened, updated, reopened and ready-for-review pull requests.
- Pushes to `main` or `master`, including merged branches.
- Merge queue checks, if enabled.

Any failed step fails the **Build, lint and test** check.

### Required GitHub configuration: block failing PRs

A workflow alone cannot block merging. A repository administrator must
create an **Active** branch ruleset in **Settings > Rules > Rulesets**:

1. Target `main`.
2. Enable **Require a pull request before merging**.
3. Enable **Require status checks to pass** and select **Build, lint and test**
   from the **GitHub Actions** app after this workflow has run once.
4. Enable **Require branches to be up to date before merging**, or use a
   merge queue.
5. Leave the bypass list empty to prevent overrides.

These settings must be applied in GitHub; they are not configured by the
workflow file.