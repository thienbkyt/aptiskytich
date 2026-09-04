/**
 * Chạy `fn` trên từng phần tử với số lượng đồng thời tối đa `limit`.
 * Giữ nguyên thứ tự kết quả theo thứ tự đầu vào.
 * Nếu một phần tử ném lỗi: dừng khởi tạo phần còn lại và ném lỗi đó ra ngoài.
 */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const max = Math.max(1, Math.min(limit, items.length || 1));
  let next = 0;
  let failed = false;

  const worker = async () => {
    while (!failed) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };

  await Promise.all(Array.from({ length: max }, () => worker()));
  return results;
}
