// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { BitChickenToken } from "../../contracts/bitchicken-token.sol";

/// @dev Random-action driver for the BitChickenToken invariants.
contract TokenHandler is Test {
  BitChickenToken public token;

  constructor(BitChickenToken token_) {
    token = token_;
  }

  function mint(address to, uint256 amount) external {
    amount = bound(amount, 0, 1e30);
    if (to == address(0)) to = address(0xBEEF);
    try token.mint(to, amount) {} catch {}
  }

  function setCap(uint256 cap) external {
    cap = bound(cap, token.totalMinted(), 1e36);
    try token.setEmissionCap(cap) {} catch {}
  }

  function burn(uint256 amount) external {
    amount = bound(amount, 0, token.balanceOf(address(this)));
    try token.burn(amount) {} catch {}
  }
}

contract TokenInvariants is Test {
  BitChickenToken internal token;
  TokenHandler internal handler;

  function setUp() public {
    BitChickenToken impl = new BitChickenToken();
    bytes memory initData = abi.encodeCall(
      BitChickenToken.initialize,
      ("BitChicken", "BCK", address(this), address(this), address(this))
    );
    token = BitChickenToken(address(new ERC1967Proxy(address(impl), initData)));
    token.setEmissionCap(1e30);
    handler = new TokenHandler(token);
    token.grantRole(token.MINTER_ROLE(), address(handler));
    targetContract(address(handler));
  }

  /// @dev totalMinted must never exceed the emission cap.
  function invariant_totalMintedNeverExceedsCap() public view {
    assertLe(token.totalMinted(), token.emissionCap());
  }

  /// @dev Circulating supply can never exceed the amount ever minted.
  function invariant_supplyNeverExceedsMinted() public view {
    assertLe(token.totalSupply(), token.totalMinted());
  }
}
