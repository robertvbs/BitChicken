// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { BitChickenToken } from "../bitchicken-token.sol";

/**
 * @title BitChickenTokenV2
 * @author Robert Wagner
 * @notice Test-only, storage-compatible upgrade of {BitChickenToken}. Adds a pure `version()` without
 *         touching the existing layout, exercising a clean proxy upgrade. Used by `test/upgrade.test.ts`.
 */
contract BitChickenTokenV2 is BitChickenToken {
  /**
   * @notice Returns the implementation version tag.
   */
  function version() external pure returns (string memory) {
    return "v2";
  }
}
