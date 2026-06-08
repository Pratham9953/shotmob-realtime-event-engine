export function toVectorLiteral(vector: number[] | null): string | null {
  if (!vector || vector.length === 0) return null;
  return `[${vector.join(",")}]`;
}
