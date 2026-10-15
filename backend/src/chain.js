import fs from 'node:fs';
import { Contract, ContractFactory, JsonRpcProvider, NonceManager, Wallet } from 'ethers';
import { config } from './config.js';
import artifact from './contract.json' with { type: 'json' };

const LOCAL_CHAIN_ID = 31337n;
// Hardhat's first default account. Its key is public, so it is only ever used on a local chain.
const LOCAL_DEV_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

let ready = null;

function readState() {
  try {
    return JSON.parse(fs.readFileSync(config.chainStateFile, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.writeFileSync(config.chainStateFile, JSON.stringify(state, null, 2) + '\n');
}

export async function deployRegistry(signer) {
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  return contract.getAddress();
}

async function connect() {
  const provider = new JsonRpcProvider(config.chain.rpcUrl, undefined, { staticNetwork: false });
  const network = await provider.getNetwork();
  const local = network.chainId === LOCAL_CHAIN_ID;

  const key = config.chain.privateKey || (local ? LOCAL_DEV_KEY : '');
  if (!key) throw new Error('PRIVATE_KEY is required for a non-local chain.');
  const signer = new NonceManager(new Wallet(key, provider));

  let address = config.chain.contractAddress;
  if (!address) {
    // Local development: deploy once and remember the address. A restarted
    // local chain starts empty, so redeploy when the old address has no code.
    const state = readState();
    const saved = state[String(network.chainId)];
    if (saved && (await provider.getCode(saved)) !== '0x') {
      address = saved;
    } else if (local) {
      address = await deployRegistry(signer);
      writeState({ ...state, [String(network.chainId)]: address });
      console.log(`Deployed CertificateRegistry to ${address} on local chain`);
    } else {
      throw new Error('CONTRACT_ADDRESS is required. Deploy with `npm run deploy` first.');
    }
  } else if ((await provider.getCode(address)) === '0x') {
    throw new Error(`No contract found at CONTRACT_ADDRESS ${address}.`);
  }

  return {
    provider,
    chainId: Number(network.chainId),
    name: config.chain.name || (local ? 'Local Hardhat chain' : network.name),
    address,
    contract: new Contract(address, artifact.abi, signer),
  };
}

export async function getChain() {
  if (!ready) {
    ready = connect().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export function explorerTxUrl(txHash) {
  return config.chain.explorerUrl && txHash ? `${config.chain.explorerUrl}/tx/${txHash}` : null;
}

export async function issueOnChain(id, fingerprint) {
  const chain = await getChain();
  const tx = await chain.contract.issue(id, fingerprint);
  const receipt = await tx.wait(1);
  return { chainId: chain.chainId, contract: chain.address, txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

export async function revokeOnChain(id) {
  const chain = await getChain();
  const tx = await chain.contract.revoke(id);
  const receipt = await tx.wait(1);
  return { txHash: receipt.hash };
}

export async function readOnChain(id) {
  const chain = await getChain();
  const [fingerprint, issuedAt, revokedAt] = await chain.contract.get(id);
  return {
    chainId: chain.chainId,
    chainName: chain.name,
    contract: chain.address,
    fingerprint,
    issuedAt: issuedAt ? new Date(Number(issuedAt) * 1000).toISOString() : null,
    revokedAt: revokedAt ? new Date(Number(revokedAt) * 1000).toISOString() : null,
  };
}
