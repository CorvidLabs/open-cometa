import type { AccountInfo } from "./algorand.ts";
import { ALL_APP_IDS, farmById, type Farm } from "./farms.ts";
import { parseLocalState, type CometaLocalState } from "./localState.ts";

export interface Position {
    farm: Farm;
    staked: bigint;
    localState: CometaLocalState | null;
}

export function findCometaPositions(account: AccountInfo): Position[] {
    const positions: Position[] = [];
    for (const app of account.apps) {
        if (!ALL_APP_IDS.has(app.id)) continue;
        const farm = farmById(app.id);
        if (!farm) continue;
        const localState = parseLocalState(app.localState);
        const staked = localState?.staked ?? 0n;
        positions.push({ farm, staked, localState });
    }
    positions.sort((a, b) => {
        if (b.staked !== a.staked) return b.staked > a.staked ? 1 : -1;
        return a.farm.id - b.farm.id;
    });
    return positions;
}
