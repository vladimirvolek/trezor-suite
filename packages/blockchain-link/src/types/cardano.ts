import { AccountInfoParams } from './params';

export interface Subscribe {
    subscribed: boolean;
}

export interface ServerInfo {
    url: string;
    name: string;
    shortcut: string;
    testnet: boolean;
    version: string;
    decimals: number;
    blockHeight: number;
    blockHash: string;
}

export interface BlockHash {
    hash: string;
}

export interface XPUBAddress {
    type: 'XPUBAddress';
    name: string;
    path: string;
    transfers: number;
    balance: string;
    totalSent: string;
    totalReceived: string;
}

export interface ERC20 {
    type: 'ERC20';
    name?: string;
    symbol?: string;
    contract: string;
    balance?: string;
    decimals?: number;
}

export type AccountInfo = any;

export interface AccountUtxoParams {
    descriptor: string;
}

export type AccountUtxo = {
    txid: string;
    vout: number;
    value: string;
    height: number;
    address: string;
    path: string;
    confirmations: number;
    coinbase?: boolean;
}[];

export interface VinVout {
    n: number;
    addresses?: string[];
    isAddress: boolean;
    value?: string;
    coinbase?: string;
    txid?: string;
    vout?: number;
    sequence?: number;
    hex?: string;
}

export interface Transaction {
    txid: string;
    version?: number;
    vin: VinVout[];
    vout: VinVout[];
    blockHeight: number;
    blockHash?: string;
    confirmations: number;
    blockTime: number;
    value: string;
    valueIn: string;
    fees: string;
    hex: string;
    lockTime?: number;
    ethereumSpecific?: {
        status: number;
        nonce: number;
        data?: string;
        gasLimit: number;
        gasUsed?: number;
        gasPrice: string;
    };
    tokenTransfers?: {
        from?: string;
        to?: string;
        value: string;
        token: string;
        name: string;
        symbol: string;
        decimals?: number;
    }[];
}

export interface Push {
    result: string;
}

export type Fee = {
    feePerUnit: string;
    feePerTx?: string;
    feeLimit?: string;
}[];

export interface FiatRates {
    [symbol: string]: number | undefined;
}

export interface BlockNotification {
    height: number;
    hash: string;
}

export interface AddressNotification {
    address: string;
    tx: Transaction;
}

export interface FiatRatesNotification {
    rates: FiatRates;
}

export interface TimestampedFiatRates {
    ts: number;
    rates: FiatRates;
}

export interface FiatRatesForTimestamp {
    tickers: TimestampedFiatRates[];
}

export interface AccountBalanceHistory {
    time: number;
    txs: number;
    received: string;
    sent: string;
    sentToSelf?: string; // should always be there for blockbook >= 0.3.3
    rates: FiatRates;
}

export interface AvailableCurrencies {
    ts: number;
    // eslint-disable-next-line camelcase
    available_currencies: string[];
}

declare function FSend(method: 'GET_SERVER_INFO'): Promise<ServerInfo>;
declare function FSend(method: 'GET_BLOCK_HASH', params: { height: number }): Promise<BlockHash>;
declare function FSend(method: 'GET_ACCOUNT_INFO', params: AccountInfoParams): Promise<AccountInfo>;

export type Send = typeof FSend;
