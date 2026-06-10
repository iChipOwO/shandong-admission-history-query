export type TrendLabel = '升温' | '稳定' | '降温' | '波动较大' | '数据不足';
export type ReferenceLabel = '偏冲' | '接近' | '相对稳' | '差距较大' | '数据不足';

export function getTrendLabel(ranks: (number | null)[]): TrendLabel {
  // expects [rank2025, rank2024, rank2023] where rank2025 is the latest
  const validRanks = ranks.filter((r): r is number => r !== null && r > 0);
  if (validRanks.length < 2) return '数据不足';

  // For consecutive checks, we need them in chronological order: [2023, 2024, 2025]
  // Since input is latest first, we reverse it
  const chron = [...ranks].reverse();
  const validChron = chron.filter((r): r is number => r !== null && r > 0);

  let isIncreasing = true; // ranks getting larger = 降温
  let isDecreasing = true; // ranks getting smaller = 升温

  for (let i = 1; i < validChron.length; i++) {
    if (validChron[i] >= validChron[i - 1]) isDecreasing = false;
    if (validChron[i] <= validChron[i - 1]) isIncreasing = false;
  }

  if (isDecreasing && validChron.length >= 2) return '升温';
  if (isIncreasing && validChron.length >= 2) return '降温';

  const maxRank = Math.max(...validRanks);
  const minRank = Math.min(...validRanks);
  const latestRank = validRanks[0]; // the latest is the first in validRanks since validRanks preserves order of latest first? Wait, validRanks is derived from latest first.
  
  if ((maxRank - minRank) / latestRank > 0.20) {
    return '波动较大';
  }

  return '稳定';
}

export function getReferenceLabel(userRank: number | null | undefined, latestMinRank: number | null | undefined): ReferenceLabel {
  if (!userRank || !latestMinRank || userRank <= 0 || latestMinRank <= 0) return '数据不足';

  // ratio = userRank / latestMinRank
  // rank越小越好，ratio<1 说明用户位次比录取线更靠前（更稳）
  const ratio = userRank / latestMinRank;

  if (ratio <= 0.90) return '相对稳';
  if (ratio <= 1.00) return '接近';
  if (ratio <= 1.15) return '偏冲';
  return '差距较大';
}
