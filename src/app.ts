import algosdk from "algosdk";
import { WalletId } from "@txnlab/use-wallet";

import { algod, fetchAccount } from "./algorand.ts";
import { ALL_FARMS } from "./farms.ts";
import { findCometaPositions, type Position } from "./positions.ts";
import { buildCloseOutTxn, buildWithdrawAndClaim, getCallTemplate, simulateGroup } from "./cometa.ts";
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

async function onWalletClick(walletId: string): Promise<void> {
    const id = walletId as WalletId;
    if (!Object.values(WalletId).includes(id)) return;
    setWalletButtonsEnabled(false);
    try {
        const account = await wallet.connect(id);
        if (!account) {
            toast({ title: "Cancelled", msg: "No account selected.", state: "info" });
            return;
        }
        await onConnected(account.address, WALLET_NAME_MAP[id] ?? id);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: "Connection failed", msg, state: "error" });
    } finally {
        setWalletButtonsEnabled(true);
    }
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
        title: `Withdraw · App ${appId}`,
        msg: "Checking the transaction against the network before signing…",
        state: "pending",
    });

    try {
        const account = await fetchAccount(currentAccount.address);
        const optedInAssets = new Set(account.assets.map((a) => a.assetId));

        const { txns } = await buildWithdrawAndClaim({
            sender: currentAccount.address,
            appId,
            stakedAmount: pos.staked,
            optedInAssets,
        });

        const sim = await simulateGroup(txns);
        if (!sim.ok) {
            pending.dismiss();
            toast({
                title: "Network rejected the call",
                msg: sim.error ?? "Simulation failed. Nothing was signed.",
                state: "error",
            });
            return;
        }

        pending.dismiss();
        const signing = toast({
            title: `Withdraw · App ${appId}`,
            msg: "Approve in your wallet to send the group transaction.",
            state: "pending",
        });

        const signed = await wallet.signTransactions(txns);
        signing.dismiss();
        if (signed.length === 0) throw new Error("Wallet did not return signed transactions.");

        const { txid } = await algod.sendRawTransaction(signed).do();
        toast({
            title: "Sent",
            msg: `Waiting for confirmation on ${txns.length === 1 ? "transaction" : `${txns.length} transactions`}…`,
            state: "pending",
            txId: txid,
            timeoutMs: 4000,
        });

        await algosdk.waitForConfirmation(algod, txid, 8);

        toast({
            title: "Done",
            msg: `Your stake and rewards are back in your wallet.`,
            state: "success",
            txId: txid,
        });

        await scan();
    } catch (err) {
        pending.dismiss();
        const msg = decodeError(err);
        toast({ title: "Withdraw failed", msg, state: "error" });
    }
}

async function onClaim(appId: number): Promise<void> {
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
        title: `Claim · App ${appId}`,
        msg: "Checking the transaction against the network before signing…",
        state: "pending",
    });

    try {
        const account = await fetchAccount(currentAccount.address);
        const optedInAssets = new Set(account.assets.map((a) => a.assetId));

        const { txns } = await buildWithdrawAndClaim({
            sender: currentAccount.address,
            appId,
            stakedAmount: 0n,
            optedInAssets,
        });

        const sim = await simulateGroup(txns);
        if (!sim.ok) {
            pending.dismiss();
            toast({
                title: "Network rejected the call",
                msg: sim.error ?? "Simulation failed. Nothing was signed.",
                state: "error",
            });
            return;
        }

        pending.dismiss();
        const signing = toast({
            title: `Claim · App ${appId}`,
            msg: "Approve in your wallet.",
            state: "pending",
        });

        const signed = await wallet.signTransactions(txns);
        signing.dismiss();
        const { txid } = await algod.sendRawTransaction(signed).do();
        toast({
            title: "Sent",
            msg: `Waiting for confirmation…`,
            state: "pending",
            txId: txid,
            timeoutMs: 4000,
        });

        await algosdk.waitForConfirmation(algod, txid, 8);

        toast({
            title: "Claimed",
            msg: `Rewards are back in your wallet.`,
            state: "success",
            txId: txid,
        });
        await scan();
    } catch (err) {
        pending.dismiss();
        toast({ title: "Claim failed", msg: decodeError(err), state: "error" });
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
}

async function prewarmCommonTemplates(): Promise<void> {
    void getCallTemplate(1513593394).catch(() => undefined);
}

void main();

export { buildCloseOutTxn };
