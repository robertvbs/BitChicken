// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { ERC20BurnableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import { ERC20PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import { ERC20PermitUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title BitChickenToken
 * @author Robert Wagner
 * @notice ERC-20 reward token for the BitChicken ecosystem (yield farming + referral payouts).
 * @dev Transparent-upgradeable proxy. Two privileged roles are granted after deploy:
 *      MINTER_ROLE → BitChickenStaking (yield) and BitChickenNFT (referral mints).
 *      PAUSER_ROLE → multisig / admin.
 *      All mints are gated by a global `emissionCap` to enforce deflationary tokenomics.
 *      ERC-7201 storage namespace: bitChicken.BitChickenToken.
 */
contract BitChickenToken is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  ERC20PausableUpgradeable,
  ERC20PermitUpgradeable,
  AccessControlUpgradeable
{
  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  /// @notice Role identifier for addresses allowed to mint new tokens.
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

  /// @notice Role identifier for addresses allowed to pause/unpause transfers.
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

  // ---------------------------------------------------------------------------
  // ERC-7201 namespaced storage
  // ---------------------------------------------------------------------------

  /// @custom:storage-location erc7201:bitChicken.BitChickenToken
  struct TokenStorage {
    /// @dev Total tokens minted so far (increases monotonically, never decremented by burns).
    uint256 totalMinted;
    /// @dev Hard cap on cumulative mints; owner-adjustable but never below current totalMinted.
    uint256 emissionCap;
  }

  // keccak256(abi.encode(uint256(keccak256("bitChicken.BitChickenToken")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant TOKEN_STORAGE_SLOT = 0x2e076ce1b568fb1782924f5ed1d16e498b0e44798ce784242508b88ccb5d9a00;

  function _getTokenStorage() private pure returns (TokenStorage storage $) {
    assembly {
      $.slot := TOKEN_STORAGE_SLOT
    }
  }

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  /**
   * @notice Thrown when a mint would push totalMinted above the emission cap.
   * @param requested Amount requested to mint.
   * @param available Remaining capacity under the cap.
   */
  error EmissionCapExceeded(uint256 requested, uint256 available);

  /**
   * @notice Thrown when the new emission cap is lower than the current totalMinted.
   * @param proposed  New cap value.
   * @param minted    Current totalMinted value.
   */
  error CapBelowTotalMinted(uint256 proposed, uint256 minted);

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * @notice Emitted when the emission cap is changed by the admin.
   * @param oldCap Previous cap value.
   * @param newCap New cap value.
   */
  event EmissionCapUpdated(uint256 indexed oldCap, uint256 indexed newCap);

  // ---------------------------------------------------------------------------
  // Constructor / Initializer
  // ---------------------------------------------------------------------------

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /**
   * @notice Initializes the token with name, symbol, roles and initial emission cap.
   * @dev Called once by the proxy at deployment time. Sets DEFAULT_ADMIN_ROLE to `admin`,
   *      PAUSER_ROLE to `pauser`, and MINTER_ROLE to `minter`.
   *      The initial emission cap is set to 0 — the owner must call setEmissionCap before minting.
   * @param name_   Token name (e.g. "BitChicken").
   * @param symbol_ Token symbol (e.g. "BCK").
   * @param admin   Address granted DEFAULT_ADMIN_ROLE and initial ownership.
   * @param pauser  Address granted PAUSER_ROLE.
   * @param minter  Address granted MINTER_ROLE (bootstrap minter, revoked after wiring).
   */
  function initialize(
    string memory name_,
    string memory symbol_,
    address admin,
    address pauser,
    address minter
  ) external initializer {
    __ERC20_init(name_, symbol_);
    __ERC20Burnable_init();
    __ERC20Pausable_init();
    __ERC20Permit_init(name_);
    __AccessControl_init();

    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(PAUSER_ROLE, pauser);
    _grantRole(MINTER_ROLE, minter);
  }

  // ---------------------------------------------------------------------------
  // Minting
  // ---------------------------------------------------------------------------

  /**
   * @notice Mints `amount` tokens to `to`, enforcing the global emission cap.
   * @dev Reverts with EmissionCapExceeded if totalMinted + amount > emissionCap.
   *      This function is intentionally separate from ERC-20 _mint so that
   *      cap accounting is always applied and cannot be bypassed by internal callers.
   * @param to     Recipient address.
   * @param amount Tokens to mint (18-decimal wei).
   */
  function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
    TokenStorage storage $ = _getTokenStorage();
    uint256 remaining = $.emissionCap - $.totalMinted;
    if (amount > remaining) {
      revert EmissionCapExceeded(amount, remaining);
    }
    $.totalMinted += amount;
    _mint(to, amount);
  }

  // ---------------------------------------------------------------------------
  // Emission cap management
  // ---------------------------------------------------------------------------

  /**
   * @notice Updates the global emission cap.
   * @dev The new cap must be >= totalMinted, otherwise reverts with CapBelowTotalMinted.
   *      Only DEFAULT_ADMIN_ROLE can call this.
   * @param newCap New maximum cumulative mint amount in token wei.
   */
  function setEmissionCap(uint256 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
    TokenStorage storage $ = _getTokenStorage();
    if (newCap < $.totalMinted) {
      revert CapBelowTotalMinted(newCap, $.totalMinted);
    }
    uint256 old = $.emissionCap;
    $.emissionCap = newCap;
    emit EmissionCapUpdated(old, newCap);
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  /**
   * @notice Pauses all token transfers.
   * @dev Only PAUSER_ROLE. Use as an emergency kill-switch.
   */
  function pause() external onlyRole(PAUSER_ROLE) {
    _pause();
  }

  /**
   * @notice Unpauses token transfers.
   * @dev Only PAUSER_ROLE.
   */
  function unpause() external onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /**
   * @notice Returns the cumulative amount of tokens ever minted.
   * @dev Burns do not decrement this counter — it tracks gross emission only.
   * @return Total tokens minted in token wei.
   */
  function totalMinted() external view returns (uint256) {
    return _getTokenStorage().totalMinted;
  }

  /**
   * @notice Returns the global emission cap.
   * @return Maximum cumulative mint amount in token wei.
   */
  function emissionCap() external view returns (uint256) {
    return _getTokenStorage().emissionCap;
  }

  // ---------------------------------------------------------------------------
  // Required overrides
  // ---------------------------------------------------------------------------

  /**
   * @dev Resolves the diamond-problem override between ERC20Pausable and ERC20.
   */
  function _update(
    address from,
    address to,
    uint256 value
  ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
    super._update(from, to, value);
  }
}
