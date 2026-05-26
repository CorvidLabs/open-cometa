export interface CometaLocalState {
    staked: bigint;
    field2: bigint;
    lastBlock: bigint;
    accumulator: bigint;
    raw: Uint8Array;
}

function readUint64BE(bytes: Uint8Array, offset: number): bigint {
    let result = 0n;
    for (let i = 0; i < 8; i++) {
        result = (result << 8n) | BigInt(bytes[offset + i] ?? 0);
    }
    return result;
}

function readUint256BE(bytes: Uint8Array, offset: number): bigint {
    let result = 0n;
    for (let i = 0; i < 32; i++) {
        result = (result << 8n) | BigInt(bytes[offset + i] ?? 0);
    }
    return result;
}

export function parseLocalState(raw: Uint8Array | null): CometaLocalState | null {
    if (!raw || raw.length < 60) return null;
    if (raw[0] !== 0x01 || raw[9] !== 0x01 || raw[18] !== 0x01 || raw[27] !== 0x01) {
        return null;
    }
    return {
        staked: readUint64BE(raw, 1),
        field2: readUint64BE(raw, 10),
        lastBlock: readUint64BE(raw, 19),
        accumulator: readUint256BE(raw, 28),
        raw,
    };
}
