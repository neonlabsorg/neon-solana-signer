# Solana native demo

### Environment configuration

To start the project, you need to set environment variables in the `.env` file:

```dotenv
REACT_APP_SOLANA_URL: <solana_rpc_url>
REACT_APP_NEON_CORE_API_RPC_URL: <neon_core_api_rpc_url>
```

### Solana localnet configuration

To enable Phantom Wallet to work with Solana localnet, it is necessary to forward ports to localhost. We have created a `docker-compose` configuration, an example of which can be found in the `docker-compose.yaml.example` file.

You need to rename this configuration file to `docker-compose.yaml` and specify `<solana_rpc_url>`. After that, you can start it using the command: `docker compose up`.

### Running the project

```bash
yarn install
yarn dev
```

For building run command:

```bash
yarn build
```
