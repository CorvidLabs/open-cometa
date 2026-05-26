import algosdk from "algosdk";
import { algod, indexer } from "./algorand.ts";

const METHOD_TAG_CLAIM = 0x00;
const METHOD_TAG_UNSTAKE = 0x03;

const ARG0_STEP = new Uint8Array([0x00]);
const ARG1_API = new Uint8Array([0x03]);
const ARG2_TIME = new Uint8Array(8);

export interface CallTemplate {
    accounts: ReadonlyArray<string>;
    foreignAssetsClaim: ReadonlyArray<number>;
    foreignAssetsUnstake: ReadonlyArray<number>;
    foreignApps: ReadonlyArray<number>;
}

const templateCache = new Map<number, Promise<CallTemplate>>();

export function clearTemplateCache(): void {
    templateCache.clear();
}

interface SampledAppCall {
    accounts: string[];
    foreignAssets: number[];
    foreignApps: number[];
}

function looksLikeApiCall(args: ReadonlyArray<Uint8Array> | undefined): {
    isClaim: boolean;
    isUnstake: boolean;
} {
    if (!args || args.length < 4) return { isClaim: false, isUnstake: false };
    const variant = args[3];
    if (!variant || variant.length !== 9) return { isClaim: false, isUnstake: false };
    const tag = variant[0];
    return { isClaim: tag === METHOD_TAG_CLAIM, isUnstake: tag === METHOD_TAG_UNSTAKE };
}

async function discoverTemplate(appId: number): Promise<CallTemplate> {
    let claimSample: SampledAppCall | null = null;
    let unstakeSample: SampledAppCall | null = null;
    let stableAccounts: string[] | null = null;

    let nextToken: string | undefined;
    for (let page = 0; page < 4 && (!claimSample || !unstakeSample); page++) {
        const search = await indexer
            .searchForTransactions()
            .applicationID(appId)
            .txType("appl")
            .limit(200)
            .nextToken(nextToken ?? "")
            .do();

        for (const t of search.transactions ?? []) {
            const ac = t.applicationTransaction;
            if (!ac) continue;
            const { isClaim, isUnstake } = looksLikeApiCall(ac.applicationArgs);
            if (!isClaim && !isUnstake) continue;

            const accountsList = (ac.accounts ?? []).map((a) => a.toString());
            const foreignAssets = (ac.foreignAssets ?? []).map((id) => Number(id));
            const foreignApps = (ac.foreignApps ?? []).map((id) => Number(id));

            if (accountsList.length > 0 && !stableAccounts) {
                stableAccounts = accountsList;
            }
            const sample: SampledAppCall = { accounts: accountsList, foreignAssets, foreignApps };
            if (isClaim && !claimSample) claimSample = sample;
            if (isUnstake && !unstakeSample) unstakeSample = sample;
        }
        nextToken = search.nextToken;
        if (!nextToken) break;
    }

    if (!claimSample && !unstakeSample) {
        throw new Error(
            `Could not find recent claim/unstake transactions on app ${appId} to derive call template. ` +
            `This farm may not have any usage history.`,
        );
    }

    const accounts = stableAccounts ?? [];
    const foreignAssetsClaim = claimSample?.foreignAssets ?? unstakeSample?.foreignAssets ?? [];
    const foreignAssetsUnstake = unstakeSample?.foreignAssets ?? claimSample?.foreignAssets ?? [];
    const foreignApps = claimSample?.foreignApps ?? unstakeSample?.foreignApps ?? [];

    return {
        accounts,
        foreignAssetsClaim: [...foreignAssetsClaim],
        foreignAssetsUnstake: [...foreignAssetsUnstake],
        foreignApps: [...foreignApps],
    };
}

export function getCallTemplate(appId: number): Promise<CallTemplate> {
    const cached = templateCache.get(appId);
    if (cached) return cached;
    const promise = discoverTemplate(appId).catch((err) => {
        templateCache.delete(appId);
        throw err;
    });
    templateCache.set(appId, promise);
    return promise;
}

function encodeUint64BE(value: bigint): Uint8Array {
    const out = new Uint8Array(8);
    let v = value;
    for (let i = 7; i >= 0; i--) {
        out[i] = Number(v & 0xffn);
        v >>= 8n;
    }
    return out;
}

function buildVariant(tag: number, value: bigint): Uint8Array {
    const out = new Uint8Array(9);
    out[0] = tag;
    out.set(encodeUint64BE(value), 1);
    return out;
}

export interface BuildCallParams {
    sender: string;
    appId: number;
    template: CallTemplate;
    suggestedParams: algosdk.SuggestedParams;
}

export function buildClaimTxn(p: BuildCallParams): algosdk.Transaction {
    const variant = buildVariant(METHOD_TAG_CLAIM, 0n);
    return algosdk.makeApplicationCallTxnFromObject({
        sender: p.sender,
        appIndex: p.appId,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        appArgs: [ARG0_STEP, ARG1_API, ARG2_TIME, variant],
        accounts: [...p.template.accounts],
        foreignAssets: [...p.template.foreignAssetsClaim],
        foreignApps: [...p.template.foreignApps],
        suggestedParams: { ...p.suggestedParams, fee: 4000n, flatFee: true },
    });
}

export function buildUnstakeTxn(p: BuildCallParams & { amount: bigint }): algosdk.Transaction {
    const variant = buildVariant(METHOD_TAG_UNSTAKE, p.amount);
    return algosdk.makeApplicationCallTxnFromObject({
        sender: p.sender,
        appIndex: p.appId,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        appArgs: [ARG0_STEP, ARG1_API, ARG2_TIME, variant],
        accounts: [...p.template.accounts],
        foreignAssets: [...p.template.foreignAssetsUnstake],
        foreignApps: [...p.template.foreignApps],
        suggestedParams: { ...p.suggestedParams, fee: 4000n, flatFee: true },
    });
}

export interface PositionWithdrawTxns {
    txns: algosdk.Transaction[];
    rewardAssetId: number | null;
    stakeAssetId: number | null;
}

export async function buildWithdrawAndClaim(params: {
    sender: string;
    appId: number;
    stakedAmount: bigint;
    optedInAssets: ReadonlySet<number>;
}): Promise<PositionWithdrawTxns> {
    const template = await getCallTemplate(params.appId);
    const suggestedParams = await algod.getTransactionParams().do();

    const stakeAssetId = template.foreignAssetsUnstake[0] ?? null;
    const rewardAssetId = template.foreignAssetsClaim[0] ?? null;

    const txns: algosdk.Transaction[] = [];

    if (rewardAssetId !== null && rewardAssetId !== 0 && !params.optedInAssets.has(rewardAssetId)) {
        txns.push(
            algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                sender: params.sender,
                receiver: params.sender,
                amount: 0,
                assetIndex: rewardAssetId,
                suggestedParams,
            }),
        );
    }
    if (
        stakeAssetId !== null &&
        stakeAssetId !== 0 &&
        stakeAssetId !== rewardAssetId &&
        !params.optedInAssets.has(stakeAssetId)
    ) {
        txns.push(
            algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                sender: params.sender,
                receiver: params.sender,
                amount: 0,
                assetIndex: stakeAssetId,
                suggestedParams,
            }),
        );
    }

    txns.push(
        buildClaimTxn({
            sender: params.sender,
            appId: params.appId,
            template,
            suggestedParams,
        }),
    );

    if (params.stakedAmount > 0n) {
        txns.push(
            buildUnstakeTxn({
                sender: params.sender,
                appId: params.appId,
                amount: params.stakedAmount,
                template,
                suggestedParams,
            }),
        );
    }

    if (txns.length > 1) algosdk.assignGroupID(txns);

    return { txns, rewardAssetId, stakeAssetId };
}

export async function buildCloseOutTxn(params: {
    sender: string;
    appId: number;
}): Promise<algosdk.Transaction> {
    const suggestedParams = await algod.getTransactionParams().do();
    return algosdk.makeApplicationCloseOutTxnFromObject({
        sender: params.sender,
        appIndex: params.appId,
        suggestedParams,
    });
}
