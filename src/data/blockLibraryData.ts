import packed from "./blockLibrary.packed.json";
import { expandRows, unpackJson, type PackedJson, type PackedRows } from "./packedJson";

const data = unpackJson<PackedRows<Record<string, unknown>> & { pools: Record<string, unknown> }>(packed as PackedJson);
export default { pools: data.pools, blocks: expandRows(data) };
