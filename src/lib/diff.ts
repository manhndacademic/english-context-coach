/**
 * Character-level diff utility using Myers LCS algorithm.
 * Used for GitHub-style inline diffs in grammar correction views.
 */

export type DiffSpan = {
  type: "equal" | "delete" | "insert";
  text: string;
};

/**
 * Compute a character-level diff between two strings using a simple LCS approach.
 * Returns an array of DiffSpan objects describing equal, deleted, and inserted segments.
 *
 * If corrected is null/undefined or equals original, returns a single "equal" span.
 */
export function computeCharDiff(
  original: string,
  corrected: string | null | undefined
): DiffSpan[] {
  if (!corrected || corrected === original) {
    return [{ type: "equal", text: original }];
  }

  const a = original;
  const b = corrected;

  // Build LCS table
  const m = a.length;
  const n = b.length;

  // Use 1D rolling array for memory efficiency
  const dp: number[] = new Array(n + 1).fill(0);
  const prev: number[] = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    const temp = [...dp];
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev[j - 1] + 1;
      } else {
        dp[j] = Math.max(dp[j - 1], prev[j]);
      }
    }
    for (let j = 0; j <= n; j++) prev[j] = temp[j];
  }

  // Rebuild LCS via full table for traceback
  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  // Traceback to build raw diff operations
  const ops: Array<{ type: "equal" | "delete" | "insert"; char: string }> = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: "equal", char: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      ops.push({ type: "insert", char: b[j - 1] });
      j--;
    } else {
      ops.push({ type: "delete", char: a[i - 1] });
      i--;
    }
  }

  ops.reverse();

  // Merge consecutive ops of the same type into spans
  const spans: DiffSpan[] = [];
  for (const op of ops) {
    const last = spans[spans.length - 1];
    if (last && last.type === op.type) {
      last.text += op.char;
    } else {
      spans.push({ type: op.type, text: op.char });
    }
  }

  return spans;
}

/**
 * Returns true if all spans are "equal" (i.e. no difference found).
 */
export function isNoDiff(spans: DiffSpan[]): boolean {
  return spans.every((s) => s.type === "equal");
}
