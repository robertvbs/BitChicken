// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

/**
 * @title IBitChickenToken
 * @author Robert Wagner
 * @notice Interface for the BitChicken ERC-20 reward token.
 * @dev Used by staking and NFT contracts to mint yield and referral rewards
 *      without importing the full implementation.
 */
interface IBitChickenToken {
  /**
   * @notice Mints `amount` tokens to `to`, enforcing the global emission cap.
   * @dev Only accounts with MINTER_ROLE may call this function.
   * @param to Recipient address.
   * @param amount Number of tokens (18-decimal wei) to mint.
   */
  function mint(address to, uint256 amount) external;

  /**
   * @notice Burns `amount` tokens from `account`, deducting from the caller's allowance.
   * @dev Caller must have been approved at least `amount` by `account`.
   * @param account Address whose tokens are burned.
   * @param amount  Tokens to burn in token wei.
   */
  function burnFrom(address account, uint256 amount) external;

  /**
   * @notice Returns the maximum total tokens that may ever be minted.
   * @return cap The emission cap in token wei.
   */
  function emissionCap() external view returns (uint256 cap);

  /**
   * @notice Returns the cumulative amount of tokens minted so far.
   * @return minted Total tokens minted in token wei.
   */
  function totalMinted() external view returns (uint256 minted);
}
