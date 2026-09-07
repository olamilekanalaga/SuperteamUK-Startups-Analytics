# Purebet measurement architecture

This directory scaffolds the reproducible measurement pipeline without loading or inventing production transaction rows.

## Lineage

Purebet protocol sources (current and legacy) → immutable raw transactions → normalized protocol events → qualified betting wallets → business metrics → metric snapshots → frontend contract.

## Controls

- Current and legacy programs are calculated separately. Combined results stay disabled until cross-program wallet deduplication is validated.
- A wallet is a betting-wallet proxy, not a verified human. Qualification requires a decoded, successful, user-originated betting interaction; fee payer or signer status alone is insufficient.
- Betting volume is the decoded qualifying stake placed. Settlement and payout values are excluded so stake and payout cannot be double-counted.
- Missing production rows yield an empty contract and unavailable snapshots with null values. Missing evidence never becomes a numeric zero.
- Raw extracts are immutable. Adapters must ingest a bounded window and retain retrieval provenance.

## Future source insertion

1. Implement IngestionAdapter.fetchTransactions for the approved source (Dune export or archival Solana provider).
2. Store immutable extracts outside src/data.json, under data/purebet/raw/.
3. Write and approve a decoder specification before implementing a ProtocolDecoder for PlaceBet.
4. Produce normalized events with source ID, transaction signature, instruction index, wallet, stake amount, token decimals, decoder version and confidence.
5. Pass events grouped by purebet-current-program or purebet-legacy-program to runPurebetMeasurement.
6. Validate a bounded current-program slice against known checkpoints before publishing any result.

No production transaction data is included in this scaffold.