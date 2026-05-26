import algosdk from "algosdk";

export const ALGOD_URL = "https://mainnet-api.algonode.cloud";
export const INDEXER_URL = "https://mainnet-idx.algonode.cloud";

export const algod = new algosdk.Algodv2("", ALGOD_URL, "");
export const indexer = new algosdk.Indexer("", INDEXER_URL, "");

export interface OptedInApp {
    id: number;
    localState: Uint8Array | null;
}

export interface AssetHolding {
    assetId: number;
    amount: bigint;
}

export interface AccountInfo {
    address: string;
    amount: bigint;
    minBalance: bigint;
    assets: ReadonlyArray<AssetHolding>;
    apps: ReadonlyArray<OptedInApp>;
}

function b64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function asBytes(value: unknown): Uint8Array | null {
    if (value instanceof Uint8Array) return value;
    if (typeof value === "string") return b64ToBytes(value);
    return null;
}

function decodeLocalStateBytes(kvs: ReadonlyArray<algosdk.modelsv2.TealKeyValue> | undefined): Uint8Array | null {
    if (!kvs) return null;
    for (const kv of kvs) {
        const keyBytes = asBytes(kv.key);
        if (!keyBytes) continue;
        if (keyBytes.length === 1 && keyBytes[0] === 0x00 && Number(kv.value.type) === 1) {
            const raw = asBytes(kv.value.bytes);
            if (raw) return raw;
        }
    }
    return null;
}

export async function fetchAccount(address: string): Promise<AccountInfo> {
    const raw = await algod.accountInformation(address).do();
    const amount = BigInt(raw.amount);
    const minBalance = BigInt(raw.minBalance);

    const assets: AssetHolding[] = (raw.assets ?? []).map((a) => ({
        assetId: Number(a.assetId),
        amount: BigInt(a.amount),
    }));

    const apps: OptedInApp[] = (raw.appsLocalState ?? []).map((a) => ({
        id: Number(a.id),
        localState: decodeLocalStateBytes(a.keyValue),
    }));

    return { address, amount, minBalance, assets, apps };
}

export async function fetchAssetInfo(assetId: number): Promise<{
    id: number;
    name: string;
    unitName: string;
    decimals: number;
}> {
    const raw = await algod.getAssetByID(assetId).do();
    return {
        id: assetId,
        name: raw.params.name ?? "",
        unitName: raw.params.unitName ?? "",
        decimals: Number(raw.params.decimals),
    };
}

export function formatAmount(raw: bigint, decimals: number): string {
    if (decimals === 0) return raw.toString();
    const s = raw.toString().padStart(decimals + 1, "0");
    const whole = s.slice(0, -decimals);
    const frac = s.slice(-decimals).replace(/0+$/, "");
    return frac.length === 0 ? whole : `${whole}.${frac}`;
}
