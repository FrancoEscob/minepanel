export const USER_ROLES = ["owner", "admin", "viewer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const NODE_LOCAL_ID = "local";
