import algosdk from "algosdk";
import { WalletId } from "@txnlab/use-wallet";

import { algod, fetchAccount } from "./algorand.ts";
import { ALL_FARMS } from "./farms.ts";
import { findCometaPositions, type Position } from "./positions.ts";
import {
    buildCloseOutTxn,
    buildWithdrawAndClaim,
    getCallTemplate,
    simulateGroups,
    type SimulateResult,
    type TxnGroup,
} from "./cometa.ts";
import type { Farm } from "./farms.ts";
import { WalletSession } from "./wallet.ts";
import {
    bindCopyAddress,
    bindDisconnect,
    bindScanButton,
    bindWalletButtons,
    clearAccount,
    renderAccount,
    renderPositions,
    setPositionsLoading,
    setStageChip,
    setStatus,
    setWalletButtonsEnabled,
    showSection,
    toast,
} from "./ui.ts";

const wallet = new WalletSession();

interface Operator {
    address: string;
    walletName: string;
    readOnly: boolean;
}

let currentAccount: Operator | null = null;
let positionsByApp = new Map<number, Position>();

const WALLET_NAME_MAP: Record<string, string> = {
    [WalletId.PERA]: "Pera",
    [WalletId.DEFLY]: "Defly",
    [WalletId.LUTE]: "Lute",
    [WalletId.EXODUS]: "Exodus",
    [WalletId.KIBISIS]: "Kibisis",
};

async function refreshNetworkStatus(): Promise<void> {
    setStatus("MAINNET", ALL_FARMS.length, null);
    try {
        const params = await algod.getTransactionParams().do();
        const round = Number(params.firstValid);
        window.__latestRound__ = round;
        setStatus("MAINNET", ALL_FARMS.length, round);
    } catch (err) {
        console.warn("Failed to fetch suggested params", err);
    }
}

const KIBISIS_DETECT_TIMEOUT_MS = 5000;

async function onWalletClick(walletId: string): Promise<void> {
    const id = walletId as WalletId;
    if (!Object.values(WalletId).includes(id)) return;
    setWalletButtonsEnabled(false);
    try {
        const account = await connectWithFriendlyErrors(id);
        if (!account) {
            toast({ title: "Cancelled", msg: "No account selected.", state: "info" });
            return;
        }
        await onConnected(account.address, WALLET_NAME_MAP[id] ?? id);
    } catch (err) {
        toast({ title: "Connection failed", msg: walletConnectErrorMsg(err, id), state: "error" });
    } finally {
        setWalletButtonsEnabled(true);
    }
}

async function connectWithFriendlyErrors(id: WalletId) {
    if (id === WalletId.KIBISIS) {
        // Kibisis's ARC-0027 enable call hangs for the SDK's DEFAULT_REQUEST_TIMEOUT
        // (3 minutes) when no extension is installed to answer. Race against a short
        // detection timeout so the user sees an actionable message instead of a
        // silently spinning button. The lost connect promise stays pending in the
        // background until the SDK times out — harmless, no user-visible effect.
        const TIMEOUT = Symbol("kibisis-timeout");
        const result = await Promise.race([
            wallet.connect(id),
            new Promise<typeof TIMEOUT>((resolve) =>
                setTimeout(() => resolve(TIMEOUT), KIBISIS_DETECT_TIMEOUT_MS),
            ),
        ]);
        if (result === TIMEOUT) {
            throw new Error("kibisis-not-detected");
        }
        return result;
    }
    return wallet.connect(id);
}

function walletConnectErrorMsg(err: unknown, id: WalletId): string {
    const raw = err instanceof Error ? err.message : String(err);
    if (id === WalletId.KIBISIS && raw === "kibisis-not-detected") {
        return "Kibisis extension not detected. Install it from kibisis.io and reload the page.";
    }
    if (id === WalletId.EXODUS && /Exodus is not available/i.test(raw)) {
        return "Exodus extension not detected. Install the Exodus browser extension and reload the page.";
    }
    if (id === WalletId.LUTE && /pop[- ]?up|popup blocked|window\.open/i.test(raw)) {
        return "Browser blocked Lute's popup. Allow popups for this site and try again.";
    }
    return raw;
}

async function onConnected(address: string, walletName: string, readOnly = false): Promise<void> {
    currentAccount = { address, walletName, readOnly };
    setStageChip("connect", readOnly ? "Read-only" : "Connected");
    showSection("sectionAccount", true);
    showSection("sectionPositions", true);
    renderAccount(address, walletName, 0n);
    await scan();
}

async function onDisconnect(): Promise<void> {
    try {
        await wallet.disconnect();
    } catch (err) {
        console.warn("disconnect error", err);
    }
    currentAccount = null;
    positionsByApp.clear();
    clearAccount();
    setStageChip("connect", "Awaiting wallet");
    showSection("sectionAccount", false);
    showSection("sectionPositions", false);
}

async function scan(): Promise<void> {
    if (!currentAccount) return;
    setPositionsLoading(true);
    try {
        const account = await fetchAccount(currentAccount.address);
        renderAccount(currentAccount.address, currentAccount.walletName, account.amount);

        const positions = findCometaPositions(account);
        positionsByApp.clear();
        for (const p of positions) positionsByApp.set(p.farm.id, p);

        setPositionsLoading(false);

        renderPositions(positions, (action) => {
            if (action.action === "withdraw") void onWithdraw(action.appId);
            else void onClaim(action.appId);
        });

        if (positions.length === 0) {
            toast({
                title: "Scan complete",
                msg: "No Cometa positions found on this address.",
                state: "info",
            });
        } else {
            const total = positions.filter((p) => p.staked > 0n).length;
            toast({
                title: "Scan complete",
                msg: `${positions.length} contract${positions.length === 1 ? "" : "s"} detected · ${total} with active stake.`,
                state: "success",
            });
        }

        try {
            const params = await algod.getTransactionParams().do();
            window.__latestRound__ = Number(params.firstValid);
        } catch {}
    } catch (err) {
        setPositionsLoading(false);
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: "Scan failed", msg, state: "error" });
    }
}

async function onWithdraw(appId: number): Promise<void> {
    await runWithdrawFlow(appId, {
        opLabel: "Withdraw",
        includeUnstake: true,
        signMsg: "Approve in your wallet — one signature covers every step.",
        successTitle: "Done",
        successMsg: "Your stake and rewards are back in your wallet.",
        failureTitle: "Withdraw failed",
    });
}

async function onClaim(appId: number): Promise<void> {
    await runWithdrawFlow(appId, {
        opLabel: "Claim",
        includeUnstake: false,
        signMsg: "Approve in your wallet.",
        successTitle: "Claimed",
        successMsg: "Rewards are back in your wallet.",
        failureTitle: "Claim failed",
    });
}

interface WithdrawFlowOptions {
    opLabel: string;
    includeUnstake: boolean;
    signMsg: string;
    successTitle: string;
    successMsg: string;
    failureTitle: string;
}

async function runWithdrawFlow(appId: number, opts: WithdrawFlowOptions): Promise<void> {
    if (!currentAccount) return;
    if (currentAccount.readOnly) {
        toast({
            title: "Read-only mode",
            msg: "Connect a wallet to sign and submit transactions.",
            state: "info",
        });
        return;
    }
    const pos = positionsByApp.get(appId);
    if (!pos) return;

    const pending = toast({
        title: `${opts.opLabel} · App ${appId}`,
        msg: "Checking the transaction against the network before signing…",
        state: "pending",
    });

    try {
        const account = await fetchAccount(currentAccount.address);
        const optedInAssets = new Set(account.assets.map((a) => a.assetId));

        const { groups, allTxns } = await buildWithdrawAndClaim({
            sender: currentAccount.address,
            appId,
            stakedAmount: opts.includeUnstake ? pos.staked : 0n,
            optedInAssets,
        });

        const needsOptIn = groups.some((g) => g.steps.some((s) => s.startsWith("opt-in-")));
        const sim = needsOptIn
            ? { ok: true as const, error: null, failedGroupIndex: null, failedStep: null, rawFailure: null }
            : await simulateGroups(groups);
        if (!sim.ok) {
            pending.dismiss();
            toast({
                title: "Network rejected the call",
                msg: explainSimulateError(sim, pos.farm),
                state: "error",
            });
            return;
        }

        pending.dismiss();
        const signing = toast({
            title: `${opts.opLabel} · App ${appId}`,
            msg: opts.signMsg,
            state: "pending",
        });

        const signed = await wallet.signTransactions(allTxns);
        signing.dismiss();
        if (signed.length !== allTxns.length) {
            throw new Error("Wallet did not return signed transactions for every step.");
        }

        const lastTxid = await submitGroupsSequentially(groups, signed, opts.opLabel, appId);

        toast({
            title: opts.successTitle,
            msg: opts.successMsg,
            state: "success",
            txId: lastTxid,
        });

        await scan();
    } catch (err) {
        pending.dismiss();
        toast({ title: opts.failureTitle, msg: decodeError(err), state: "error" });
    }
}

async function submitGroupsSequentially(
    groups: ReadonlyArray<TxnGroup>,
    signedAll: ReadonlyArray<Uint8Array>,
    opLabel: string,
    appId: number,
): Promise<string> {
    let cursor = 0;
    let lastTxid = "";
    for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        const slice = signedAll.slice(cursor, cursor + g.txns.length);
        cursor += g.txns.length;

        const stepLabel = describeGroupSteps(g.steps);
        const pending = toast({
            title: `${opLabel} · App ${appId}`,
            msg: `Submitting ${stepLabel} (step ${i + 1} of ${groups.length})…`,
            state: "pending",
        });

        try {
            const { txid } = await algod.sendRawTransaction(slice).do();
            await algosdk.waitForConfirmation(algod, txid, 8);
            lastTxid = txid;
        } finally {
            pending.dismiss();
        }
    }
    return lastTxid;
}

function describeGroupSteps(steps: ReadonlyArray<string>): string {
    if (steps.length === 1) return steps[0].replace(/-/g, " ");
    return steps.map((s) => s.replace(/-/g, " ")).join(" + ");
}

function explainSimulateError(sim: SimulateResult, farm: Farm): string {
    const base = sim.error ?? "Simulation failed.";
    if (sim.rawFailure) {
        console.warn("simulate failure", {
            group: sim.failedGroupIndex,
            step: sim.failedStep,
            raw: sim.rawFailure,
        });
    }

    switch (sim.failedStep) {
        case "unstake": {
            const hints: string[] = [];
            if (farm.lockBlocks > 0) {
                const days = Math.max(1, Math.round((farm.lockBlocks * 2.9) / 86400));
                hints.push(`The contract enforces a ~${days}-day lock on staked funds; if you staked recently, withdraw will fail until the lock elapses.`);
            }
            hints.push("Also possible: not quite enough ALGO to cover the inner-transaction fee bump (~0.004 ALGO).");
            return `Unstake step failed: ${base}. ${hints.join(" ")}`;
        }
        case "claim":
            return `Claim step failed: ${base}. The reward pool may be empty, or you may have already claimed this round.`;
        case "opt-in-reward":
            return `Couldn't opt in to the reward asset (${base}). Check that your wallet has enough ALGO for the asset min-balance bump (0.1 ALGO).`;
        case "opt-in-stake":
            return `Couldn't opt in to the stake asset (${base}). Check that your wallet has enough ALGO for the asset min-balance bump (0.1 ALGO).`;
        default:
            return base;
    }
}

function decodeError(err: unknown): string {
    if (err instanceof Error) {
        const inner = (err as Error & { response?: { body?: { message?: string } } }).response?.body?.message;
        return inner ?? err.message;
    }
    return String(err);
}

function bindReadOnlyForm(): void {
    const form = document.getElementById("readonlyForm") as HTMLFormElement | null;
    if (!form) return;
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("readonlyAddr") as HTMLInputElement;
        const addr = input.value.trim().toUpperCase();
        if (!isAlgorandAddress(addr)) {
            toast({ title: "Invalid address", msg: "Expected a 58-character Algorand address.", state: "error" });
            return;
        }
        void onConnected(addr, "Read-only", true);
    });
}

function isAlgorandAddress(addr: string): boolean {
    return /^[A-Z2-7]{58}$/.test(addr);
}

async function main(): Promise<void> {
    bindWalletButtons(onWalletClick);
    bindScanButton(() => void scan());
    bindDisconnect(() => void onDisconnect());
    bindCopyAddress();
    bindReadOnlyForm();

    void refreshNetworkStatus();
    setInterval(() => void refreshNetworkStatus(), 8000);

    const params = new URLSearchParams(window.location.search);
    const previewAddr = params.get("addr");
    if (previewAddr && isAlgorandAddress(previewAddr.toUpperCase())) {
        await onConnected(previewAddr.toUpperCase(), "Read-only", true);
        return;
    }

    try {
        await wallet.resume();
        if (wallet.activeAddress) {
            const walletId = wallet.manager.activeWallet?.id ?? "";
            await onConnected(wallet.activeAddress, WALLET_NAME_MAP[walletId] ?? "Wallet");
        }
    } catch (err) {
        console.warn("Resume error", err);
    }

    void prewarmCommonTemplates();
    void prewarmLuteClient();
}

async function prewarmCommonTemplates(): Promise<void> {
    void getCallTemplate(1513593394).catch(() => undefined);
}

async function prewarmLuteClient(): Promise<void> {
    // LuteWallet.connect() dynamically imports lute-connect, which calls
    // window.open() inside its connect Promise. If the dynamic import isn't
    // cached, browsers can break the user-gesture chain between click and
    // window.open and silently block the popup. Caching the module ahead of
    // time keeps the popup synchronous from the wallet's perspective.
    try {
        await import("lute-connect");
    } catch {
        // Lute connect is optional; failing to preload is non-fatal.
    }
}

void main();

export { buildCloseOutTxn };
