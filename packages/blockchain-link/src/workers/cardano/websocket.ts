import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { CustomError } from '../../constants/errors';
import { create as createDeferred, Deferred } from '../../utils/deferred';
import { AccountUtxo, Send } from '../../types/cardano';
import { AccountInfoParams } from '../../types/params';
import { BlockHash } from '../../types/blockbook';

const NOT_INITIALIZED = new CustomError('websocket_not_initialized');

interface Subscription {
    id: string;
    type: 'notification' | 'block' | 'fiatRates';
    callback: (result: any) => void;
}

interface Options {
    url: string;
    timeout?: number;
    pingTimeout?: number;
    keepAlive?: boolean;
}

const DEFAULT_TIMEOUT = 20 * 1000;
const DEFAULT_PING_TIMEOUT = 50 * 1000;

export default class Socket extends EventEmitter {
    options: Options;
    ws: WebSocket | undefined;
    messageID = 0;
    messages: Deferred<any>[] = [];
    subscriptions: Subscription[] = [];
    pingTimeout: ReturnType<typeof setTimeout> | undefined;
    connectionTimeout: ReturnType<typeof setTimeout> | undefined;

    constructor(options: Options) {
        super();
        this.setMaxListeners(Infinity);
        this.options = options;
    }

    setConnectionTimeout() {
        this.clearConnectionTimeout();
        this.connectionTimeout = setTimeout(
            this.onTimeout.bind(this),
            this.options.timeout || DEFAULT_TIMEOUT
        );
    }

    clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = undefined;
        }
    }

    setPingTimeout() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
        }
        this.pingTimeout = setTimeout(
            this.onPing.bind(this),
            this.options.pingTimeout || DEFAULT_PING_TIMEOUT
        );
    }

    onTimeout() {
        const { ws } = this;
        if (!ws) return;
        if (ws.listenerCount('open') > 0) {
            ws.emit('error', 'Websocket timeout');
            try {
                ws.close();
            } catch (error) {
                // empty
            }
        } else {
            this.messages.forEach(m => m.reject(new CustomError('websocket_timeout')));
            ws.close();
        }
    }

    async onPing() {
        // make sure that connection is alive if there are subscriptions
        if (this.ws && this.isConnected()) {
            if (this.subscriptions.length > 0 || this.options.keepAlive) {
                await this.getServerInfo();
            } else {
                try {
                    this.ws.close();
                } catch (error) {
                    // empty
                }
            }
        }
    }

    onError() {
        this.dispose();
    }

    send: Send = (command, params = {}) => {
        const { ws } = this;
        if (!ws) throw NOT_INITIALIZED;
        const id = this.messageID.toString();

        const dfd = createDeferred(id);
        const req = {
            id,
            command,
            params,
        };

        this.messageID++;
        this.messages.push(dfd);

        this.setConnectionTimeout();
        this.setPingTimeout();
        console.log('req', req);
        ws.send(JSON.stringify(req));
        return dfd.promise as Promise<any>;
    };

    onmessage(message: string) {
        try {
            const resp = JSON.parse(message);
            const { id, data } = resp;
            const dfd = this.messages.find(m => m.id === id);
            if (dfd) {
                if (data.error) {
                    dfd.reject(new CustomError('websocket_error_message', data.error.message));
                } else {
                    dfd.resolve(data);
                }
                this.messages.splice(this.messages.indexOf(dfd), 1);
            } else {
                const subs = this.subscriptions.find(s => s && s.id === id);
                if (subs) {
                    subs.callback(data);
                }
            }
        } catch (error) {
            // empty
        }

        if (this.messages.length === 0) {
            this.clearConnectionTimeout();
        }
        this.setPingTimeout();
    }

    connect() {
        const { url } = this.options;
        this.setConnectionTimeout();
        const dfd = createDeferred<void>(-1);
        const ws = new WebSocket(url);
        if (typeof ws.setMaxListeners === 'function') {
            ws.setMaxListeners(Infinity);
        }

        ws.once('error', error => {
            this.dispose();
            dfd.reject(new CustomError('websocket_runtime_error', error.message));
        });

        ws.on('open', () => {
            this.init();
            dfd.resolve();
        });

        this.ws = ws;

        return dfd.promise;
    }

    init() {
        const { ws } = this;
        if (!ws || !this.isConnected()) {
            throw Error('Cardano websocket init cannot be called');
        }

        this.clearConnectionTimeout();
        ws.removeAllListeners();
        ws.on('error', this.onError.bind(this));
        ws.on('message', this.onmessage.bind(this));
        ws.on('close', () => {
            this.emit('disconnected');
            this.dispose();
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }

    isConnected() {
        const { ws } = this;
        return ws && ws.readyState === WebSocket.OPEN;
    }

    getServerInfo() {
        return this.send('GET_SERVER_INFO');
    }

    getAccountInfo(payload: AccountInfoParams) {
        return this.send('GET_ACCOUNT_INFO', payload);
    }

    dispose() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
        }
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
        }

        const { ws } = this;
        if (this.isConnected()) {
            this.disconnect();
        }
        if (ws) {
            ws.removeAllListeners();
        }

        this.removeAllListeners();
    }
}
