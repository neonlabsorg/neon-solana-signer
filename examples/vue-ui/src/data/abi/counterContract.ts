export const counterContractAbi = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "int256",
        "name": "newValue",
        "type": "int256"
      }
    ],
    "name": "CounterUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "clear",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decrease",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCount",
    "outputs": [
      {
        "internalType": "int256",
        "name": "",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "increase",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]

export default counterContractAbi;
