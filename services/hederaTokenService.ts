import { TokenCreateTransaction, Hbar, TokenType, TokenAssociateTransaction, Client, AccountId, PrivateKey, TokenMintTransaction, TokenId } from '@hashgraph/sdk';

export const createNonFungibleToken = async (
  client: Client,
  treasureyAccId: string | AccountId,
  supplyKey: PrivateKey,
  treasuryAccPvKey: PrivateKey,
  initialSupply: number,
  tokenName: string,
  tokenSymbol: string,
): Promise<[TokenId | null, string]> => {
  /* 
    * Create a transaction with token type fungible
    * Returns Fungible Token Id and Token Id in solidity format
  */
  const createTokenTxn = await new TokenCreateTransaction()
    .setTokenName(tokenName)
    .setTokenSymbol(tokenSymbol)
    .setTokenType(TokenType.NonFungibleUnique)
    .setInitialSupply(initialSupply)
    .setTreasuryAccountId(treasureyAccId)
    .setSupplyKey(supplyKey)
    .setMaxTransactionFee(new Hbar(30))
    .freezeWith(client); //freeze tx from from any further mods.

  const createTokenTxnSigned = await createTokenTxn.sign(treasuryAccPvKey);
  // submit txn to hedera network
  const txnResponse = await createTokenTxnSigned.execute(client);
  // request receipt of txn
  const txnRx = await txnResponse.getReceipt(client);
  const txnStatus = txnRx.status.toString();
  const tokenId = txnRx.tokenId;
  if (tokenId === null ) { throw new Error("Somehow tokenId is null.");}
  
  const tokenIdInSolidityFormat = tokenId.toSolidityAddress();

  console.log(
    `Token Type Creation was a ${txnStatus} and was created with token id: ${tokenId}`
  );

  return [tokenId, tokenIdInSolidityFormat];
};

export const mintToken = async (client: Client, tokenId: string | TokenId, metadatas: Uint8Array[], supplyKey: PrivateKey) => {

  const mintTokenTxn = new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata(metadatas)
    .freezeWith(client);

  const mintTokenTxnSigned = await mintTokenTxn.sign(supplyKey);

  // submit txn to hedera network
  const txnResponse = await mintTokenTxnSigned.execute(client);

  const mintTokenRx = await txnResponse.getReceipt(client);
  const mintTokenStatus = mintTokenRx.status.toString();

  console.log(`Token mint was a ${mintTokenStatus}`);
};

export const createNewNftCollection = async (
  client: Client,
  tokenName: string,
  tokenSymbol: string,
  metadataIPFSUrls: Buffer[], // already uploaded ipfs metadata json files
  treasuryAccountId: string | AccountId,
  treasuryAccountPrivateKey: PrivateKey,
): Promise<{
  tokenId: TokenId,
  supplyKey: PrivateKey,
}> => {
  // generate supply key
  const supplyKey = PrivateKey.generateED25519();

  const [tokenId, ] = await createNonFungibleToken(client, treasuryAccountId, supplyKey, treasuryAccountPrivateKey, 0, tokenName, tokenSymbol);
  if (tokenId === null || tokenId === undefined) {
    throw new Error("Somehow tokenId is null");
  }

  const metadatas: Uint8Array[] = metadataIPFSUrls.map(url => Buffer.from(url));

  // mint token
  await mintToken(client, tokenId, metadatas, supplyKey);
  return {
    tokenId: tokenId,
    supplyKey: supplyKey,
  };
}

export const associateToken = async (client: Client, tokenId: string | TokenId, accountId: string | AccountId, accountPrivateKey: PrivateKey) => {
  const tokenAssociateTx = new TokenAssociateTransaction()
  .setTokenIds([tokenId])
  .setAccountId(accountId)
  .freezeWith(client);
const tokenAssociateSign = await tokenAssociateTx.sign(accountPrivateKey);
const tokenAssociateSubmit = await tokenAssociateSign.execute(client);
const tokenAssociateRx = await tokenAssociateSubmit.getReceipt(client);
console.log(`- Associated with token: ${tokenAssociateRx.status}`);
} 