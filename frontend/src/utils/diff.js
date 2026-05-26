// Simple LCS-based word diff
export function computeWordDiff(baseStr, newStr) {
  const baseWords = baseStr.split(/([\s.,:;!?]+)/).filter(Boolean);
  const newWords = newStr.split(/([\s.,:;!?]+)/).filter(Boolean);
  
  // Create matrix
  const m = baseWords.length;
  const n = newWords.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (baseWords[i - 1].toLowerCase() === newWords[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find LCS
  let i = m, j = n;
  const lcs = [];
  while (i > 0 && j > 0) {
    if (baseWords[i - 1].toLowerCase() === newWords[j - 1].toLowerCase()) {
      lcs.unshift(newWords[j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  // Build diff from LCS
  const result = [];
  let lcsIdx = 0;
  
  for (let idx = 0; idx < newWords.length; idx++) {
    const word = newWords[idx];
    if (lcsIdx < lcs.length && word.toLowerCase() === lcs[lcsIdx].toLowerCase()) {
      result.push({ text: word, type: 'same' });
      lcsIdx++;
    } else {
      const isPunctuation = /^[\\s.,:;!?]+$/.test(word);
      result.push({ text: word, type: isPunctuation ? 'same' : 'diff' });
    }
  }
  
  return result;
}
