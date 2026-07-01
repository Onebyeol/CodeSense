// =============================================
//  CodeSense — app.js
// =============================================

// ── 분석 모드별 프롬프트 ──
const PROMPTS = {
  line: (code, lang) => `다음 ${lang} 코드를 한 줄씩 한국어로 설명해주세요.
각 줄 번호를 앞에 붙여서 "N번째 줄: 설명" 형식으로 작성하고,
연속된 줄이 하나의 개념이면 묶어서 설명해도 됩니다.
전문 용어는 쉬운 말로 풀어서 초보자도 이해할 수 있게 설명해주세요.

코드:
\`\`\`
${code}
\`\`\``,

  summary: (code, lang) => `다음 ${lang} 코드 전체가 어떤 일을 하는지 한국어로 요약해주세요.
전문 용어는 최대한 쉬운 말로 풀어서 설명하고,
코드의 목적, 동작 방식, 결과를 포함해주세요.

코드:
\`\`\`
${code}
\`\`\``,

  bug: (code, lang) => `다음 ${lang} 코드에서 버그, 오류 가능성, 개선할 수 있는 부분을 찾아 한국어로 알려주세요.
각 항목에 번호를 매기고, 문제점과 해결 방법을 함께 설명해주세요.
심각도(높음/중간/낮음)도 함께 표시해주세요.

코드:
\`\`\`
${code}
\`\`\``,

  complexity: (code, lang) => `다음 ${lang} 코드의 시간복잡도와 공간복잡도를 분석해주세요.
Big-O 표기법으로 표시하고, 왜 그런 복잡도가 나오는지 쉬운 말로 설명해주세요.
더 효율적으로 개선할 수 있는 방법도 있으면 알려주세요.

코드:
\`\`\`
${code}
\`\`\``
};

// ── 상태 ──
let activeMode = 'line';

// ── DOM 요소 ──
const codeInput  = document.getElementById('code-input');
const lineNums   = document.getElementById('line-nums');
const layout     = document.getElementById('layout');
const resultBody = document.getElementById('result-body');
const resultText = document.getElementById('result-text');
const resultEmpty = document.getElementById('result-empty');
const btnAnalyze = document.getElementById('btn-analyze');
const btnTheme   = document.getElementById('btn-theme');
const toast      = document.getElementById('toast');

// =============================================
//  탭 전환
// =============================================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeMode = tab.dataset.mode;
  });
});

// =============================================
//  줄 번호 업데이트
// =============================================
function updateLineNums() {
  const count = codeInput.value.split('\n').length;
  lineNums.innerHTML = Array.from({ length: count }, (_, i) =>
    `<span class="line-num">${i + 1}</span>`
  ).join('');
}

codeInput.addEventListener('input', updateLineNums);
codeInput.addEventListener('scroll', () => {
  lineNums.scrollTop = codeInput.scrollTop;
});
codeInput.addEventListener('keydown', e => {
  // Tab → 2칸 들여쓰기
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = codeInput.selectionStart;
    codeInput.value = codeInput.value.slice(0, s) + '  ' + codeInput.value.slice(codeInput.selectionEnd);
    codeInput.selectionStart = codeInput.selectionEnd = s + 2;
    updateLineNums();
  }
  // Ctrl/Cmd + Enter → 분석
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    analyze();
  }
});

// =============================================
//  결과 패널 열기 / 닫기
// =============================================
function openResult() {
  layout.classList.add('expanded');
}

function closeResult() {
  layout.classList.remove('expanded');
}

// =============================================
//  분석 실행 (Vercel 서버 경유)
// =============================================
async function analyze() {
  const code = codeInput.value.trim();
  if (!code) {
    showToast('코드를 먼저 입력해주세요');
    return;
  }

  const lang = document.getElementById('lang-select').value === 'auto'
    ? '(언어 자동 감지)'
    : document.getElementById('lang-select').value;

  // 버튼 로딩 상태
  btnAnalyze.innerHTML = '<span class="loading-dot"></span> 분석 중...';
  btnAnalyze.disabled = true;

  // 결과창 초기화
  openResult();
  resultEmpty.style.display = 'none';
  resultText.style.display = 'block';
  resultText.textContent = '';

  try {
    // API 키는 서버(/api/analyze)에서 처리 — 클라이언트에 노출되지 않음
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: PROMPTS[activeMode](code, lang) })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `오류 코드: ${response.status}`);
    }

    // Gemini SSE 스트리밍 수신
    const reader  = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            resultText.textContent += text;
            resultBody.scrollTop = resultBody.scrollHeight;
          }
        } catch {
          // JSON 파싱 실패 무시
        }
      }
    }

  } catch (err) {
    resultText.textContent = `❌ 오류가 발생했습니다.\n\n${err.message}`;
  } finally {
    btnAnalyze.innerHTML = '<span>▷</span> 분석 시작';
    btnAnalyze.disabled = false;
  }
}

// =============================================
//  결과 복사
// =============================================
function copyResult() {
  const text = resultText.textContent;
  if (!text) {
    showToast('복사할 결과가 없습니다');
    return;
  }
  navigator.clipboard.writeText(text).then(() => showToast('복사되었습니다 ✓'));
}

// =============================================
//  다크 / 라이트 모드 토글
// =============================================
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  btnTheme.textContent = isLight ? '다크 모드' : '라이트 모드';
  localStorage.setItem('cs_theme', isLight ? 'light' : 'dark');
}

// 저장된 테마 복원
(function restoreTheme() {
  if (localStorage.getItem('cs_theme') === 'light') {
    document.documentElement.classList.add('light');
    btnTheme.textContent = '다크 모드';
  }
})();

// =============================================
//  토스트 알림
// =============================================
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}
