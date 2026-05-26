import farmsData from "./farms.json";

export interface Farm {
    id: number;
    type: "farm" | "distribution";
    version: string;
    desc: string | null;
    stake: number | null;
    reward: number | null;
    rewardName: string | null;
    rewardDecimals: number | null;
    lockBlocks: number;
    endBlock: number | null;
    algoRewards: boolean;
}

const farms = farmsData.farms as Farm[];

export const ALL_FARMS: ReadonlyArray<Farm> = farms;

const byId = new Map<number, Farm>(farms.map((f) => [f.id, f] as const));

export function farmById(id: number): Farm | undefined {
    return byId.get(id);
}

export const ALL_APP_IDS: ReadonlySet<number> = new Set(farms.map((f) => f.id));
