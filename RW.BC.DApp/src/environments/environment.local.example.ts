export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5180',
  firebase: {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    appId: 'YOUR_FIREBASE_APP_ID',
  },
  rpcUrl: 'http://localhost:8545',
  rpcUrls: ['http://localhost:8545'],
  reown: {
    projectId: 'YOUR_REOWN_PROJECT_ID',
    analytics: false,
    metadata: {
      name: 'BitChicken (local)',
      description: 'BitChicken NFT Ecosystem - local testnet',
      url: 'http://localhost:4200',
      icons: ['https://example.com/assets/bitchicken-logo-cicle.png'],
    },
  },
  contracts: {
    token: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    nft: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    staking: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
    marketplace: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
    forge: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
  },
  admin: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
  explorer: {
    baseUrl: 'http://localhost:5100',
  },
  coingecko: {
    baseUrl: 'https://api.coingecko.com/api/v3',
    demoApiKey: '',
  },
  appKit: {
    local: true,
  },
  analytics: {
    measurementId: '',
    enabled: false,
  },
};
