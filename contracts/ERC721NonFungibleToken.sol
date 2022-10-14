// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract ERC721NonFungibleToken {
  /// @notice Approve spender address to spend specific NFTs on behalf of msg.sender
  /// @param token address of the token to approve
  /// @param spender address of spender
  /// @param serialNumber is the tokenId of NFT
  function approve(address token, address spender, uint256 serialNumber) public returns (bool result) {
      (bool success, ) = token.delegatecall(
          abi.encodeWithSelector(
              IERC721.approve.selector,
              spender,
              serialNumber
          )
      );
      return success;
  }

  /// @notice Get the approved address by serial number for a single NFT
  /// @param token address of token to approve
  /// @param tokenId represents the NFT serial number
  /// @return spender address approved for the NFT, or zero addres if there is none
  function getApprovedBySerialNumber(address token, uint256 tokenId) external view returns (address spender) {
    return IERC721(token).getApproved(tokenId);
  }

  /// @notice Transfer NFT to a different owner
  /// @param token address of token to transfer
  /// @param sender is the address from where the NFT is being transferred from
  /// @param recipient is the address to where the NFT is being transferred to 
  /// @return result success if transfer was successful
  function transferFrom(address token, address sender, address recipient, uint256 serialNumber) public returns (bool result) {
      (bool success, ) = token.delegatecall(
        abi.encodeWithSelector(
            IERC721.transferFrom.selector,
            sender,
            recipient,
            serialNumber
        )
    );
    return success;
  }

  fallback () external{}
}