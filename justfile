# Every project task runs through `just`. Run `just` to list recipes.

set shell := ["bash", "-euo", "pipefail", "-c"]

raidlint := "cargo run --quiet --package raidlint --"

# List recipes
default:
    @just --list

# Install JS tooling
setup:
    pnpm install

# Everything CI runs: format check, lint, tests, content
check: fmt-check lint test content build

# Format Rust and JS/JSON
fmt:
    cargo fmt --all
    pnpm exec biome format --write .

# Check formatting without changing files
fmt-check:
    cargo fmt --all --check
    pnpm exec biome format .

# Lint Rust (clippy, warnings are errors), JS/JSON (Biome) and styles (tokens only, no "fan-made")
lint: lint-styles
    cargo clippy --workspace --all-targets -- -D warnings
    pnpm exec biome lint .
    pnpm --filter @raid-clinic/ui exec tsc -p . --noEmit
    pnpm --filter site check

# Run all tests
test:
    cargo test --workspace
    pnpm --filter @raid-clinic/ui test
    pnpm run test:scripts
    pnpm run test:prototype

# Validate every raid and encounter against the templates
content:
    {{raidlint}} check

# Colors and fonts only from packages/ui/src/tokens.css; no "fan-made" in the UI
lint-styles:
    node scripts/lint-styles.mjs

# Run the site at http://localhost:4321 (styleguide at /styleguide)
dev:
    pnpm --filter site dev

# Build the site into apps/site/dist
build:
    pnpm --filter site build

# Scaffold a raid:      just new-raid kings-fall "King's Fall" "Dreadnaught"
new-raid id name location:
    {{raidlint}} new-raid {{id}} --name "{{name}}" --location "{{location}}"
    pnpm exec biome format --write content/raids/{{id}}

# Scaffold an encounter: just new-encounter vault-of-glass 7 atheon "Atheon, Time's Conflux"
new-encounter raid order id name:
    {{raidlint}} new-encounter {{raid}} {{order}} {{id}} --name "{{name}}"
    pnpm exec biome format --write content/raids/{{raid}}

# Serve the single-page Atheon prototype at http://localhost:8080
prototype:
    node prototype/serve.mjs
