import algosdk from "algosdk";
import { NetworkId, WalletId, WalletManager, type WalletAccount } from "@txnlab/use-wallet";

export type ConnectableWalletId = WalletId.PERA | WalletId.DEFLY | WalletId.LUTE | WalletId.EXODUS | WalletId.KIBISIS;

export interface ConnectableWallet {
    id: ConnectableWalletId;
    label: string;
    available: boolean;
}

export type WalletEvent =
    | { kind: "connected"; address: string; walletId: WalletId }
    | { kind: "disconnected" };

export type WalletListener = (event: WalletEvent) => void;

export class WalletSession {
    public readonly manager: WalletManager;

    private listeners: Set<WalletListener> = new Set();

    public constructor() {
        this.manager = new WalletManager({
            wallets: [
                WalletId.PERA,
                WalletId.DEFLY,
                WalletId.LUTE,
                WalletId.EXODUS,
                WalletId.KIBISIS,
            ],
            defaultNetwork: NetworkId.MAINNET,
        });

        this.manager.store.subscribe(() => {
            const account = this.manager.activeAccount;
            const wallet = this.manager.activeWallet;
            if (account && wallet) {
                this.emit({ kind: "connected", address: account.address, walletId: wallet.id });
            } else {
                this.emit({ kind: "disconnected" });
            }
        });
    }

    public async resume(): Promise<void> {
        await this.manager.resumeSessions();
    }

    public onChange(listener: WalletListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit(event: WalletEvent): void {
        for (const l of this.listeners) l(event);
    }

    public listWallets(): ConnectableWallet[] {
        return this.manager.wallets.map((w) => ({
            id: w.id as ConnectableWalletId,
            label: w.metadata.name,
            available: true,
        }));
    }

    public async connect(walletId: WalletId): Promise<WalletAccount | null> {
        const wallet = this.manager.wallets.find((w) => w.id === walletId);
        if (!wallet) throw new Error(`Unknown wallet: ${walletId}`);
        const accounts = await wallet.connect();
        wallet.setActive();
        return accounts[0] ?? null;
    }

    public async disconnect(): Promise<void> {
        const wallet = this.manager.activeWallet;
        if (wallet) await wallet.disconnect();
    }

    public get activeAddress(): string | null {
        return this.manager.activeAccount?.address ?? null;
    }

    public async signTransactions(txns: algosdk.Transaction[]): Promise<Uint8Array[]> {
        const wallet = this.manager.activeWallet;
        if (!wallet) throw new Error("No wallet connected");
        const signed = await wallet.signTransactions(txns);
        return signed.filter((b): b is Uint8Array => b !== null);
    }
}
