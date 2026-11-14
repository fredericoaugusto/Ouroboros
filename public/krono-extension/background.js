// Krono Companion - Background Service Worker (Manifest V3)

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

const DEFAULT_STATE = {
  serverUrl: 'http://localhost:3000',
  pairingToken: '',
  username: '',
  connected: false,
  hudVisible: true,
  hudMinimized: false,
  autoShowMode: 'study_sites', // 'study_sites' | 'all_sites' | 'manual'
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

async function getStoredState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['kronoState'], (res) => {
      resolve({
        ...DEFAULT_STATE,
        ...(res.kronoState || {}),
        defaultStudyHosts: DEFAULT_STUDY_HOSTS,
        customAllowedHosts: Array.isArray(res.kronoState?.customAllowedHosts)
          ? res.kronoState.customAllowedHosts
          : [],
        customBlockedHosts: Array.isArray(res.kronoState?.customBlockedHosts)
          ? res.kronoState.customBlockedHosts
          : [],
      });
    });
  });
}

async function setStoredState(patch) {
  const current = await getStoredState();
  const next = {
    ...current,
    ...patch,
    timer: patch.timer ? { ...current.timer, ...patch.timer } : current.timer,
    overrideTarget: patch.overrideTarget
      ? { ...current.overrideTarget, ...patch.overrideTarget }
      : current.overrideTarget,
  };
  return new Promise((resolve) => {
    chrome.storage.local.set({ kronoState: next }, () => resolve(next));
  });
}

async function broadcastStateToTabs(state) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && /^https?:/i.test(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { type: 'KRONO_STATE_BROADCAST', state }).catch(() => {});
      }
    }
  } catch {
    // ignore errors on restricted tabs
  }
}

async function refreshContextFromApi(customServerUrl, customToken) {
  const state = await getStoredState();
  const serverUrl = (customServerUrl || state.serverUrl || 'http://localhost:3000').replace(/\/+$/, '');
  const token = customToken !== undefined ? customToken : state.pairingToken;

  try {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-krono-ext-token'] = token;
    }
    const res = await fetch(`${serverUrl}/api/extension/context`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      return { ok: false, error: `Status ${res.status}` };
    }
    const data = await res.json();
    if (data && data.connected) {
      const next = await setStoredState({
        serverUrl,
        pairingToken: data.pairingToken || token,
        username: data.username || state.username,
        connected: true,
        plans: Array.isArray(data.plans) ? data.plans : state.plans,
      });
      await broadcastStateToTabs(next);
      return { ok: true, state: next };
    }
    return { ok: false, error: data?.error || 'Não conectado' };
  } catch (err) {
    return { ok: false, error: err?.message || 'Falha de conexão com o Krono' };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'KRONO_BRIDGE_SYNC') {
    (async () => {
      const current = await getStoredState();
      const incomingTimer = message.timer || {};
      const nextPatch = {
        serverUrl: message.serverUrl || current.serverUrl,
        connected: true,
        timer: {
          ...current.timer,
          ...incomingTimer,
          updatedAt: Date.now(),
        },
      };
      if (message.pairingToken) nextPatch.pairingToken = message.pairingToken;
      if (message.username) nextPatch.username = message.username;
      if (Array.isArray(message.plans) && message.plans.length > 0) {
        nextPatch.plans = message.plans;
      }

      // Auto-initialize overrideTarget if empty
      if (!current.overrideTarget.planFile && (incomingTimer.planFile || nextPatch.plans?.[0]?.fileName)) {
        nextPatch.overrideTarget = {
          ...current.overrideTarget,
          planFile: incomingTimer.planFile || nextPatch.plans?.[0]?.fileName || '',
          subjectName: incomingTimer.subjectName || nextPatch.plans?.[0]?.subjects?.[0]?.subject || '',
          topicName: incomingTimer.topicName || nextPatch.plans?.[0]?.subjects?.[0]?.topics?.[0] || '',
        };
      }

      const updated = await setStoredState(nextPatch);
      await broadcastStateToTabs(updated);
      sendResponse({ ok: true, state: updated });
    })();
    return true;
  }

  if (message.type === 'KRONO_GET_STATE') {
    (async () => {
      let state = await getStoredState();
      if (!state.plans || state.plans.length === 0) {
        const refreshed = await refreshContextFromApi(state.serverUrl, state.pairingToken);
        if (refreshed.ok && refreshed.state) {
          state = refreshed.state;
        }
      }
      sendResponse({ ok: true, state });
    })();
    return true;
  }

  if (message.type === 'KRONO_REFRESH_CONTEXT') {
    (async () => {
      const result = await refreshContextFromApi(message.serverUrl, message.pairingToken);
      sendResponse(result);
    })();
    return true;
  }

  if (message.type === 'KRONO_SET_TARGET_OVERRIDE') {
    (async () => {
      const updated = await setStoredState({
        overrideTarget: {
          useOverride: message.useOverride !== undefined ? message.useOverride : true,
          planFile: message.planFile || '',
          subjectName: message.subjectName || '',
          topicName: message.topicName || '',
        },
      });
      await broadcastStateToTabs(updated);
      sendResponse({ ok: true, state: updated });
    })();
    return true;
  }

  if (message.type === 'KRONO_SET_HUD_VISIBILITY') {
    (async () => {
      const patch = {};
      if (message.hudVisible !== undefined) patch.hudVisible = message.hudVisible;
      if (message.hudMinimized !== undefined) patch.hudMinimized = message.hudMinimized;
      const updated = await setStoredState(patch);
      await broadcastStateToTabs(updated);
      sendResponse({ ok: true, state: updated });
    })();
    return true;
  }

  if (message.type === 'KRONO_SET_AUTO_SHOW_SETTINGS') {
    (async () => {
      const current = await getStoredState();
      const patch = {};
      if (message.autoShowMode) {
        patch.autoShowMode = message.autoShowMode;
      }
      if (message.allowHost) {
        const clean = String(message.allowHost).toLowerCase().replace(/^www\./, '');
        patch.customAllowedHosts = Array.from(new Set([...(current.customAllowedHosts || []), clean]));
        patch.customBlockedHosts = (current.customBlockedHosts || []).filter((h) => h !== clean);
      }
      if (message.blockHost) {
        const clean = String(message.blockHost).toLowerCase().replace(/^www\./, '');
        patch.customBlockedHosts = Array.from(new Set([...(current.customBlockedHosts || []), clean]));
        patch.customAllowedHosts = (current.customAllowedHosts || []).filter((h) => h !== clean);
      }
      if (message.clearHost) {
        const clean = String(message.clearHost).toLowerCase().replace(/^www\./, '');
        patch.customAllowedHosts = (current.customAllowedHosts || []).filter((h) => h !== clean);
        patch.customBlockedHosts = (current.customBlockedHosts || []).filter((h) => h !== clean);
      }
      const updated = await setStoredState(patch);
      await broadcastStateToTabs(updated);
      sendResponse({ ok: true, state: updated });
    })();
    return true;
  }

  if (message.type === 'KRONO_TOGGLE_TIMER') {
    (async () => {
      const state = await getStoredState();
      const tabs = await chrome.tabs.query({});
      let sentToKronoTab = false;

      for (const tab of tabs) {
        if (tab.id && tab.url && tab.url.startsWith(state.serverUrl)) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'KRONO_TOGGLE_TIMER_CMD' });
            sentToKronoTab = true;
          } catch {
            // ignore
          }
        }
      }

      if (!sentToKronoTab) {
        // Fallback local toggle if Krono tab is closed
        const isCurrentlyRunning = state.timer.isActive && !state.timer.isPaused;
        const updated = await setStoredState({
          timer: {
            ...state.timer,
            isActive: true,
            isPaused: isCurrentlyRunning,
            updatedAt: Date.now(),
          },
        });
        await broadcastStateToTabs(updated);
        sendResponse({ ok: true, state: updated, fallback: true });
      } else {
        sendResponse({ ok: true, sentToKronoTab: true });
      }
    })();
    return true;
  }

  if (message.type === 'KRONO_CAPTURE_VISIBLE_TAB') {
    chrome.tabs.captureVisibleTab(
      sender.tab ? sender.tab.windowId : null,
      { format: 'png' },
      (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          sendResponse({
            ok: false,
            error: chrome.runtime.lastError?.message || 'Não foi possível capturar a imagem da aba.',
          });
        } else {
          sendResponse({ ok: true, dataUrl });
        }
      }
    );
    return true;
  }

  if (message.type === 'KRONO_SAVE_CLIP') {
    (async () => {
      const state = await getStoredState();
      const serverUrl = (state.serverUrl || 'http://localhost:3000').replace(/\/+$/, '');
      const token = state.pairingToken;

      const useOverride = state.overrideTarget?.useOverride;
      const planFile =
        message.planFile ||
        (useOverride ? state.overrideTarget.planFile : '') ||
        state.timer.planFile ||
        state.overrideTarget.planFile ||
        state.plans?.[0]?.fileName ||
        '';
      const subjectName =
        message.subjectName ||
        (useOverride ? state.overrideTarget.subjectName : '') ||
        state.timer.subjectName ||
        state.overrideTarget.subjectName ||
        state.plans?.[0]?.subjects?.[0]?.subject ||
        '';
      const topicName =
        message.topicName ||
        (useOverride ? state.overrideTarget.topicName : '') ||
        state.timer.topicName ||
        state.overrideTarget.topicName ||
        state.plans?.[0]?.subjects?.[0]?.topics?.[0] ||
        '';

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          headers['x-krono-ext-token'] = token;
        }

        const res = await fetch(`${serverUrl}/api/extension/clip`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            planFile,
            subjectName,
            topicName,
            htmlSnippet: message.htmlSnippet,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          sendResponse({
            ok: false,
            error: data?.error || `Erro ao salvar no Krono (${res.status}). Verifique se está logado.`,
          });
          return;
        }

        // Notify any open Krono tab so DataContext updates immediately in memory!
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id && tab.url && tab.url.startsWith(serverUrl)) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: 'KRONO_REMOTE_CLIP_SAVED',
                payload: data,
              })
              .catch(() => {});
          }
        }

        sendResponse({
          ok: true,
          planFile: data.planFile,
          subjectName: data.subjectName,
          topicName: data.topicName,
        });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || 'Erro de conexão com o servidor do Krono.',
        });
      }
    })();
    return true;
  }

  if (message.type === 'KRONO_TRIGGER_ACTIVE_TAB') {
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id || !activeTab.url || !/^https?:/i.test(activeTab.url)) {
          sendResponse({ ok: false, error: 'Abra um site de estudos (HTTP/HTTPS) para usar o Estúdio.' });
          return;
        }
        try {
          await chrome.tabs.sendMessage(activeTab.id, { type: message.command });
          sendResponse({ ok: true });
        } catch {
          // Tab was open before extension load: inject CSS + Studio script dynamically
          await chrome.scripting.insertCSS({
            target: { tabId: activeTab.id },
            files: ['content-studio.css'],
          });
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content-studio.js'],
          });
          setTimeout(() => {
            chrome.tabs.sendMessage(activeTab.id, { type: message.command }).catch(() => {});
          }, 150);
          sendResponse({ ok: true, injected: true });
        }
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || 'Não foi possível ativar nesta aba.' });
      }
    })();
    return true;
  }

  return false;
});
