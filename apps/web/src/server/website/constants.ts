/** Grace period in days after subscription cancellation before a website becomes INACTIVE */
export const WEBSITE_GRACE_PERIOD_DAYS = 30;

/** Error codes returned by the website service */
export const WebsiteErrors = {
  WEBSITE_ALREADY_CONNECTED: "WEBSITE_ALREADY_CONNECTED",
  MERCHANT_ALREADY_HAS_ACTIVE: "MERCHANT_ALREADY_HAS_ACTIVE",
  NOT_FOUND: "WEBSITE_NOT_FOUND",
  NOT_OWNER: "WEBSITE_NOT_OWNER",
  ALREADY_CRAWLING: "WEBSITE_ALREADY_CRAWLING",
} as const;
