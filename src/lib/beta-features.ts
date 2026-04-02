type BetaFeature = 'videoEdit';

const BETA_ACCESS: Record<BetaFeature, RegExp[]> = {
  videoEdit: [
    /^renrenfujiwara/,
    /^team@zettai/,
  ],
};

export function hasBetaAccess(email: string | null | undefined, feature: BetaFeature): boolean {
  if (!email) return false;
  const patterns = BETA_ACCESS[feature];
  if (!patterns) return false;
  return patterns.some(pattern => pattern.test(email));
}
