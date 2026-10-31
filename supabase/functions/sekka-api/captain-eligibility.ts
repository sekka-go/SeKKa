export function filterApprovedCaptainLines<T extends { captain_user_id: number | string }>(
  lines: T[],
  approvedCaptainIds: ReadonlySet<number>,
): T[] {
  return lines.filter((line) => approvedCaptainIds.has(Number(line.captain_user_id)));
}