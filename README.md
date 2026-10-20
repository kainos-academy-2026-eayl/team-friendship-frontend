# Team Friendship Frontend

## Development checks

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