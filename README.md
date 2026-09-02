# SuperteamUK Startups Analytics

SuperteamUK Startups Analytics is an independent ecosystem-intelligence project. It presents an editorial archive inspired by the Superteam UK startup directory, but it is not an official Superteam UK product and does not imply endorsement by Superteam UK or any featured startup.

The current release contains three views:

- **Ecosystem Overview** summarises the reviewed sample and shows provisional charts.
- **Five-startup Archive** provides evidence-led records for PrimeSkill, END Corp, Home Harvest, Scrolly, and Fanplay/WTF Games.
- **Analytical Pipeline** explains how projects are verified, classified, routed, analysed, and published.

The charts are provisional. Do not add metrics unless their definition, source, coverage, and evidence status can be documented.

## Analytical pipeline

Each startup moves through directory intake, identity verification, technical classification, queue routing, metric extraction, quality control, and publication.

- **Queue A** contains off-chain, devnet, testnet, and sunset projects. Complete these records first.
- **Queue B** contains confirmed mainnet or hybrid projects. Analyse these later using verified addresses and raw on-chain activity.

Fanplay/WTF Games must stay in Queue B until an operational wallet or verified transaction is discovered.

## Evidence classifications

- **On-chain verified**  independently confirmed from blockchain records.
- **Founder-confirmed**  directly confirmed by a founder or authorised representative.
- **Publicly observed**  visible in an official or attributable public source.
- **Project-reported**  claimed by the project but not independently verified.
- **Not publicly verifiable**  insufficient public evidence exists to confirm the claim.

Do not silently promote a claim to a stronger evidence class.

## Install and run

Requirements: a current Node.js LTS release and npm.

```bash
npm ci
npm run dev
```

For production:

```bash
npm run build
```

The output is written to `dist`.

## Add another startup

1. Add a reviewed row under `queries.researched_startups.rows` in `src/data.json`.
2. Assign a stable `STUK-###` ID and preserve the existing fields.
3. Use only the existing evidence classifications.
4. Route off-chain/devnet/testnet projects to Queue A and confirmed mainnet/hybrid projects to Queue B.
5. Update summaries and provisional chart rows only when supported evidence changes those totals.
6. Update source labels, definitions, limitations, and coverage notes.
7. Run the protected Data App build and `npm run build`, then test every view and selection on desktop and mobile.

Read `AGENTS.md` before editing. App-specific interface work belongs under `src/content/`.

## Deploy to Vercel

Import this GitHub repository into Vercel. The committed `vercel.json` sets:

- Build command: `npm run build`
- Output directory: `dist`
- SPA fallbacks for ordinary routes and protected `/_data/*` permalinks

No environment variables are required for the current static dataset.

Do not commit secrets, local caches, `node_modules`, `.vercel`, temporary screenshots, or generated build output.
