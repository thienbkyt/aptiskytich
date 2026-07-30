export type QuotaInfo = {
  used: number;
  cap: number;
  tier: string;
  need: "pro";
};

/** Thrown when AI grading is refused because the user's quota is exhausted. */
export class QuotaExceededError extends Error {
  info: QuotaInfo;
  constructor(info: QuotaInfo) {
    super("quota_exceeded");
    this.name = "QuotaExceededError";
    this.info = info;
  }
}
