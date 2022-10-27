# How to Approve an Address to transfer NFT's on Hedera

You can treat a HTS Non-Fungible like an ERC-721 token by creating a smart contract that leverages the ERC-721 standard contract calls and using the Hedera SDK.

Check out [HIP-218](https://hips.hedera.com/hip/hip-218) to learn more! 🎉

## How to Run
Create a .env file with your testnet credentials. Need a testnet account? Register for a Hedera testnet account here. Recieve 10,000 test hbar every 24 hours!

`npm i `

`npm run start`
 
 This will compile your smart contract, grant Alice's Address approval to NFTs with serial #s 1,3, and 5, and Alice will transfer NFTs with serial #s 3 and #5 to Bob's account on behalf of the treasury's account.
