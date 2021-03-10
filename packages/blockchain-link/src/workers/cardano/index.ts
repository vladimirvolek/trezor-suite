import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { Utxo } from '../../types/responses';
import { CustomError } from '../../constants/errors';
import { MESSAGES, RESPONSES } from '../../constants';
import * as MessageTypes from '../../types/messages';
import { Response, Message } from '../../types';
import WorkerCommon from '../common';

declare function postMessage(data: Response): void;

const common = new WorkerCommon(postMessage);

let blockFrostApi: BlockFrostAPI | undefined;

const connect = async (): Promise<void> => {};

const getApi = (): BlockFrostAPI => {
    if (blockFrostApi) {
        return blockFrostApi;
    }

    blockFrostApi = new BlockFrostAPI({ projectId: 'G8CaeClBRTr5CiUxCLzgGeqGoVbwuaZs' });
    return blockFrostApi;
};

const getInfo = async (data: { id: number } & MessageTypes.GetInfo): Promise<void> => {
    try {
        const blockFrostApi = getApi();
        const info = await blockFrostApi.root();
        const latestBlock = await blockFrostApi.blocksLatest();

        common.response({
            id: data.id,
            type: RESPONSES.GET_INFO,
            payload: {
                url: blockFrostApi.apiUrl,
                name: 'Cardano',
                shortcut: 'ada',
                testnet: false,
                version: info.version.toString(),
                decimals: 6,
                blockHeight: latestBlock.height || 0,
                blockHash: latestBlock.hash,
            },
        });
    } catch (error) {
        common.debug('error', error);
        common.errorHandler({ id: data.id, error });
    }
};

const getTransaction = async (data: { id: any } & MessageTypes.GetTransaction): Promise<void> => {
    const { payload } = data;

    try {
        const blockFrostApi = getApi();
        const tx = await blockFrostApi.txs(payload);
        common.response({
            id: data.id,
            type: RESPONSES.GET_TRANSACTION,
            payload: {
                type: 'cardano',
                tx,
            },
        });
    } catch (error) {
        common.errorHandler({ id: data.id, error });
    }
};

const getAccountUtxo = async (
    data: { id: number } & MessageTypes.GetAccountUtxo
): Promise<void> => {
    const { payload } = data;
    try {
        const blockFrostApi = getApi();
        const result: Utxo[] = [];
        const responseUtxo = await blockFrostApi.addressesUtxos(payload);

        responseUtxo.forEach(async utxo => {
            const lovelaceAmount = utxo.amount?.find(u => u.unit === 'lovelace');

            if (utxo.block) {
                const responseBlock = await blockFrostApi.blocks(utxo.block);
                result.push({
                    txid: utxo.tx_hash || '0',
                    confirmations: responseBlock.confirmations,
                    blockHeight: responseBlock.height || 0,
                    address: '',
                    path: '',
                    amount: lovelaceAmount?.quantity || '0',
                    vout: 0,
                    coinbase: false,
                });
            }
        });

        common.response({
            id: data.id,
            type: RESPONSES.GET_ACCOUNT_UTXO,
            payload: result,
        });
    } catch (error) {
        common.errorHandler({ id: data.id, error });
    }
};

onmessage = (event: { data: Message }) => {
    if (!event.data) return;
    const { data } = event;
    const { id, type } = data;

    common.debug('onmessage', data);

    switch (data.type) {
        case MESSAGES.HANDSHAKE:
            common.setSettings(data.settings);
            break;
        case MESSAGES.GET_ACCOUNT_UTXO:
            getAccountUtxo(data);
            break;
        case MESSAGES.GET_TRANSACTION:
            getTransaction(data);
            break;
        case MESSAGES.CONNECT:
            connect()
                .then(() => {
                    common.response({ id, type: RESPONSES.CONNECT, payload: true });
                })
                .catch(error => common.errorHandler({ id, error }));
            break;
        case MESSAGES.GET_INFO:
            getInfo(data);
            break;
        default:
            common.errorHandler({
                id,
                error: new CustomError('worker_unknown_request', `+${type}`),
            });
            break;
    }
};

// Handshake to host
common.handshake();
