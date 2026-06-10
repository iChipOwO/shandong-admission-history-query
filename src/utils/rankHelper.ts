export function getDefaultRankRange(r: number) {
  if (r <= 100) {
    return {
      rankMin: 1,
      rankMax: Math.max(300, Math.floor(1.60 * r))
    };
  } else if (r <= 1000) {
    return {
      rankMin: 1,
      rankMax: Math.max(1500, Math.floor(1.60 * r))
    };
  } else {
    return {
      rankMin: Math.max(1, Math.floor(0.85 * r)),
      rankMax: Math.floor(1.60 * r)
    };
  }
}
