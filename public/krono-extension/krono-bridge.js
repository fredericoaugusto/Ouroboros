// Krono Companion - Content Script Bridge (Runs on Krono App Tab)
(function () {
  if (window.__KRONO_BRIDGE_ACTIVE__) return;
  window.__KRONO_BRIDGE_ACTIVE__ = true;

  const GLOBAL_TIMER_KEY = 'krono_global_timer_v1';
  const COCKPIT_CONTEXT_KEY = 'krono_active_cockpit_context';

  // Mark DOM so the Krono UI (ExtensionGuideModal) detects the extension immediately
  document.documentElement.setAttribute('data-krono-extension-installed', 'true');
  window.dispatchEvent(new CustomEvent('krono:extension-installed', { detail: { version: '1.0.0' } }));

  let cachedContext = {
    pairingToken: '',
    username: '',
    plans: [],
  };

  async function fetchKronoContext() {
    try {
      const res = await fetch(`${window.location.origin}/api/extension/context`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.connected) {
        cachedContext = {
          pairingToken: data.pairingToken || '',
          username: data.username || '',
          plans: Array.isArray(data.plans) ? data.plans : [],
        };
        if (cachedContext.pairingToken) {
          try {
            localStorage.setItem('krono_ext_pairing_token', cachedContext.pairingToken);
          } catch {}
        }
        syncLiveStateToExtension(true);
      }
    } catch {
      // ignore if user not logged in yet
    }
  }

  function readTimerSnapshot() {
    let rawTimer = null;
    try {
      const str = localStorage.getItem(GLOBAL_TIMER_KEY);
      if (str) rawTimer = JSON.parse(str);
    } catch {}

    let cockpitCtx = null;
    try {
      const str = localStorage.getItem(COCKPIT_CONTEXT_KEY);
      if (str) cockpitCtx = JSON.parse(str);
    } catch {}

    let selectedPlan = '';
    try {
      selectedPlan = localStorage.getItem('selectedDataFile') || '';
    } catch {}

    const footerEl = document.querySelector('[data-krono-timer-seconds]');
    let isActive = Boolean(rawTimer?.isActive);
    let isPaused = Boolean(rawTimer?.isPaused);
    let mode = rawTimer?.mode || 'stopwatch';
    let targetSeconds = Number(rawTimer?.targetSeconds) || 2700;
    let elapsedSeconds = Number(rawTimer?.elapsedSeconds) || 0;

    if (footerEl) {
      const domSec = Number(footerEl.getAttribute('data-krono-timer-seconds'));
      if (!Number.isNaN(domSec) && domSec >= 0) {
        elapsedSeconds = domSec;
      }
      const domRunning = footerEl.getAttribute('data-krono-timer-running');
      if (domRunning === 'true') {
        isActive = true;
        isPaused = false;
      } else if (domRunning === 'false' && rawTimer) {
        isPaused = true;
      }
      const domMode = footerEl.getAttribute('data-krono-timer-mode');
      if (domMode === 'countdown' || domMode === 'stopwatch') {
        mode = domMode;
      }
      const domTarget = Number(footerEl.getAttribute('data-krono-timer-target-seconds'));
      if (!Number.isNaN(domTarget) && domTarget > 0) {
        targetSeconds = domTarget;
      }
    }

    const domSubject = footerEl?.getAttribute('data-krono-timer-subject') || '';
    const domTopic = footerEl?.getAttribute('data-krono-timer-topic') || '';
    const domPlan = footerEl?.getAttribute('data-krono-timer-plan') || '';

    // Priority: Open Topic Cockpit (explicitly studying that topic's notes/questions) -> Running/Planned Timer -> Footer DOM
    const subjectName =
      (cockpitCtx && cockpitCtx.isOpen ? cockpitCtx.subjectName : '') ||
      rawTimer?.subjectName ||
      domSubject ||
      '';
    const topicName =
      (cockpitCtx && cockpitCtx.isOpen ? cockpitCtx.topicName : '') ||
      rawTimer?.topicName ||
      domTopic ||
      '';
    const planFile =
      (cockpitCtx && cockpitCtx.isOpen ? cockpitCtx.planFile : '') ||
      selectedPlan ||
      domPlan ||
      '';

    return {
      isActive,
      isPaused,
      mode,
      elapsedSeconds,
      targetSeconds,
      subjectName,
      topicName,
      planFile,
    };
  }

  function syncLiveStateToExtension(includePlans = false) {
    try {
      const timer = readTimerSnapshot();
      const payload = {
        type: 'KRONO_BRIDGE_SYNC',
        serverUrl: window.location.origin,
        pairingToken: cachedContext.pairingToken,
        username: cachedContext.username,
        timer,
      };
      if (includePlans && cachedContext.plans.length > 0) {
        payload.plans = cachedContext.plans;
      }
      chrome.runtime.sendMessage(payload, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      // extension context invalidated or reloading
    }
  }

  // Listen for commands coming from the Extension (QConcursos / Caveira tabs)
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === 'KRONO_TOGGLE_TIMER_CMD') {
      window.dispatchEvent(new CustomEvent('krono:remote-toggle-timer'));
      setTimeout(() => syncLiveStateToExtension(false), 120);
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'KRONO_REMOTE_CLIP_SAVED') {
      window.dispatchEvent(
        new CustomEvent('krono:remote-clip-saved', { detail: message.payload })
      );
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  // Listen for immediate events dispatched by the Krono app
  window.addEventListener('krono:timer-updated', () => syncLiveStateToExtension(false));
  window.addEventListener('krono:context-refresh', () => fetchKronoContext());
  window.addEventListener('storage', () => syncLiveStateToExtension(false));

  // Initial fetch & periodic sync
  fetchKronoContext();
  setInterval(fetchKronoContext, 30000);
  setInterval(() => syncLiveStateToExtension(false), 1000);
})();
