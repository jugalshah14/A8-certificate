// Compiles contracts/CertificateRegistry.sol and writes the ABI and bytecode to
// src/contract.json, so the server does not need the compiler at runtime.
import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'contracts/CertificateRegistry.sol'), 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'CertificateRegistry.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((e) => e.severity === 'error');
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}

const contract = output.contracts['CertificateRegistry.sol'].CertificateRegistry;
fs.writeFileSync(
  path.join(root, 'src/contract.json'),
  JSON.stringify(
    { compiler: solc.version(), abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object },
    null,
    2
  ) + '\n'
);
console.log('Wrote src/contract.json');
