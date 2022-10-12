import { Client, AccountId, PrivateKey, Hbar, ContractFunctionParameters } from "@hashgraph/sdk";
import * as dotenv from 'dotenv';
dotenv.config()
const fs = require("fs");
import { createNonFungibleToken, associateToken, createNewNftCollection } from "./services/hederaTokenService";
import { createAccount } from "./services/hederaAccountService";
import { tokenInfoQuery, checkAccountBalance, checkContractBalance } from "./services/queries";
import { deployContract, executeContractFunction } from "./services/hederaSmartContractService";


// create your client
const accountIdString = process.env.OPERATOR_ACCOUNT_ID;
const privateKeyString = process.env.OPERATOR_PRIVATE_KEY;
if (accountIdString === undefined || privateKeyString === undefined ) { throw new Error('account id and private key in env file are empty')}

const operatorAccountId = AccountId.fromString(accountIdString);
const operatorPrivateKey = PrivateKey.fromString(privateKeyString);

const client = Client.forTestnet().setOperator(operatorAccountId, operatorPrivateKey);
client.setDefaultMaxTransactionFee(new Hbar(100));

/*
  * Creates a treasury account for a token collection. 
  * Creates an account for Alice and Bob.
  * Grants an allowance to Alice to transfer Fungible tokens to Bob using standrd ERC calls
*/
const grantAllowanceExample = async () => {
  // create treasury's, alice's, and bob's accounts
  const [treasuryAccId, treasuryAccPvKey] = await createAccount(client, 50);
  console.log(`- Treasury's account: https://hashscan.io/#/testnet/account/${treasuryAccId}`);
  console.log(`- Treasury's private key: ${treasuryAccPvKey}`);
  const [aliceAccId, aliceAccPvKey] = await createAccount(client, 50);
  console.log(`- Alice's account: https://hashscan.io/#/testnet/account/${aliceAccId}`);
  const [bobAccId, bobAccPvKey] = await createAccount(client, 50);
  console.log(`- Bob's account: https://hashscan.io/#/testnet/account/${bobAccId}`);
  console.log(`- Bob's private key: ${bobAccPvKey}\n`);

  // already uploaded ipfs metadata json files
  const metadataIPFSUrls: Buffer[] = [
    Buffer.from("ipfs://bafkreiap62fsqxmo4hy45bmwiqolqqtkhtehghqauixvv5mcq7uofdpvt4"),
    Buffer.from("ipfs://bafkreibvluvlf36lilrqoaum54ga3nlumms34m4kab2x67f5piofmo5fsa"),
    Buffer.from("ipfs://bafkreidrqy67amvygjnvgr2mgdgqg2alaowoy34ljubot6qwf6bcf4yma4"),
    Buffer.from("ipfs://bafkreicoorrcx3d4foreggz72aedxhosuk3cjgumglstokuhw2cmz22n7u"),
    Buffer.from("ipfs://bafkreidv7k5vfn6gnj5mhahnrvhxep4okw75dwbt6o4r3rhe3ktraddf5a"),
];
  // create token collection and print initial supply
  const txnResponse = await createNewNftCollection(client, 'HBAR RULES', 'HRULES', metadataIPFSUrls, treasuryAccId, treasuryAccPvKey);
  const tokenIdInSolidityFormat = txnResponse.tokenId.toSolidityAddress();

  const tokenInfo = await tokenInfoQuery(txnResponse.tokenId, client);
  console.log(`Initial token supply: ${tokenInfo.totalSupply.low}\n`);

  // Bob must associate to recieve token
  await associateToken(client, txnResponse.tokenId, bobAccId, bobAccPvKey)

  /*
    * Read compiled byte code
    * Note: You can compile your smart contract on Remix ide or using solc
  */
  const bytecode = fs.readFileSync("binaries/contracts_ERC721NonFungibleToken_sol_ERC721NonFungibleToken.bin");

  // Deploy contract
  const gasLimit = 1000000;
  const [contractId, contractSolidityAddress] = await deployContract(client, bytecode, gasLimit);

  // set oeprator to be treasury account (treasury account is now the caller of smart contract)
  client.setOperator(treasuryAccId, treasuryAccPvKey);

  /*
   * Setting the necessary paramters to execute the approve contract function
   * tokenIdInSolidityFormat is the solidity address of the token we are granting approval for
   * aliceAccId is the solidity address of the spender
   * serialNum is the serial number of the NFT we allow Alice to spend on behalf of the treasury account
  */
  for(let serialNum=1; serialNum < 6; serialNum++) {
    const approveParams = new ContractFunctionParameters()
      .addAddress(tokenIdInSolidityFormat)
      .addAddress(aliceAccId.toSolidityAddress())
      .addUint256(serialNum);
  
    await executeContractFunction(
      client,
      contractId,
      4_000_000,
      'approve',
      approveParams,
      treasuryAccPvKey);
  }

  // set the client back to the operator account
  client.setOperator(operatorAccountId, operatorPrivateKey);
  await checkAccountBalance(treasuryAccId, txnResponse.tokenId, client);
  await checkAccountBalance(bobAccId, txnResponse.tokenId, client);

  // make alice the client to excute the contract call.
  client.setOperator(aliceAccId, aliceAccPvKey);
  // alice tranfers the NFTs with serial #1, serial #2, and serial #3 to Bob
  for(let serialNum=1; serialNum < 4; serialNum++) {
    const transferFromParams = new ContractFunctionParameters()
    .addAddress(tokenIdInSolidityFormat)
    .addAddress(treasuryAccId.toSolidityAddress())
    .addAddress(bobAccId.toSolidityAddress())
    .addUint256(serialNum);
  
    await executeContractFunction(
      client,
      contractId,
      4_000_000,
      'transferFrom',
      transferFromParams,
      aliceAccPvKey);
  }

  await checkAccountBalance(treasuryAccId, txnResponse.tokenId, client);
  await checkAccountBalance(bobAccId, txnResponse.tokenId, client);

  // set operator to be treasury account (treasury account is now the caller of the smart contract)
  // client.setOperator(treasuryAccId, treasuryAccPvKey);

  // remove NFT allowance
  // for(let serialNum=1; serialNum < 6; serialNum++) {
  //   const approveParams = new ContractFunctionParameters()
  //     .addAddress('0x0000000000000000000000000000000000000000')
  //     .addAddress(aliceAccId.toSolidityAddress())
  //     .addUint256(serialNum);
  
  //   await executeContractFunction(
  //     client,
  //     contractId,
  //     4_000_000,
  //     'approve',
  //     approveParams,
  //     treasuryAccPvKey);
  // }
  client.close();
}
grantAllowanceExample();