export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000',
  firebase: {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    appId: 'YOUR_FIREBASE_APP_ID',
  },
  rpcUrl: 'https://bsc-testnet-rpc.publicnode.com',
  rpcUrls: [
    'https://bsc-testnet-rpc.publicnode.com',
    'https://data-seed-prebsc-1-s1.binance.org:8545',
  ],
  reown: {
    projectId: 'YOUR_REOWN_PROJECT_ID',
    analytics: true,
    metadata: {
      name: 'BitChicken',
      description: 'BitChicken NFT Ecosystem',
      url: 'https://example.com',
      icons: ['https://example.com/assets/bitchicken-logo-cicle.png'],
    },
  },
  contracts: {
    token: '0x0000000000000000000000000000000000000000',
    nft: '0x0000000000000000000000000000000000000000',
    staking: '0x0000000000000000000000000000000000000000',
    marketplace: '0x0000000000000000000000000000000000000000',
    forge: '0x0000000000000000000000000000000000000000',
  },
  admin: '0x9999999999999999999999999999999999999999',
  ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
  explorer: {
    baseUrl: 'https://testnet.bscscan.com',
  },
  coingecko: {
    baseUrl: 'https://api.coingecko.com/api/v3',
    demoApiKey: '',
  },
  appKit: {
    local: false,
  },
  analytics: {
    measurementId: '',
    enabled: false,
  },
};
