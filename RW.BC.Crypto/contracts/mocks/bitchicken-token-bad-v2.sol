// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { BitChickenToken } from "../bitchicken-token.sol";

/**
 * @title BitChickenTokenBadV2
 * @author Robert Wagner
 * @notice Test-only, UPGRADE-UNSAFE variant of {BitChickenToken}: contains a `selfdestruct`, which the
 *         OpenZeppelin upgrades validator rejects. Used by the negative case in `test/upgrade.test.ts`
 *         to prove the upgrade-safety gate blocks bad implementations.
 */
contract BitChickenTokenBadV2 is BitChickenToken {
  /**
   * @notice Unsafe operation that must cause the upgrade validator to reject this implementation.
   */
  function destroy() external {
    selfdestruct(payable(msg.sender));
  }
}
