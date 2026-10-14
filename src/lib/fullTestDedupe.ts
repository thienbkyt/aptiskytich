/**
 * Một phiên Thi thử (full_test_session_id) có thể chứa 2 lần làm cùng 1 part:
 * học viên thoát giữa chừng rồi vào làm lại trong 24h → phiên cũ được dùng lại
 * và làm lại từ đầu. Khi xem lịch sử / tính điểm chỉ giữ lần làm MỚI NHẤT của
 * mỗi đề (exam_set_id) trong phiên. Không xoá dữ liệu nào.
 */
export function latestRowIdsPerSessionSet<T extends { id: string; created_at?: string | null; exam_set_id?: string | null; full_test_session_id?: string | null }>(
  rows: T[],
): Set<string> {
  const best = new Map<string, T>();
  const keep = new Set<string>();
  for (const r of rows) {
    if (!r.full_test_session_id || !r.exam_set_id) { keep.add(r.id); continue; }
    const k = `${r.full_test_session_id}|${r.exam_set_id}`;
    const cur = best.get(k);
    const t = new Date(r.created_at || 0).getTime() || 0;
    const ct = cur ? new Date(cur.created_at || 0).getTime() || 0 : -1;
    if (!cur || t >= ct) best.set(k, r);
  }
  best.forEach((r) => keep.add(r.id));
  return keep;
}

export function dedupeLatestPerSessionSet<T extends { id: string; created_at?: string | null; exam_set_id?: string | null; full_test_session_id?: string | null }>(rows: T[]): T[] {
  const keep = latestRowIdsPerSessionSet(rows);
  return rows.filter((r) => keep.has(r.id));
}
