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
check: fmt-check lint test content

# Format Rust and JS/JSON
fmt:
    cargo fmt --all
    pnpm exec biome format --write .

# Check formatting without changing files
fmt-check:
    cargo fmt --all --check
    pnpm exec biome format .

# Lint Rust (clippy, warnings are errors) and JS/JSON (Biome)
lint:
    cargo clippy --workspace --all-targets -- -D warnings
    pnpm exec biome lint .

# Run all tests
test:
    cargo test --workspace
    pnpm run test:prototype

# Validate every raid and encounter against the templates
content:
    {{raidlint}} check

# Scaffold a raid:      just new-raid vault-of-glass "Vault of Glass"
new-raid id name:
    {{raidlint}} new-raid {{id}} --name "{{name}}"
    pnpm exec biome format --write content/raids/{{id}}

# Scaffold an encounter: just new-encounter vault-of-glass 7 atheon "Atheon, Time's Conflux"
new-encounter raid order id name:
    {{raidlint}} new-encounter {{raid}} {{order}} {{id}} --name "{{name}}"
    pnpm exec biome format --write content/raids/{{raid}}

# Serve the single-page Atheon prototype at http://localhost:8080
prototype:
    node prototype/serve.mjs
