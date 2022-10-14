import { Client, AccountId, PrivateKey, Hbar, ContractFunctionParameters, ContractFunctionResult } from "@hashgraph/sdk";
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
  const [treasuryAccId, treasuryAccPvKey] = await createAccount(client, 100);
  console.log(`- Treasury's account: https://hashscan.io/#/testnet/account/${treasuryAccId}`);
  console.log(`- Treasury's private key: ${treasuryAccPvKey}`);
  const [aliceAccId, aliceAccPvKey] = await createAccount(client, 100);
  console.log(`- Alice's account: https://hashscan.io/#/testnet/account/${aliceAccId}`);

  const [bobAccId, bobAccPvKey] = await createAccount(client, 100);
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
  const tokenInfo = await tokenInfoQuery(txnResponse.tokenId, client);
  console.log(`Initial token supply: ${tokenInfo.totalSupply.low}\n`);

  const TOKEN_ID_IN_SOLIDITY_FORMAT = txnResponse.tokenId.toSolidityAddress();
  console.log(`Token Id in solidity format: ${TOKEN_ID_IN_SOLIDITY_FORMAT}`);
  const ALICE_ACCOUNT_IN_SOLIDITY_FORMAT = aliceAccId.toSolidityAddress();
  console.log(`Alice, the spender, address in solidity format: ${ALICE_ACCOUNT_IN_SOLIDITY_FORMAT}`);


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

  // set operator to be treasury account (treasury account is now the caller of the smart contract)
  client.setOperator(treasuryAccId, treasuryAccPvKey);

  // NFTs with serial #1, #3, and #5 to approve
  const nFTsToApprove = [1, 3, 5];
  console.log(`------- Start approval of NFTs ------\n`);
  for (let i = 0; i < nFTsToApprove.length; i++) {
    // Setting the necessary parameters to execute the approve contract function
    const approveParams = new ContractFunctionParameters()
    .addAddress(TOKEN_ID_IN_SOLIDITY_FORMAT)
    .addAddress(ALICE_ACCOUNT_IN_SOLIDITY_FORMAT)
    .addUint256(nFTsToApprove[i]);

    await executeContractFunction(
      client,
      contractId,
      4_000_000,
      'approve',
      approveParams,
      treasuryAccPvKey);
  }

  /*
   *  TODO: uncomment if you want to approve all of msg.sender assets 
   */
  // const isApproveAll = true;
  // const setApprovalForAllParams = new ContractFunctionParameters()
  //   .addAddress(TOKEN_ID_IN_SOLIDITY_FORMAT)
  //   .addAddress(ALICE_ACCOUNT_IN_SOLIDITY_FORMAT)
  //   .addBool(isApproveAll)


  // Get the account, in solidity format, approved for token with serial number 3
  // const getApprovedParams = new ContractFunctionParameters()
  // .addAddress(TOKEN_ID_IN_SOLIDITY_FORMAT)
  // .addUint256(3);

  // const contractFunctionResult = await executeContractFunction(
  //     client,
  //     contractId,
  //     4_000_000,
  //     'getApprovedBySerialNumber',
  //     getApprovedParams,
  //     treasuryAccPvKey);

  
  /*
   *  get the approved address for each NFT in collection
   *  returns the approved address or the zero address if there is none
  */
  let contractFunctionRes = [];
  console.log(` - Get approved address for each NFT in collection ${txnResponse.tokenId}`)
  for(let serialNum=1; serialNum < 6; serialNum++) {
    const getApprovedParams = new ContractFunctionParameters()
      .addAddress(TOKEN_ID_IN_SOLIDITY_FORMAT)
      .addUint256(serialNum);
  
      contractFunctionRes.push(await executeContractFunction(
      client,
      contractId,
      4_000_000,
      'getApprovedBySerialNumber',
      getApprovedParams,
      treasuryAccPvKey));
  }

  if (contractFunctionRes) {
    contractFunctionRes.forEach((result) => {
        console.log(`\n- Approved Address: ${result?.getAddress()}`);
    })
  }

  // set the client back to the operator account
  client.setOperator(operatorAccountId, operatorPrivateKey);
  await checkAccountBalance(treasuryAccId, txnResponse.tokenId, client);
  await checkAccountBalance(bobAccId, txnResponse.tokenId, client);

  // make alice the client to execute the contract call.
  client.setOperator(aliceAccId, aliceAccPvKey);
  // alice tranfers the NFTs with serial #1, serial #3, and serial #5 to Bob
  const nFTsToTransfer = [1, 3, 5];
  console.log(`------- Start transfer of ownership for NFTs ------\n`)
  for (let i = 0; i < nFTsToTransfer.length; i++) {
    // Setting the necessary paramters to execute the approve contract function
    const transferFromParams = new ContractFunctionParameters()
    .addAddress(TOKEN_ID_IN_SOLIDITY_FORMAT)
    .addAddress(treasuryAccId.toSolidityAddress())
    .addAddress(bobAccId.toSolidityAddress())
    .addUint256(nFTsToTransfer[i]);

    await executeContractFunction(
      client,
      contractId,
      4_000_000,
      'transferFrom',
      transferFromParams,
      treasuryAccPvKey);
  }

  await checkAccountBalance(treasuryAccId, txnResponse.tokenId, client);
  await checkAccountBalance(bobAccId, txnResponse.tokenId, client);

  // set operator to be treasury account (treasury account is now the caller of the smart contract)
  client.setOperator(treasuryAccId, treasuryAccPvKey);

  /*
    * Remove NFT approval 
  */
  const nFTsToRemoveApproval = [1, 3, 5];
  console.log(`------- Start removal of approval for NFTs -------\n`);
  for (let i = 0; i < nFTsToRemoveApproval.length; i++) {
    // Setting the necessary paramters to execute the approve contract function
    const approveParams = new ContractFunctionParameters()
    .addAddress(TOKEN_ID_IN_SOLIDITY_FORMAT)
    .addAddress('0x0000000000000000000000000000000000000000')
    .addUint256(nFTsToRemoveApproval[i]);

    await executeContractFunction(
      client,
      contractId,
      4_000_000,
      'approve',
      approveParams,
      treasuryAccPvKey);
  }

  /*
   *  get the approved addres for each NFT in collection
   *  returns the approved address or the zero address if there is none
  */
  let contractFunctionResult = [];
  console.log(` - Get approved address for each NFT in collection ${txnResponse.tokenId} (should all be zero address)`)
  for(let serialNum=1; serialNum < 6; serialNum++) {
    const getApprovedParams = new ContractFunctionParameters()
      .addAddress(TOKEN_ID_IN_SOLIDITY_FORMAT)
      .addUint256(serialNum);
  
      contractFunctionResult.push(await executeContractFunction(
      client,
      contractId,
      4_000_000,
      'getApprovedBySerialNumber',
      getApprovedParams,
      treasuryAccPvKey));
  }

  if (contractFunctionResult) {
    contractFunctionResult.forEach((result) => {
        console.log(`\n- Approved Address: ${result?.getAddress()}`);
    })
  }

  client.close();
}
grantAllowanceExample();