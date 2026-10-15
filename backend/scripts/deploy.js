// Deploys CertificateRegistry to the chain in RPC_URL using PRIVATE_KEY and
// prints the address to put in CONTRACT_ADDRESS.
import { JsonRpcProvider, Wallet } from 'ethers';
import { config } from '../src/config.js';
import { deployRegistry } from '../src/chain.js';

if (!config.chain.privateKey) {
  console.error('Set PRIVATE_KEY (and RPC_URL) in .env first.');
  process.exit(1);
}
const provider = new JsonRpcProvider(config.chain.rpcUrl);
const network = await provider.getNetwork();
const signer = new Wallet(config.chain.privateKey, provider);
console.log(`Deploying from ${signer.address} to chain ${network.chainId}...`);
const address = await deployRegistry(signer);
console.log(`CertificateRegistry deployed at ${address}`);
console.log(`Add to .env:  CONTRACT_ADDRESS=${address}`);
