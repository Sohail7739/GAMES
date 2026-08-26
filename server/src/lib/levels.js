const LEVELS = Array.from({ length: 100 }, (_, i) => ({
  level: i + 1,
  xpRequired: Math.round(100 * Math.pow(1.22, i)),
}));

export function xpForLevel(level) {
  return LEVELS.find((l) => l.level === level)?.xpRequired ?? Infinity;
}

export function levelForXp(totalXp) {
  let level = 1;
  for (const l of LEVELS) {
    if (totalXp >= l.xpRequired) level = l.level;
    else break;
  }
  return level;
}

export function progressForXp(totalXp) {
  const level = levelForXp(totalXp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const into = totalXp - (current - xpForLevel(level - 1) || 0);
  return {
    level,
    currentXp: Math.max(0, totalXp - (current - xpForLevel(level - 1) || 0)),
    xpNeeded: next - current,
    progress: Math.min(100, Math.round((into / (next - current)) * 100)) || 0,
  };
}
