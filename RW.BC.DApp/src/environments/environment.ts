export const environment = {
  production: true,
  apiBaseUrl: 'https://api.example.com',
  firebase: {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    appId: 'YOUR_FIREBASE_APP_ID',
  },
  rpcUrl: 'https://bsc-dataseed.binance.org',
  rpcUrls: [
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.defibit.io',
    'https://bsc-dataseed1.ninicoin.io',
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
    baseUrl: 'https://bscscan.com',
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
