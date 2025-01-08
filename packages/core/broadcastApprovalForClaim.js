const web3 = require("@solana/web3.js");
const {
    getAssociatedTokenAddress,
    createApproveInstruction,
} = require('@solana/spl-token');
const bs58 = require("bs58");
require("dotenv").config();

const connection = new web3.Connection('https://curve-stand.neontest.xyz/solana', "processed");

const keypair = web3.Keypair.fromSecretKey(
    bs58.default.decode(process.env.SOLANA_WALLET)
);
console.log(keypair.publicKey.toBase58(), 'publicKey');

async function init() {
    const tokenMint = new web3.PublicKey('9jgF9jg95TzbJwCePmLeS6XcbqFDy4tL6uV9fC7JNVVw'); // tokenMint of ERC20ForSPL
    const ERC20ForSPL = '0x81C4e95Ce11d9732fEE99Cce25e61dEC99887530';
    const userAddress = '0x029158417ee0da19f0561e09302429fb9ebf1af7';

    const neon_getEvmParamsRequest = await fetch('https://curve-stand.neontest.xyz/', {
        method: 'POST',
        body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const neon_getEvmParams = await neon_getEvmParamsRequest.json();

    const keypairTokenAta = await getAssociatedTokenAddress(
        tokenMint,
        keypair.publicKey,
        false
    );
    console.log(keypairTokenAta, 'keypairTokenAta');

    const seed = [
        new Uint8Array([0x03]),
        new Uint8Array(Buffer.from('AUTH', 'utf-8')),
        Buffer.from(ERC20ForSPL.substring(2), 'hex'),
        Buffer.from(Buffer.concat([Buffer.alloc(12), Buffer.from(isValidHex(userAddress) ? userAddress.substring(2) : userAddress, 'hex')]), 'hex')
    ];

    const delegatedPda = web3.PublicKey.findProgramAddressSync(seed, new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId));
    console.log(delegatedPda, 'delegatedPda');

    const tx = new web3.Transaction();
    tx.add(
        createApproveInstruction(
            keypairTokenAta,
            delegatedPda[0],
            keypair.publicKey,
            '18446744073709551615' // max uint64
        )
    );

    await web3.sendAndConfirmTransaction(connection, tx, [keypair]);
    return;
}
init();

function isValidHex(hex) {
    const isHexStrict = /^(0x)?[0-9a-f]*$/i.test(hex.toString());
    if (!isHexStrict) {
        throw new Error(`Given value "${hex}" is not a valid hex string.`);
    } else {
        return isHexStrict;
    }
}