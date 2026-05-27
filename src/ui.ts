import type { Position } from "./positions.ts";
import { formatAmount } from "./algorand.ts";

const positionTemplate = document.getElementById("positionTemplate") as HTMLTemplateElement;
const toastTemplate = document.getElementById("toastTemplate") as HTMLTemplateElement;

function $(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`missing element #${id}`);
    return el;
}

export function setStatus(network: string, farmCount: number, round: number | null): void {
    $("statusNetwork").textContent = network;
    $("statusFarmCount").textContent = farmCount.toString();
    if (round !== null) $("statusRound").textContent = round.toString();
}

export function showSection(id: "sectionConnect" | "sectionAccount" | "sectionPositions", visible: boolean): void {
    const el = document.getElementById(id);
    if (el) el.hidden = !visible;
}

export function setStageChip(stage: "connect" | "connected", text: string): void {
    const chip = document.querySelector(`[data-stage="${stage}"]`);
    if (chip) chip.textContent = text;
}

export function renderAccount(address: string, walletName: string, algoBalance: bigint): void {
    $("addressDisplay").textContent = `${address.slice(0, 8)}…${address.slice(-8)}`;
    $("addressDisplay").setAttribute("title", address);
    $("addressDisplay").dataset.full = address;
    $("walletDisplay").textContent = walletName;
    $("balanceDisplay").textContent = `${formatAmount(algoBalance, 6)} ALGO`;
}

export function clearAccount(): void {
    $("addressDisplay").textContent = "";
    $("walletDisplay").textContent = "";
    $("balanceDisplay").textContent = "0 ALGO";
}

export interface PositionAction {
    appId: number;
    action: "withdraw" | "claim";
}

export function setPositionsLoading(loading: boolean): void {
    $("positionsLoading").hidden = !loading;
    if (loading) {
        $("positionsEmpty").hidden = true;
        $("positionsList").innerHTML = "";
    }
}

export function renderPositions(
    positions: ReadonlyArray<Position>,
    onAction: (action: PositionAction) => void,
): void {
    const list = $("positionsList") as HTMLUListElement;
    list.innerHTML = "";

    const countChip = $("positionsCountChip");
    const active = positions.filter((p) => p.staked > 0n).length;
    if (positions.length === 0) {
        countChip.textContent = "";
    } else if (active === 0) {
        countChip.textContent = `${positions.length} idle · rewards only`;
    } else if (active === positions.length) {
        countChip.textContent = `${active} active`;
    } else {
        countChip.textContent = `${active} active · ${positions.length - active} idle`;
    }

    if (positions.length === 0) {
        $("positionsEmpty").hidden = false;
        return;
    }
    $("positionsEmpty").hidden = true;

    positions.forEach((pos, idx) => {
        const node = positionTemplate.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
        node.dataset.appId = String(pos.farm.id);

        setField(node, "index", String(idx + 1).padStart(2, "0"));
        const typeEl = node.querySelector('[data-field="type"]') as HTMLElement;
        typeEl.textContent = pos.farm.type.toUpperCase();
        if (pos.farm.type === "distribution") typeEl.classList.add("tag--distribution");
        setField(node, "appId", String(pos.farm.id));
        setField(node, "desc", pos.farm.desc ?? `Cometa contract ${pos.farm.id}`);
        setField(node, "version", `v${pos.farm.version}`);

        const stakeDecimals = guessStakeDecimals(pos.farm);
        setField(
            node,
            "staked",
            pos.staked > 0n ? formatAmount(pos.staked, stakeDecimals) : "0",
        );

        const rewardText = pos.farm.rewardName
            ? `earns ${pos.farm.rewardName}`
            : pos.farm.reward
              ? `earns asset ${pos.farm.reward}`
              : "rewards on withdraw";
        setField(node, "reward", rewardText);

        const latestRound = window.__latestRound__;
        const ended = pos.farm.endBlock !== null && latestRound !== undefined && pos.farm.endBlock < latestRound;
        setField(node, "status", pos.staked > 0n ? (ended ? "Ended · stake remains" : "Active") : "Rewards only");

        if (pos.farm.lockBlocks > 0) {
            const lock = node.querySelector('[data-field="lock"]') as HTMLElement;
            const days = Math.round((pos.farm.lockBlocks * 2.9) / 86400);
            lock.textContent = days > 0 ? `${days}-day lock` : "Locked";
        }

        const explorer = node.querySelector('[data-field="explorer"]') as HTMLAnchorElement;
        explorer.href = `https://allo.info/application/${pos.farm.id}`;

        const withdrawBtn = node.querySelector('[data-action="withdraw"]') as HTMLButtonElement;
        const claimBtn = node.querySelector('[data-action="claim"]') as HTMLButtonElement;

        if (pos.staked === 0n) {
            withdrawBtn.hidden = true;
        } else {
            withdrawBtn.addEventListener("click", () => onAction({ appId: pos.farm.id, action: "withdraw" }));
        }
        claimBtn.addEventListener("click", () => onAction({ appId: pos.farm.id, action: "claim" }));

        list.append(node);
    });
}

function setField(node: ParentNode, name: string, value: string): void {
    const el = node.querySelector(`[data-field="${name}"]`);
    if (el) el.textContent = value;
}

function guessStakeDecimals(farm: { stake: number | null; reward: number | null; rewardDecimals: number | null }): number {
    if (farm.stake !== null && farm.stake === farm.reward && farm.rewardDecimals !== null) return farm.rewardDecimals;
    return 6;
}

declare global {
    interface Window {
        __latestRound__?: number;
    }
}

export interface ToastOptions {
    title: string;
    msg: string;
    state: "info" | "pending" | "success" | "error";
    txId?: string;
    timeoutMs?: number;
}

export function toast(opts: ToastOptions): { dismiss: () => void } {
    const node = toastTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
    node.dataset.state = opts.state;
    setField(node, "title", opts.title);
    setField(node, "msg", opts.msg);

    const link = node.querySelector('[data-field="link"]') as HTMLAnchorElement;
    if (opts.txId) {
        link.href = `https://allo.info/tx/${opts.txId}`;
        link.hidden = false;
    }

    const close = node.querySelector(".toast__close") as HTMLButtonElement;
    const dismiss = () => node.remove();
    close.addEventListener("click", dismiss);

    $("toastStack").append(node);

    const ttl = opts.timeoutMs ?? (opts.state === "error" ? 12000 : opts.state === "pending" ? 0 : 7000);
    if (ttl > 0) {
        setTimeout(dismiss, ttl);
    }
    return { dismiss };
}

export function setWalletButtonsEnabled(enabled: boolean): void {
    document.querySelectorAll<HTMLButtonElement>(".wallet").forEach((b) => {
        b.disabled = !enabled;
    });
}

export function bindWalletButtons(handler: (id: string) => void): void {
    document.querySelectorAll<HTMLButtonElement>(".wallet").forEach((b) => {
        const wallet = b.dataset.wallet;
        if (!wallet) return;
        b.addEventListener("click", () => handler(wallet));
    });
}

export function bindScanButton(handler: () => void): void {
    $("scanBtn").addEventListener("click", handler);
}

export function bindDisconnect(handler: () => void): void {
    $("disconnectBtn").addEventListener("click", handler);
}

export function bindCopyAddress(): void {
    $("copyAddressBtn").addEventListener("click", async () => {
        const addr = $("addressDisplay").dataset.full;
        if (!addr) return;
        try {
            await navigator.clipboard.writeText(addr);
            toast({ title: "Copied", msg: "Address copied to clipboard.", state: "success", timeoutMs: 2500 });
        } catch {
            toast({ title: "Copy failed", msg: "Clipboard access denied.", state: "error" });
        }
    });
}
