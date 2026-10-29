export function assessWaterValues(
  measurement: Record<string, any> | null,
  targets: Record<string, { min?: number | null; max?: number | null }> | null,
  keys: readonly string[],
  now = Date.now(),
) {
  let evaluated = 0;
  let outside = 0;
  for (const key of keys) {
    const value = measurement?.[key];
    const range = targets?.[key];
    if (value == null || !Number.isFinite(Number(value)) || !range || (range.min == null && range.max == null)) continue;
    evaluated++;
    if ((range.min != null && Number(value) < range.min) || (range.max != null && Number(value) > range.max)) outside++;
  }
  const timestamp = measurement?.['measuredAt'] ? new Date(measurement['measuredAt']).getTime() : NaN;
  const recent = Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= 14 * 86400000;
  return { evaluated, outside, recent };
}
