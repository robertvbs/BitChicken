export const ListingStatus = {
  Active: "Active",
  Cancelled: "Cancelled",
  Sold: "Sold",
} as const;

export const SwapStatus = {
  Proposed: "Proposed",
  Cancelled: "Cancelled",
  Accepted: "Accepted",
} as const;

export const ForgeRequestStatus = {
  Requested: "Requested",
  Fulfilled: "Fulfilled",
  Cancelled: "Cancelled",
} as const;

export const StakingPairStatus = {
  Staked: "Staked",
  Unstaked: "Unstaked",
} as const;

export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];
export type SwapStatus = (typeof SwapStatus)[keyof typeof SwapStatus];
export type ForgeRequestStatus = (typeof ForgeRequestStatus)[keyof typeof ForgeRequestStatus];
export type StakingPairStatus = (typeof StakingPairStatus)[keyof typeof StakingPairStatus];
