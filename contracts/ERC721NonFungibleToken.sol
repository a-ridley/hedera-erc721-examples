// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract ERC721NonFungibleToken {
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
  fallback () external{}
}