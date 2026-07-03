import "@nomicfoundation/hardhat-toolbox";

const config = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    waychain: {
      url: process.env.WAYCHAIN_RPC || "http://127.0.0.1:8545",
      chainId: parseInt(process.env.WAYCHAIN_CHAIN_ID || "369"),
      accounts: process.env.WAYCHAIN_PRIVATE_KEY ? [process.env.WAYCHAIN_PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;