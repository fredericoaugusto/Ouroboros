// Krono Companion - Content Studio HUD (Injected on Study Sites: QConcursos, Caveira, TEC, Planalto, etc.)
(function () {
  if (window.__KRONO_STUDIO_INJECTED__) return;
  window.__KRONO_STUDIO_INJECTED__ = true;

  const COLORS = [
    { id: 'yellow', label: 'Amarelo', hex: '#facc15', rgba: 'rgba(250, 204, 21, 0.38)' },
    { id: 'green', label: 'Verde', hex: '#34d399', rgba: 'rgba(52, 211, 153, 0.38)' },
    { id: 'blue', label: 'Azul', hex: '#38bdf8', rgba: 'rgba(56, 189, 248, 0.38)' },
    { id: 'pink', label: 'Rosa', hex: '#f472b6', rgba: 'rgba(244, 114, 182, 0.38)' },
  ];

  const TAG_OPTIONS = [
    { id: 'bizu', label: '💡 Bizu / Comentário', badgeBg: '#065f46', badgeText: '#6ee7b7' },
    { id: 'pegadinha', label: '🚨 Pegadinha de Banca', badgeBg: '#7f1d1d', badgeText: '#fca5a5' },
    { id: 'juris', label: '⚖️ Questão / Jurisprudência', badgeBg: '#1e3a8a', badgeText: '#93c5fd' },
    { id: 'leiseca', label: '📜 Lei Seca Grifada', badgeBg: '#78350f', badgeText: '#fde68a' },
  ];

  const DEFAULT_STUDY_HOSTS = [
    'qconcursos.com',
    'tecconcursos.com.br',
    'caveira.com',
    'planalto.gov.br',
    'estrategiaconcursos.com.br',
    'grancursosonline.com.br',
    'aprovaconcursos.com.br',
    'pciconcursos.com.br',
    'jusbrasil.com.br',
    'dizerodireito.com.br',
    'stf.jus.br',
    'stj.jus.br',
    'senado.leg.br',
    'camara.leg.br',
  ];

  let appState = {
    serverUrl: 'http://localhost:3000',
    connected: false,
    hudVisible: true,
    hudMinimized: false,
    autoShowMode: 'study_sites',
    defaultStudyHosts: DEFAULT_STUDY_HOSTS,
    customAllowedHosts: [],
    customBlockedHosts: [],
    timer: {
      isActive: false,
      isPaused: false,
      mode: 'stopwatch',
      elapsedSeconds: 0,
      targetSeconds: 2700,
      subjectName: '',
      topicName: '',
      planFile: '',
      updatedAt: 0,
    },
    overrideTarget: {
      useOverride: false,
      planFile: '',
      subjectName: '',
      topicName: '',
    },
    plans: [],
  };

  let sessionClosedOnTab = false;
  let sessionForcedShowOnTab = false;
  let rafRedrawPending = false;

  let activeTool = 'select'; // 'select' | 'highlighter' | 'pen'
  let activeColor = COLORS[0];
  let strokes = [];
  let currentStroke = null;
  let pendingSelectedText = '';

  function hostMatchesList(hostname, list) {
    if (!hostname || !Array.isArray(list)) return false;
    const cleanHost = hostname.toLowerCase().replace(/^www\./, '');
    return list.some((entry) => {
      const domain = String(entry || '').toLowerCase().replace(/^www\./, '');
      if (!domain) return false;
      return cleanHost === domain || cleanHost.endsWith(`.${domain}`);
    });
  }

  function shouldShowHudHere() {
    if (sessionClosedOnTab) return false;
    if (sessionForcedShowOnTab) return true;
    if (!appState.hudVisible) return false;

    const host = window.location.hostname || '';
    if (hostMatchesList(host, appState.customBlockedHosts)) return false;
    if (hostMatchesList(host, appState.customAllowedHosts)) return true;

    const mode = appState.autoShowMode || 'study_sites';
    if (mode === 'manual') return false;
    if (mode === 'all_sites') return true;
    return hostMatchesList(host, appState.defaultStudyHosts || DEFAULT_STUDY_HOSTS);
  }

  // DOM Elements
  let canvasEl = null;
  let ctx = null;
  let hudEl = null;
  let timerDigitsEl = null;
  let timerBtnEl = null;
  let contextSubEl = null;
  let contextTopEl = null;
  let selectionPillEl = null;
  let cropOverlayEl = null;
  let cropBoxEl = null;
  let modalBackdropEl = null;
  let toastEl = null;
  let toastTimeout = null;

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    return [hrs, mins, rem].map((v) => String(v).padStart(2, '0')).join(':');
  }

  function getEffectiveTarget() {
    const ov = appState.overrideTarget || {};
    const tm = appState.timer || {};
    const firstPlan = appState.plans?.[0];
    const firstSub = firstPlan?.subjects?.[0];

    if (ov.useOverride && (ov.subjectName || ov.topicName)) {
      return {
        modeLabel: 'Manual',
        planFile: ov.planFile || tm.planFile || firstPlan?.fileName || '',
        subjectName: ov.subjectName || tm.subjectName || firstSub?.subject || 'Disciplina Geral',
        topicName: ov.topicName || tm.topicName || firstSub?.topics?.[0] || 'Tópico Geral',
      };
    }

    return {
      modeLabel: 'Ao Vivo',
      planFile: tm.planFile || ov.planFile || firstPlan?.fileName || '',
      subjectName: tm.subjectName || ov.subjectName || firstSub?.subject || 'Aguardando Estudo Ativo',
      topicName: tm.topicName || ov.topicName || firstSub?.topics?.[0] || 'Clique p/ escolher tópico',
    };
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg, isError = false) {
    if (!toastEl) return;
    toastEl.style.borderColor = isError ? '#ef4444' : '#10b981';
    toastEl.innerHTML = `<span>${isError ? '⚠️' : '✅'}</span> <span>${escapeHtml(msg)}</span>`;
    toastEl.classList.remove('krono-ext-hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.add('krono-ext-hidden');
    }, 3400);
  }

  // Gera HTML semântico 100% compatível com o editor TipTap do Krono (TopicNotesEditor)
  function buildSnippetHtml({ tagObj, quotedText, imageDataUrl, userComment }) {
    const nowStr = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const hostName = window.location.hostname.replace(/^www\./, '');
    const tag = tagObj || TAG_OPTIONS[0];

    let bodyParts = [];
    bodyParts.push(
      `<p><strong>${escapeHtml(tag.label)}</strong> • <em>🌐 ${escapeHtml(hostName)} • ${nowStr}</em></p>`
    );

    if (quotedText && quotedText.trim()) {
      const lines = quotedText
        .trim()
        .split(/\r?\n+/)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('');
      bodyParts.push(lines);
    }

    if (userComment && userComment.trim()) {
      const commentLines = userComment
        .trim()
        .split(/\r?\n+/)
        .map((line) => `<p><strong>💬 Nota:</strong> ${escapeHtml(line)}</p>`)
        .join('');
      bodyParts.push(commentLines);
    }

    let html = `<blockquote>${bodyParts.join('')}</blockquote>`;
    if (imageDataUrl) {
      html += `<p><img src="${imageDataUrl}" alt="Recorte Krono (${escapeHtml(hostName)})" /></p>`;
    }
    html += `<p></p>`;
    return html;
  }

  function computeLiveDisplaySeconds() {
    const tm = appState.timer || {};
    const isRunning = Boolean(tm.isActive && !tm.isPaused);
    let elapsed = Number(tm.elapsedSeconds) || 0;
    if (isRunning && tm.updatedAt > 0) {
      const deltaSec = Math.max(0, Math.floor((Date.now() - tm.updatedAt) / 1000));
      elapsed += Math.min(deltaSec, 3600);
    }
    if (tm.mode === 'countdown') {
      return Math.max(0, (Number(tm.targetSeconds) || 2700) - elapsed);
    }
    return elapsed;
  }

  function createElements() {
    // 1. Drawing Canvas Overlay
    canvasEl = document.createElement('canvas');
    canvasEl.id = 'krono-ext-drawing-canvas';
    document.documentElement.appendChild(canvasEl);
    ctx = canvasEl.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 2. Main Floating HUD Bar
    hudEl = document.createElement('div');
    hudEl.id = 'krono-ext-hud-root';
    document.documentElement.appendChild(hudEl);
    renderHudContent();
    setupHudDrag();

    // 3. Selection Pill
    selectionPillEl = document.createElement('div');
    selectionPillEl.id = 'krono-ext-selection-pill';
    selectionPillEl.className = 'krono-ext-hidden';
    selectionPillEl.innerHTML = `
      <button type="button" class="krono-ext-btn krono-ext-btn-note" data-action="clip-selection">
        📌 Enviar p/ Notas do Krono
      </button>
      <button type="button" class="krono-ext-btn" data-action="highlight-dom">
        🖍️ Grifar na Página
      </button>
    `;
    document.documentElement.appendChild(selectionPillEl);

    selectionPillEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      if (action === 'clip-selection' && pendingSelectedText) {
        selectionPillEl.classList.add('krono-ext-hidden');
        openSaveModal({ quotedText: pendingSelectedText, imageDataUrl: null });
      } else if (action === 'highlight-dom') {
        highlightCurrentDomSelection();
        selectionPillEl.classList.add('krono-ext-hidden');
      }
    });

    // 4. Crop Overlay
    cropOverlayEl = document.createElement('div');
    cropOverlayEl.id = 'krono-ext-crop-overlay';
    cropOverlayEl.className = 'krono-ext-hidden';
    cropOverlayEl.innerHTML = `
      <div class="krono-ext-crop-banner">
        ✂️ Arraste o mouse sobre a questão, comentário ou tabela para recortar e enviar ao Krono (ESC para cancelar)
      </div>
      <div id="krono-ext-crop-box" style="display:none;"></div>
    `;
    document.documentElement.appendChild(cropOverlayEl);
    cropBoxEl = cropOverlayEl.querySelector('#krono-ext-crop-box');
    setupCropInteractions();

    // 5. Modal Backdrop
    modalBackdropEl = document.createElement('div');
    modalBackdropEl.id = 'krono-ext-modal-backdrop';
    modalBackdropEl.className = 'krono-ext-hidden';
    document.documentElement.appendChild(modalBackdropEl);

    // 6. Toast
    toastEl = document.createElement('div');
    toastEl.id = 'krono-ext-toast';
    toastEl.className = 'krono-ext-hidden';
    document.documentElement.appendChild(toastEl);
  }

  function renderHudContent() {
    if (!hudEl) return;
    if (!shouldShowHudHere()) {
      hudEl.classList.add('krono-ext-hidden');
      selectionPillEl?.classList.add('krono-ext-hidden');
      return;
    }
    hudEl.classList.remove('krono-ext-hidden');

    const target = getEffectiveTarget();
    const isRunning = appState.timer.isActive && !appState.timer.isPaused;
    const displaySec = computeLiveDisplaySeconds();

    if (appState.hudMinimized) {
      hudEl.classList.add('krono-ext-minimized');
      hudEl.innerHTML = `
        <div class="krono-ext-drag-handle" title="Arrastar barra do Krono">
          <span class="krono-ext-brand-dot"></span>
          <span class="krono-ext-brand-title">Krono</span>
        </div>
        <span class="krono-ext-timer-digits ${!isRunning ? 'krono-ext-paused' : ''}">${formatTime(displaySec)}</span>
        <button type="button" class="krono-ext-btn" data-hud-cmd="expand" title="Expandir Estúdio Krono">
          ➕ Expandir
        </button>
        <button type="button" class="krono-ext-btn krono-ext-btn-close" data-hud-cmd="close-tab" title="Fechar barra nesta aba (clique no ícone 🧩 p/ reabrir)">
          ✕
        </button>
      `;
      bindHudEvents();
      return;
    }

    hudEl.classList.remove('krono-ext-minimized');
    hudEl.innerHTML = `
      <div class="krono-ext-drag-handle" title="Arraste para mover a barra pela tela">
        <span class="krono-ext-brand-dot"></span>
        <span class="krono-ext-brand-title">Krono</span>
      </div>

      <div class="krono-ext-timer-box" title="Cronômetro sincronizado ao vivo com o Krono">
        <span class="krono-ext-timer-digits ${!isRunning ? 'krono-ext-paused' : ''}" id="krono-ext-timer-digits">
          ${formatTime(displaySec)}
        </span>
        <button type="button" class="krono-ext-timer-btn" data-hud-cmd="toggle-timer" title="Iniciar / Pausar Cronômetro do Krono">
          ${isRunning ? '⏸' : '▶'}
        </button>
      </div>

      <button type="button" class="krono-ext-context-btn" data-hud-cmd="choose-topic" title="Clique para alterar a Disciplina ou Tópico de destino das Notas">
        <span class="krono-ext-context-sub" id="krono-ext-context-sub">
          ${target.modeLabel === 'Ao Vivo' ? '🟢 ' : '📌 '}${escapeHtml(target.subjectName)}
        </span>
        <span class="krono-ext-context-top" id="krono-ext-context-top">
          ${escapeHtml(target.topicName)}
        </span>
      </button>

      <div class="krono-ext-divider"></div>

      <button type="button" class="krono-ext-btn ${activeTool === 'select' ? 'krono-ext-active' : ''}" data-hud-cmd="tool-select" title="Modo Leitura e Seleção de Texto">
        👆 Ler
      </button>

      <button type="button" class="krono-ext-btn ${activeTool === 'highlighter' ? 'krono-ext-active' : ''}" data-hud-cmd="tool-highlighter" title="Marca-Texto Reto na página">
        🖍️ Grifo Reto
      </button>

      <button type="button" class="krono-ext-btn ${activeTool === 'pen' ? 'krono-ext-active' : ''}" data-hud-cmd="tool-pen" title="Caneta Livre para circular / anotar">
        🖊️ Caneta
      </button>

      <div class="krono-ext-colors">
        ${COLORS.map(
          (c) => `
          <span
            class="krono-ext-swatch ${activeColor.id === c.id ? 'krono-ext-swatch-active' : ''}"
            style="background:${c.hex};"
            data-color-id="${c.id}"
            title="Cor: ${c.label}"
          ></span>
        `
        ).join('')}
      </div>

      <button type="button" class="krono-ext-btn" data-hud-cmd="undo-stroke" title="Desfazer último traço">
        ↩️
      </button>
      <button type="button" class="krono-ext-btn" data-hud-cmd="clear-strokes" title="Limpar marcações da tela">
        🗑️
      </button>

      <div class="krono-ext-divider"></div>

      <button type="button" class="krono-ext-btn krono-ext-btn-crop" data-hud-cmd="start-crop" title="Recortar Print da Questão/Comentário para as Notas do Tópico (Atalho: Alt + S)">
        ✂️ Recortar Print
      </button>

      <button type="button" class="krono-ext-btn krono-ext-btn-note" data-hud-cmd="quick-note" title="Escrever Nota Rápida no Tópico Ativo">
        📝 +Nota
      </button>

      <button type="button" class="krono-ext-btn" data-hud-cmd="minimize" title="Minimizar barra para o canto">
        ➖
      </button>

      <button type="button" class="krono-ext-btn krono-ext-btn-close" data-hud-cmd="close-tab" title="Fechar barra nesta aba (reabra pelo ícone 🧩 do Krono)">
        ✕
      </button>
    `;

    timerDigitsEl = hudEl.querySelector('#krono-ext-timer-digits');
    contextSubEl = hudEl.querySelector('#krono-ext-context-sub');
    contextTopEl = hudEl.querySelector('#krono-ext-context-top');

    bindHudEvents();
  }

  function closeHudForCurrentTab(showHelperToast = true) {
    sessionClosedOnTab = true;
    sessionForcedShowOnTab = false;
    activeTool = 'select';
    if (canvasEl) canvasEl.classList.remove('krono-ext-canvas-interactive');
    selectionPillEl?.classList.add('krono-ext-hidden');
    cropOverlayEl?.classList.add('krono-ext-hidden');
    renderHudContent();
    if (showHelperToast) {
      showToast('Barra Krono fechada nesta aba. Clique no ícone 🧩 do Krono na barra do navegador para reabrir.');
    }
  }

  function bindHudEvents() {
    if (!hudEl) return;

    hudEl.querySelectorAll('[data-hud-cmd]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cmd = btn.getAttribute('data-hud-cmd');
        if (cmd === 'toggle-timer') {
          chrome.runtime.sendMessage({ type: 'KRONO_TOGGLE_TIMER' }, () => {
            void chrome.runtime.lastError;
          });
        } else if (cmd === 'choose-topic') {
          openSaveModal({ quotedText: '', imageDataUrl: null, modeOnlySelector: true });
        } else if (cmd === 'tool-select') {
          setTool('select');
        } else if (cmd === 'tool-highlighter') {
          setTool(activeTool === 'highlighter' ? 'select' : 'highlighter');
        } else if (cmd === 'tool-pen') {
          setTool(activeTool === 'pen' ? 'select' : 'pen');
        } else if (cmd === 'undo-stroke') {
          strokes.pop();
          redrawCanvas();
        } else if (cmd === 'clear-strokes') {
          strokes = [];
          redrawCanvas();
        } else if (cmd === 'start-crop') {
          startCropMode();
        } else if (cmd === 'quick-note') {
          openSaveModal({ quotedText: '', imageDataUrl: null });
        } else if (cmd === 'minimize') {
          appState.hudMinimized = true;
          chrome.runtime.sendMessage({ type: 'KRONO_SET_HUD_VISIBILITY', hudMinimized: true });
          renderHudContent();
        } else if (cmd === 'expand') {
          appState.hudMinimized = false;
          chrome.runtime.sendMessage({ type: 'KRONO_SET_HUD_VISIBILITY', hudMinimized: false });
          renderHudContent();
        } else if (cmd === 'close-tab') {
          closeHudForCurrentTab(true);
        }
      });
    });

    hudEl.querySelectorAll('[data-color-id]').forEach((sw) => {
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        const cid = sw.getAttribute('data-color-id');
        const found = COLORS.find((c) => c.id === cid);
        if (found) {
          activeColor = found;
          if (activeTool === 'select') setTool('highlighter');
          else renderHudContent();
        }
      });
    });
  }

  function setTool(tool) {
    activeTool = tool;
    if (canvasEl) {
      if (tool === 'highlighter' || tool === 'pen') {
        canvasEl.classList.add('krono-ext-canvas-interactive');
      } else {
        canvasEl.classList.remove('krono-ext-canvas-interactive');
      }
    }
    renderHudContent();
  }

  function setupHudDrag() {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    hudEl.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.krono-ext-drag-handle');
      if (!handle) return;
      isDragging = true;
      const rect = hudEl.getBoundingClientRect();
      hudEl.style.transform = 'none';
      hudEl.style.left = `${rect.left}px`;
      hudEl.style.top = `${rect.top}px`;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const nextLeft = Math.max(8, Math.min(window.innerWidth - 120, initialLeft + dx));
      const nextTop = Math.max(8, Math.min(window.innerHeight - 48, initialTop + dy));
      hudEl.style.left = `${nextLeft}px`;
      hudEl.style.top = `${nextTop}px`;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // Drawing Canvas Logic (Scroll-Anchored Straight Highlighter & Freehand Pen)
  function findUnderlyingElement(clientX, clientY) {
    if (!canvasEl) return null;
    const prev = canvasEl.style.pointerEvents;
    canvasEl.style.pointerEvents = 'none';
    const el = document.elementFromPoint(clientX, clientY);
    canvasEl.style.pointerEvents = prev;
    return el;
  }

  function findScrollableAncestor(el) {
    let node = el;
    while (node && node !== document.documentElement && node !== document.body) {
      try {
        const style = window.getComputedStyle(node);
        const canScrollY =
          node.scrollHeight > node.clientHeight + 2 && /(auto|scroll)/.test(style.overflowY);
        const canScrollX =
          node.scrollWidth > node.clientWidth + 2 && /(auto|scroll)/.test(style.overflowX);
        if (canScrollY || canScrollX) return node;
      } catch {
        break;
      }
      node = node.parentElement;
    }
    return null;
  }

  function getStrokeScrollDelta(s) {
    const curWinX = window.scrollX || document.documentElement.scrollLeft || 0;
    const curWinY = window.scrollY || document.documentElement.scrollTop || 0;
    const hasEl = s.scrollEl && s.scrollEl.isConnected;
    const curElX = hasEl ? s.scrollEl.scrollLeft : s.elX || 0;
    const curElY = hasEl ? s.scrollEl.scrollTop : s.elY || 0;
    return {
      dx: curWinX - (s.winX || 0) + (curElX - (s.elX || 0)),
      dy: curWinY - (s.winY || 0) + (curElY - (s.elY || 0)),
    };
  }

  function scheduleRedraw() {
    if (rafRedrawPending) return;
    rafRedrawPending = true;
    requestAnimationFrame(() => {
      rafRedrawPending = false;
      redrawCanvas();
    });
  }

  function resizeCanvas() {
    if (!canvasEl) return;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = window.innerWidth * dpr;
    canvasEl.height = window.innerHeight * dpr;
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    redrawCanvas();
  }

  function redrawCanvas() {
    if (!ctx || !canvasEl) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const all = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const s of all) {
      if (!s.points || s.points.length === 0) continue;
      const { dx, dy } = getStrokeScrollDelta(s);
      ctx.save();
      ctx.beginPath();
      if (s.tool === 'highlighter') {
        ctx.strokeStyle = s.color.rgba;
        ctx.lineWidth = 20;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
      } else {
        ctx.strokeStyle = s.color.hex;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      ctx.moveTo(s.points[0].x - dx, s.points[0].y - dy);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x - dx, s.points[i].y - dy);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  window.addEventListener('scroll', scheduleRedraw, { passive: true, capture: true });

  window.addEventListener(
    'wheel',
    (e) => {
      if (e.target !== canvasEl) return;
      if (activeTool !== 'highlighter' && activeTool !== 'pen') return;
      const under = findUnderlyingElement(e.clientX, e.clientY);
      const scrollEl = findScrollableAncestor(under);
      if (scrollEl) {
        scrollEl.scrollTop += e.deltaY;
        scrollEl.scrollLeft += e.deltaX;
        scheduleRedraw();
      }
    },
    { passive: true }
  );

  window.addEventListener('mousedown', (e) => {
    if (e.target !== canvasEl) return;
    if (activeTool !== 'highlighter' && activeTool !== 'pen') return;
    if (
      e.clientX >= document.documentElement.clientWidth ||
      e.clientY >= document.documentElement.clientHeight
    ) {
      return;
    }
    const under = findUnderlyingElement(e.clientX, e.clientY);
    const scrollEl = findScrollableAncestor(under);
    currentStroke = {
      tool: activeTool,
      color: activeColor,
      winX: window.scrollX || document.documentElement.scrollLeft || 0,
      winY: window.scrollY || document.documentElement.scrollTop || 0,
      scrollEl,
      elX: scrollEl ? scrollEl.scrollLeft : 0,
      elY: scrollEl ? scrollEl.scrollTop : 0,
      points: [{ x: e.clientX, y: e.clientY }],
    };
    redrawCanvas();
  });

  window.addEventListener('mousemove', (e) => {
    if (!currentStroke) return;
    const { dx, dy } = getStrokeScrollDelta(currentStroke);
    const adjX = e.clientX + dx;
    const adjY = e.clientY + dy;
    if (currentStroke.tool === 'highlighter') {
      // Straight horizontal line by default (like Bússola straight highlighter!)
      const startPt = currentStroke.points[0];
      currentStroke.points = [startPt, { x: adjX, y: startPt.y }];
    } else {
      currentStroke.points.push({ x: adjX, y: adjY });
    }
    redrawCanvas();
  });

  window.addEventListener('mouseup', () => {
    if (!currentStroke) return;
    strokes.push(currentStroke);
    currentStroke = null;
    redrawCanvas();
  });

  // Text Selection Popover Logic
  document.addEventListener('mouseup', (e) => {
    if (
      hudEl?.contains(e.target) ||
      selectionPillEl?.contains(e.target) ||
      modalBackdropEl?.contains(e.target) ||
      cropOverlayEl?.contains(e.target)
    ) {
      return;
    }

    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (!text || text.length < 3 || activeTool !== 'select' || !shouldShowHudHere()) {
        selectionPillEl?.classList.add('krono-ext-hidden');
        return;
      }

      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        pendingSelectedText = text;
        const top = Math.max(10, rect.top - 44);
        const left = Math.max(10, Math.min(window.innerWidth - 290, rect.left));
        selectionPillEl.style.top = `${top}px`;
        selectionPillEl.style.left = `${left}px`;
        selectionPillEl.classList.remove('krono-ext-hidden');
      } catch {
        selectionPillEl?.classList.add('krono-ext-hidden');
      }
    }, 20);
  });

  function highlightCurrentDomSelection() {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (range.startContainer === range.endContainer) {
        const mark = document.createElement('mark');
        mark.className = 'krono-ext-dom-highlight';
        mark.style.backgroundColor = activeColor.rgba;
        range.surroundContents(mark);
      } else {
        // Multi-node DOM selection: highlight text nodes cleanly via TreeWalker
        const root = range.commonAncestorContainer;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) =>
            node.nodeValue && node.nodeValue.trim() && range.intersectsNode(node)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT,
        });
        const nodes = [];
        let curr;
        while ((curr = walker.nextNode())) nodes.push(curr);
        nodes.forEach((textNode) => {
          const subRange = document.createRange();
          subRange.selectNodeContents(textNode);
          if (textNode === range.startContainer) subRange.setStart(textNode, range.startOffset);
          if (textNode === range.endContainer) subRange.setEnd(textNode, range.endOffset);
          if (subRange.toString().length > 0) {
            const mark = document.createElement('mark');
            mark.className = 'krono-ext-dom-highlight';
            mark.style.backgroundColor = activeColor.rgba;
            subRange.surroundContents(mark);
          }
        });
      }
      sel.removeAllRanges();
    } catch {
      if (pendingSelectedText) {
        openSaveModal({ quotedText: pendingSelectedText, imageDataUrl: null });
      }
    }
  }

  // Screenshot Crop Logic
  function startCropMode() {
    if (!cropOverlayEl) return;
    selectionPillEl?.classList.add('krono-ext-hidden');
    cropBoxEl.style.display = 'none';
    cropOverlayEl.classList.remove('krono-ext-hidden');
  }

  function setupCropInteractions() {
    let isCropping = false;
    let startX = 0;
    let startY = 0;

    cropOverlayEl.addEventListener('mousedown', (e) => {
      isCropping = true;
      startX = e.clientX;
      startY = e.clientY;
      cropBoxEl.style.left = `${startX}px`;
      cropBoxEl.style.top = `${startY}px`;
      cropBoxEl.style.width = '0px';
      cropBoxEl.style.height = '0px';
      cropBoxEl.style.display = 'block';
    });

    cropOverlayEl.addEventListener('mousemove', (e) => {
      if (!isCropping) return;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      cropBoxEl.style.left = `${x}px`;
      cropBoxEl.style.top = `${y}px`;
      cropBoxEl.style.width = `${w}px`;
      cropBoxEl.style.height = `${h}px`;
    });

    cropOverlayEl.addEventListener('mouseup', (e) => {
      if (!isCropping) return;
      isCropping = false;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);

      cropOverlayEl.classList.add('krono-ext-hidden');
      if (w < 16 || h < 16) return;

      // Temporarily hide HUD so it never appears inside the screenshot crop
      const wasHudVisible = !hudEl.classList.contains('krono-ext-hidden');
      if (wasHudVisible) hudEl.classList.add('krono-ext-hidden');

      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'KRONO_CAPTURE_VISIBLE_TAB' }, (res) => {
          if (wasHudVisible && shouldShowHudHere()) {
            hudEl.classList.remove('krono-ext-hidden');
          }
          if (!res || !res.ok || !res.dataUrl) {
            showToast(res?.error || 'Erro ao capturar print da aba.', true);
            return;
          }

          const img = new Image();
          img.onload = () => {
            const scaleX = img.naturalWidth / window.innerWidth;
            const scaleY = img.naturalHeight / window.innerHeight;
            const offCanvas = document.createElement('canvas');
            offCanvas.width = Math.round(w * scaleX);
            offCanvas.height = Math.round(h * scaleY);
            const offCtx = offCanvas.getContext('2d');
            offCtx.drawImage(
              img,
              Math.round(x * scaleX),
              Math.round(y * scaleY),
              Math.round(w * scaleX),
              Math.round(h * scaleY),
              0,
              0,
              offCanvas.width,
              offCanvas.height
            );
            const croppedDataUrl = offCanvas.toDataURL('image/png');
            openSaveModal({ quotedText: '', imageDataUrl: croppedDataUrl });
          };
          img.src = res.dataUrl;
        });
      }, 80);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cropOverlayEl?.classList.add('krono-ext-hidden');
        modalBackdropEl?.classList.add('krono-ext-hidden');
        if (activeTool !== 'select') setTool('select');
      }
      if (shouldShowHudHere() && e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        startCropMode();
      }
    });
  }

  // Save Clip / Target Topic Selector Modal
  function openSaveModal({ quotedText = '', imageDataUrl = null, modeOnlySelector = false }) {
    if (!modalBackdropEl) return;

    // Refresh context first if plans are empty
    chrome.runtime.sendMessage({ type: 'KRONO_GET_STATE' }, (res) => {
      if (res && res.ok && res.state) {
        appState = { ...appState, ...res.state };
      }
      renderModalInner({ quotedText, imageDataUrl, modeOnlySelector });
    });
  }

  function renderModalInner({ quotedText, imageDataUrl, modeOnlySelector }) {
    const eff = getEffectiveTarget();
    let selectedTag = TAG_OPTIONS[0];
    let useOverride = Boolean(appState.overrideTarget?.useOverride);
    let selectedPlanFile = eff.planFile || appState.plans?.[0]?.fileName || '';
    let selectedSubjectName = eff.subjectName || '';
    let selectedTopicName = eff.topicName || '';

    const getPlanObj = (pFile) =>
      (appState.plans || []).find((p) => p.fileName === pFile) || appState.plans?.[0] || null;

    const getSubjectsForPlan = (pFile) => {
      const p = getPlanObj(pFile);
      return p && Array.isArray(p.subjects) ? p.subjects : [];
    };

    const getTopicsForSubject = (pFile, sName) => {
      const subs = getSubjectsForPlan(pFile);
      const found =
        subs.find((s) => s.subject === sName || s.id === sName) || subs[0] || null;
      return found && Array.isArray(found.topics) ? found.topics : [];
    };

    modalBackdropEl.classList.remove('krono-ext-hidden');
    modalBackdropEl.innerHTML = `
      <div class="krono-ext-modal">
        <div class="krono-ext-modal-header">
          <div class="krono-ext-modal-title">
            <span>🧭</span>
            <span>${
              modeOnlySelector
                ? 'Configurar Destino das Notas no Krono'
                : imageDataUrl
                ? 'Salvar Recorte de Print nas Notas do Krono'
                : 'Enviar Anotação / Grifo para o Krono'
            }</span>
          </div>
          <button type="button" class="krono-ext-btn" id="krono-modal-close">✕</button>
        </div>

        <div class="krono-ext-modal-body">
          <div>
            <label class="krono-ext-field-label">Modo de Sincronização de Destino</label>
            <div class="krono-ext-tags-row">
              <button type="button" class="krono-ext-tag-chip ${!useOverride ? 'krono-ext-tag-selected' : ''}" id="krono-mode-auto">
                🟢 Seguir Estudo / Cronômetro Ativo no Krono
              </button>
              <button type="button" class="krono-ext-tag-chip ${useOverride ? 'krono-ext-tag-selected' : ''}" id="krono-mode-manual">
                📌 Escolher Disciplina e Tópico Manualmente
              </button>
            </div>
          </div>

          <div id="krono-target-selectors" style="display:grid;grid-template-columns:1fr;gap:8px;">
            <div>
              <label class="krono-ext-field-label">Plano de Estudos</label>
              <select class="krono-ext-select" id="krono-select-plan"></select>
            </div>
            <div>
              <label class="krono-ext-field-label">Disciplina</label>
              <select class="krono-ext-select" id="krono-select-subject"></select>
            </div>
            <div>
              <label class="krono-ext-field-label">Tópico do Edital Verticalizado (Destino da Nota)</label>
              <select class="krono-ext-select" id="krono-select-topic"></select>
            </div>
          </div>

          ${
            !modeOnlySelector
              ? `
            <div>
              <label class="krono-ext-field-label">Etiqueta do Registro</label>
              <div class="krono-ext-tags-row" id="krono-tags-container">
                ${TAG_OPTIONS.map(
                  (t, idx) => `
                  <button type="button" class="krono-ext-tag-chip ${idx === 0 ? 'krono-ext-tag-selected' : ''}" data-tag-id="${t.id}">
                    ${t.label}
                  </button>
                `
                ).join('')}
              </div>
            </div>

            ${
              imageDataUrl
                ? `
              <div>
                <label class="krono-ext-field-label">Pré-visualização do Recorte</label>
                <div class="krono-ext-preview-img-wrap">
                  <img src="${imageDataUrl}" alt="Preview Recorte" />
                </div>
              </div>
            `
                : ''
            }

            ${
              quotedText
                ? `
              <div>
                <label class="krono-ext-field-label">Trecho Capturado da Página</label>
                <textarea class="krono-ext-textarea" id="krono-input-quoted" rows="3">${escapeHtml(quotedText)}</textarea>
              </div>
            `
                : ''
            }

            <div>
              <label class="krono-ext-field-label">Seu Comentário / Observação (Opcional)</label>
              <textarea class="krono-ext-textarea" id="krono-input-comment" rows="3" placeholder="Ex: Atenção ao prazo de 30 dias previsto no § 2º..."></textarea>
            </div>
          `
              : ''
          }
        </div>

        <div class="krono-ext-modal-footer">
          <button type="button" class="krono-ext-btn" id="krono-modal-cancel">Cancelar</button>
          <button type="button" class="krono-ext-btn-primary" id="krono-modal-submit">
            ${modeOnlySelector ? '✅ Confirmar Tópico Ativo' : '📌 Salvar nas Notas do Tópico'}
          </button>
        </div>
      </div>
    `;

    const planSel = modalBackdropEl.querySelector('#krono-select-plan');
    const subSel = modalBackdropEl.querySelector('#krono-select-subject');
    const topSel = modalBackdropEl.querySelector('#krono-select-topic');
    const btnAuto = modalBackdropEl.querySelector('#krono-mode-auto');
    const btnManual = modalBackdropEl.querySelector('#krono-mode-manual');

    function populatePlans() {
      const plans = appState.plans || [];
      if (plans.length === 0) {
        planSel.innerHTML = `<option value="">Abra a aba do Krono p/ sincronizar seus planos</option>`;
        return;
      }
      planSel.innerHTML = plans
        .map(
          (p) =>
            `<option value="${escapeHtml(p.fileName)}" ${p.fileName === selectedPlanFile ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
        )
        .join('');
      selectedPlanFile = planSel.value;
      populateSubjects();
    }

    function populateSubjects() {
      const subs = getSubjectsForPlan(selectedPlanFile);
      if (subs.length === 0) {
        subSel.innerHTML = `<option value="${escapeHtml(selectedSubjectName)}">${escapeHtml(selectedSubjectName || 'Sem disciplinas')}</option>`;
        return;
      }
      subSel.innerHTML = subs
        .map(
          (s) =>
            `<option value="${escapeHtml(s.subject)}" ${s.subject === selectedSubjectName ? 'selected' : ''}>${escapeHtml(s.subject)}</option>`
        )
        .join('');
      selectedSubjectName = subSel.value;
      populateTopics();
    }

    function populateTopics() {
      const tops = getTopicsForSubject(selectedPlanFile, selectedSubjectName);
      if (tops.length === 0) {
        topSel.innerHTML = `<option value="${escapeHtml(selectedTopicName)}">${escapeHtml(selectedTopicName || 'Tópico Geral')}</option>`;
        return;
      }
      topSel.innerHTML = tops
        .map(
          (t) =>
            `<option value="${escapeHtml(t)}" ${t === selectedTopicName ? 'selected' : ''}>${escapeHtml(t)}</option>`
        )
        .join('');
      selectedTopicName = topSel.value;
    }

    populatePlans();

    planSel.addEventListener('change', () => {
      useOverride = true;
      btnManual.classList.add('krono-ext-tag-selected');
      btnAuto.classList.remove('krono-ext-tag-selected');
      selectedPlanFile = planSel.value;
      populateSubjects();
    });

    subSel.addEventListener('change', () => {
      useOverride = true;
      btnManual.classList.add('krono-ext-tag-selected');
      btnAuto.classList.remove('krono-ext-tag-selected');
      selectedSubjectName = subSel.value;
      populateTopics();
    });

    topSel.addEventListener('change', () => {
      useOverride = true;
      btnManual.classList.add('krono-ext-tag-selected');
      btnAuto.classList.remove('krono-ext-tag-selected');
      selectedTopicName = topSel.value;
    });

    btnAuto.addEventListener('click', () => {
      useOverride = false;
      btnAuto.classList.add('krono-ext-tag-selected');
      btnManual.classList.remove('krono-ext-tag-selected');
      if (appState.timer.subjectName) selectedSubjectName = appState.timer.subjectName;
      if (appState.timer.topicName) selectedTopicName = appState.timer.topicName;
      populatePlans();
    });

    btnManual.addEventListener('click', () => {
      useOverride = true;
      btnManual.classList.add('krono-ext-tag-selected');
      btnAuto.classList.remove('krono-ext-tag-selected');
    });

    modalBackdropEl.querySelectorAll('[data-tag-id]').forEach((chip) => {
      chip.addEventListener('click', () => {
        modalBackdropEl
          .querySelectorAll('[data-tag-id]')
          .forEach((c) => c.classList.remove('krono-ext-tag-selected'));
        chip.classList.add('krono-ext-tag-selected');
        const tid = chip.getAttribute('data-tag-id');
        selectedTag = TAG_OPTIONS.find((t) => t.id === tid) || TAG_OPTIONS[0];
      });
    });

    const closeModal = () => modalBackdropEl.classList.add('krono-ext-hidden');
    modalBackdropEl.querySelector('#krono-modal-close').addEventListener('click', closeModal);
    modalBackdropEl.querySelector('#krono-modal-cancel').addEventListener('click', closeModal);

    modalBackdropEl.querySelector('#krono-modal-submit').addEventListener('click', () => {
      const finalPlan = planSel.value || selectedPlanFile;
      const finalSub = subSel.value || selectedSubjectName;
      const finalTop = topSel.value || selectedTopicName;

      chrome.runtime.sendMessage(
        {
          type: 'KRONO_SET_TARGET_OVERRIDE',
          useOverride,
          planFile: finalPlan,
          subjectName: finalSub,
          topicName: finalTop,
        },
        (res) => {
          if (res?.state) appState = { ...appState, ...res.state };
          renderHudContent();
        }
      );

      if (modeOnlySelector) {
        closeModal();
        showToast(`Destino atualizado: ${finalSub} • ${finalTop}`);
        return;
      }

      const editedQuoted = modalBackdropEl.querySelector('#krono-input-quoted')?.value || quotedText;
      const commentVal = modalBackdropEl.querySelector('#krono-input-comment')?.value || '';

      if (!editedQuoted && !imageDataUrl && !commentVal.trim()) {
        showToast('Escreva uma anotação ou selecione um trecho antes de salvar.', true);
        return;
      }

      const htmlSnippet = buildSnippetHtml({
        tagObj: selectedTag,
        quotedText: editedQuoted,
        imageDataUrl,
        userComment: commentVal,
      });

      const submitBtn = modalBackdropEl.querySelector('#krono-modal-submit');
      submitBtn.textContent = '⏳ Salvando no Krono...';
      submitBtn.disabled = true;

      chrome.runtime.sendMessage(
        {
          type: 'KRONO_SAVE_CLIP',
          planFile: finalPlan,
          subjectName: finalSub,
          topicName: finalTop,
          htmlSnippet,
        },
        (res) => {
          closeModal();
          if (res && res.ok) {
            showToast(`Salvo nas notas de: ${res.subjectName} → ${res.topicName}`);
          } else {
            showToast(res?.error || 'Falha ao salvar nota no Krono.', true);
          }
        }
      );
    });
  }

  // Listen for live state updates from background.js
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === 'KRONO_STATE_BROADCAST' && message.state) {
      const prevMin = appState.hudMinimized;
      const prevShow = shouldShowHudHere();
      appState = { ...appState, ...message.state };
      const nextShow = shouldShowHudHere();

      if (prevMin !== appState.hudMinimized || prevShow !== nextShow) {
        renderHudContent();
      } else {
        updateHudLiveValues();
      }
      sendResponse({ ok: true, hudShowing: nextShow });
      return true;
    }

    if (message.type === 'KRONO_QUERY_TAB_HUD_STATUS') {
      sendResponse({ ok: true, hudShowing: shouldShowHudHere() });
      return true;
    }

    if (message.type === 'KRONO_START_CROP_FROM_POPUP') {
      sessionForcedShowOnTab = true;
      sessionClosedOnTab = false;
      renderHudContent();
      startCropMode();
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'KRONO_OPEN_QUICK_NOTE_FROM_POPUP') {
      sessionForcedShowOnTab = true;
      sessionClosedOnTab = false;
      renderHudContent();
      openSaveModal({ quotedText: '', imageDataUrl: null });
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'KRONO_SHOW_HUD_FROM_POPUP') {
      sessionForcedShowOnTab = true;
      sessionClosedOnTab = false;
      appState.hudVisible = true;
      appState.hudMinimized = false;
      renderHudContent();
      sendResponse({ ok: true, hudShowing: true });
      return true;
    }

    if (message.type === 'KRONO_HIDE_HUD_FROM_POPUP') {
      closeHudForCurrentTab(false);
      sendResponse({ ok: true, hudShowing: false });
      return true;
    }

    return false;
  });

  function updateHudLiveValues() {
    if (!hudEl) return;
    if (!shouldShowHudHere()) {
      hudEl.classList.add('krono-ext-hidden');
      return;
    }
    hudEl.classList.remove('krono-ext-hidden');

    const isRunning = appState.timer.isActive && !appState.timer.isPaused;
    const displaySec = computeLiveDisplaySeconds();

    const digits = hudEl.querySelector('.krono-ext-timer-digits');
    if (digits) {
      digits.textContent = formatTime(displaySec);
      digits.classList.toggle('krono-ext-paused', !isRunning);
    }

    const playBtn = hudEl.querySelector('[data-hud-cmd="toggle-timer"]');
    if (playBtn) {
      playBtn.textContent = isRunning ? '⏸' : '▶';
    }

    const target = getEffectiveTarget();
    if (contextSubEl) {
      contextSubEl.textContent = `${target.modeLabel === 'Ao Vivo' ? '🟢 ' : '📌 '}${target.subjectName}`;
    }
    if (contextTopEl) {
      contextTopEl.textContent = target.topicName;
    }
  }

  // Initialize HUD & smooth local stopwatch interpolation (even when Krono tab is throttled in background)
  createElements();
  chrome.runtime.sendMessage({ type: 'KRONO_GET_STATE' }, (res) => {
    if (res && res.ok && res.state) {
      appState = { ...appState, ...res.state };
      renderHudContent();
    }
  });
  setInterval(() => {
    if (appState.timer?.isActive && !appState.timer?.isPaused) {
      updateHudLiveValues();
    }
  }, 500);
})();
