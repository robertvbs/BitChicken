// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

/**
 * @title BitChicken Shared Errors
 * @notice Canonical error declarations shared across BitChicken contracts to avoid
 *         selector drift and duplicate declarations.
 */

/// @notice Thrown when a zero address is supplied where one is not allowed.
error ZeroAddress();

/// @notice Thrown when a BNB (native coin) transfer via low-level call fails.
error TransferFailed();

/// @notice Thrown when the caller does not own the token they are operating on.
/// @param tokenId The token ID that the caller does not own.
error NotTokenOwner(uint256 tokenId);

/// @notice Thrown when basis points exceed 10000 (100%).
/// @param bps The invalid basis-points value supplied.
error InvalidBasisPoints(uint256 bps);
