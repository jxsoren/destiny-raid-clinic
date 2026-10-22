---
name: start-dev
description: Start the destiny-raid-clinic local dev environment (check tools, install JS deps, launch the dev server in the background, verify it responds, hand back the URL). Use this whenever the user wants to run, start, launch, serve, spin up or boot this project locally, says things like "run dev", "start the server", "fire it up", "open the Atheon trainer", "let me see it in the browser", or needs the app running to check a change, even if they don't say "dev environment".
---

# Start the local dev environment

The goal is a running local server the user can open, with as little friction as possible: check what's installed, install only what the project needs, start the server in the background, prove it responds, and give the user the URL plus how to stop it.

## 1. Find the repo root

Run commands from the repository root (`git rev-parse --show-toplevel`). Every task goes through the `justfile` there.

## 2. Check the tools

Check in one command: `just --version`, `pnpm --version`, `node --version`, `cargo --version`.

| Tool | Needed for | If missing, suggest |
|---|---|---|
| `just` | every task | `brew install just` |
| `pnpm` | JS tooling | `npm install -g pnpm@<version>` (or `brew install pnpm`), using the version pinned in `package.json`'s `packageManager`. Not `corepack enable`: older Corepack (e.g. 0.31, bundled with Node 23) can't run pnpm 12 and fails with `Cannot find module …/corepack/…/bin/pnpm.cjs`. If you see that error, run `corepack disable pnpm`, delete that cache folder, and install pnpm with npm |
| Node ≥ 22 | dev server, tests | `brew install node` |
| `cargo` | Rust crates, `just check` | `brew install rustup && rustup-init`. Prefer rustup over Homebrew's `rust`, because it honors `rust-toolchain.toml` and can add the WebAssembly target |

Installing a tool changes the user's machine, so ask before running any install command. If only `cargo` is missing, the dev server can still start, so carry on and mention it.

## 3. Install project dependencies

Run `just setup` when `node_modules/` is missing, or when `pnpm-lock.yaml` or `package.json` is newer than `node_modules/`. Otherwise skip it, so startup stays fast.

## 4. Pick the server recipe

Run `just --list`.
- If there's a `dev` recipe, use `just dev`. That's the full site, which arrives in a later build step.
- Otherwise use `just prototype`, the single-page Atheon trainer.

Re-check this each time rather than assuming, because the project is mid-migration and the recipes change.

## 5. Start it without clobbering anything

`just dev` (the Astro site) listens on 4321. `just prototype` listens on `PORT`, default 8080. Check the port that matches the recipe you chose.

1. Check the port: `lsof -nP -iTCP:<port> -sTCP:LISTEN`.
   - If something is listening, `curl -s http://localhost:<port>/` and see whether it's this project. The landing page title is "Destiny Raid Clinic".
   - If it is, it's already running: reuse it and skip to step 6.
   - If it's something else, don't kill it. Use the next free port (`PORT=8081 just prototype`, and so on).
2. Start the server as a background task, using the Bash tool's `run_in_background`, so it keeps running after this turn. A trailing `&` dies with the shell.
3. Wait until it answers. Poll `curl -s -o /dev/null -w "%{http_code}"` on the root URL for up to about 10 seconds. If it never returns 200, read the background task's output and report the actual error instead of guessing.

## 6. Verify and hand off

- Confirm the URLs return 200. For `just dev`, that's `/` and `/styleguide`. For the prototype, it's `/` and `/vault-of-glass/atheon/`.
- Tell the user:
  - the URL to open: `http://localhost:<port>/`, and the trainer link
  - that the trainer loads three.js and fonts from CDNs, so it needs an internet connection
  - how to stop it: stop the background task, or `pkill -f prototype/serve.mjs`
- Open the browser (`open <url>` on macOS) only if the user asked to open or see it.

Keep the report to a few lines: what started, where, and how to stop it. Mention a missing tool only if it affected startup.

## If something fails

- **`just: command not found` inside the recipe** (for example, pnpm missing): see step 2. Offer the install command, and don't run it without asking.
- **Port errors after the check:** another process grabbed the port. Pick the next one and retry once.
- **The page loads but the 3D view is black or blank:** that's a rendering problem, not a startup problem. Report the server as up and point to the browser console.
