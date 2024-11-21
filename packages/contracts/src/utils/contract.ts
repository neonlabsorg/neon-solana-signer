const solc = require('solc');

export function compileSolidityContract(name: string, content: string): any {
  const input = {
    language: 'Solidity',
    sources: { [name]: { content } },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200 // Optimize for how many times you intend to call the contract
      },
      outputSelection: { '*': { '*': ['*'] } }
    }
  };
  const tempFile = JSON.parse(solc.compile(JSON.stringify(input)));
  return tempFile['contracts'][name][name.replace('.sol', '')];
}
