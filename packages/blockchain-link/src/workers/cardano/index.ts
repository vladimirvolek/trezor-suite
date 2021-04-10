import { CustomError } from '../../constants/errors';
import { MESSAGES, RESPONSES } from '../../constants';
import * as MessageTypes from '../../types/messages';
import Connection from './websocket';
import { Response, Message } from '../../types';
import WorkerCommon from '../common';

declare function postMessage(data: Response): void;

const common = new WorkerCommon(postMessage);

let api: Connection | undefined;
let endpoints: string[] = [];

const cleanup = () => {
    if (api) {
        api.dispose();
        api.removeAllListeners();
        api = undefined;
    }
    endpoints = [];
    common.removeAccounts(common.getAccounts());
    common.removeAddresses(common.getAddresses());
    common.clearSubscriptions();
};

const connect = async (): Promise<Connection> => {
    if (api && api.isConnected()) return api;

    const { server, timeout, pingTimeout, keepAlive } = common.getSettings();
    if (!server || !Array.isArray(server) || server.length < 1) {
        throw new CustomError('connect', 'Endpoint not set');
    }

    if (endpoints.length < 1) {
        endpoints = common.shuffleEndpoints(server.slice(0));
    }

    common.debug('Connecting to cardano', endpoints[0]);
    const connection = new Connection({
        url: endpoints[0],
        timeout,
        pingTimeout,
        keepAlive,
    });

    try {
        await connection.connect();
        api = connection;
    } catch (error) {
        common.debug('Websocket connection failed');
        api = undefined;
        // connection error. remove endpoint
        endpoints.splice(0, 1);
        // and try another one or throw error
        if (endpoints.length < 1) {
            throw new CustomError('connect', 'All backends are down');
        }
        return connect();
    }

    connection.on('disconnected', () => {
        common.response({ id: -1, type: RESPONSES.DISCONNECTED, payload: true });
        cleanup();
    });

    common.response({
        id: -1,
        type: RESPONSES.CONNECTED,
    });

    common.debug('Connected');
    return connection;
};

const getInfo = async (data: { id: number } & MessageTypes.GetInfo): Promise<void> => {
    try {
        const socket = await connect();
        const info = await socket.getServerInfo();
        common.response({
            id: data.id,
            type: RESPONSES.GET_INFO,
            payload: info,
        });
    } catch (error) {
        common.errorHandler({ id: data.id, error });
    }
};

// const getTransaction = async (
//     data: { id: number } & MessageTypes.GetTransaction
// ): Promise<void> => {
//     const { payload } = data;
//     try {
//         const socket = await connect();
//         const tx = await socket.getTransaction(payload);
//         common.response({
//             id: data.id,
//             type: RESPONSES.GET_TRANSACTION,
//             payload: {
//                 type: 'blockbook',
//                 tx,
//             },
//         });
//     } catch (error) {
//         common.errorHandler({ id: data.id, error });
//     }
// };

const getAccountInfo = async (
    data: { id: number } & MessageTypes.GetAccountInfo
): Promise<void> => {
    const { payload } = data;
    try {
        const socket = await connect();
        const info = await socket.getAccountInfo(payload);
        common.response({
            id: data.id,
            type: RESPONSES.GET_ACCOUNT_INFO,
            payload: info,
        });
    } catch (error) {
        common.errorHandler({ id: data.id, error });
    }
};

// const getAccountUtxo = async (
//     data: { id: number } & MessageTypes.GetAccountUtxo
// ): Promise<void> => {
//     const { payload } = data;
//     try {
//         const socket = await connect();
//         const utxos = await socket.getAccountUtxo(payload);
//         common.response({
//             id: data.id,
//             type: RESPONSES.GET_ACCOUNT_UTXO,
//             payload: utils.transformAccountUtxo(utxos),
//         });
//     } catch (error) {
//         common.errorHandler({ id: data.id, error });
//     }
// };

onmessage = (event: { data: Message }) => {
    if (!event.data) return;
    const { data } = event;
    const { id, type } = data;

    common.debug('onmessage', data);
    switch (data.type) {
        case MESSAGES.HANDSHAKE:
            common.setSettings(data.settings);
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
        case MESSAGES.GET_ACCOUNT_INFO:
            getAccountInfo(data);
            break;
        // @ts-ignore this message is used in tests
        case 'terminate':
            cleanup();
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
