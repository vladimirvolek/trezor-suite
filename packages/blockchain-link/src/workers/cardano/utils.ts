export const transformServerInfo = (
    latestBlock: any,
    url: string,
    version: string,
    isTestnet: boolean
) => {
    return {
        url,
        name: 'Cardano',
        shortcut: 'ada',
        testnet: isTestnet,
        version,
        decimals: 6,
        blockHeight: latestBlock.height,
        blockHash: latestBlock.hash,
    };
};
