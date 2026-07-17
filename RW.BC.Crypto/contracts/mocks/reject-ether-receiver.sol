// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

/**
 * @title RejectEtherReceiver
 * @notice Test-only contract with no receive/fallback, used to verify that
 *         marketplace fee/seller payment failures surface the correct custom errors
 *         when the recipient reverts on BNB receipt.
 */
contract RejectEtherReceiver {
  /**
   * @notice Forwards an arbitrary call to `target`, bubbling reverts so custom errors
   *         are surfaced in tests.
   * @param target The contract to call.
   * @param data   ABI-encoded calldata.
   */
  function execute(address target, bytes calldata data) external payable {
    (bool ok, bytes memory ret) = target.call{ value: msg.value }(data);
    if (!ok) {
      assembly {
        revert(add(ret, 0x20), mload(ret))
      }
    }
  }
}
