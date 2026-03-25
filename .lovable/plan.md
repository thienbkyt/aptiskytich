

# Fix: Dictionary popup không hiện khi double-click

## Nguyên nhân
Handler **close-on-outside-click** (line 150-156) đang đóng popup ngay khi double-click xảy ra, vì mỗi double-click tạo ra 2 sự kiện `click` trước sự kiện `dblclick`. Kết quả: popup mở rồi bị đóng ngay lập tức.

## Giải pháp
**File: `src/components/dictionary/DictionaryProvider.tsx`**

1. **Close-on-click handler** (line 150-156): Thêm check `dblClickRef.current` — nếu đang xử lý double-click thì bỏ qua, không đóng popup.

2. **Double-click handler** (line 160-180): Set `dblClickRef.current = true` **trước** setTimeout, và reset sau 300ms (đủ thời gian để bỏ qua các click events đi kèm).

Thay đổi cụ thể:

```typescript
// Close on outside click — skip if double-click in progress
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (dblClickRef.current) return;          // ← thêm dòng này
    if (popupRef.current?.contains(e.target as Node)) return;
    if (visible) close();
  };
  document.addEventListener("click", handler);
  return () => document.removeEventListener("click", handler);
}, [visible, close]);
```

Chỉ cần thêm 1 dòng check. Không thay đổi logic double-click hay mouseup.

