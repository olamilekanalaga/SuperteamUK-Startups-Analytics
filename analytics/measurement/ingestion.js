import { validateRawTransaction } from "./schemas.js";
export class IngestionAdapter {
  constructor(name) { if (!name) throw new TypeError("Ingestion adapter name is required"); this.name = name; }
  async fetchTransactions() { throw new Error(`${this.name}.fetchTransactions must be implemented`); }
}
export async function ingestTransactions({ adapter, source, window }) {
  if (!(adapter instanceof IngestionAdapter)) throw new TypeError("adapter must extend IngestionAdapter");
  if (!source?.address) throw new TypeError("source with an address is required");
  if (!window?.from || !window?.to) throw new TypeError("bounded ingestion window is required");
  const records = await adapter.fetchTransactions({ source, window });
  if (!Array.isArray(records)) throw new TypeError("ingestion adapter must return an array");
  const seen = new Set();
  return records.map((record) => {
    const validated = validateRawTransaction(record);
    const key = `${source.address}:${validated.txSignature}`;
    if (seen.has(key)) throw new Error(`duplicate raw transaction within source: ${validated.txSignature}`);
    seen.add(key);
    return validated;
  });
}
export class ProtocolDecoder {
  constructor({ protocol, version }) { if (!protocol || !version) throw new TypeError("decoder protocol and version are required"); this.protocol = protocol; this.version = version; }
  decode() { throw new Error(`${this.protocol} decoder ${this.version} must implement decode`); }
}