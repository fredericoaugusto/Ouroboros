// Krono Companion - Popup Controller
(function () {
  const statusBadge = document.getElementById('statusBadge');
  const timerSubjectLabel = document.getElementById('timerSubjectLabel');
  const timerDigits = document.getElementById('timerDigits');
  const btnToggleTimer = document.getElementById('btnToggleTimer');
  const btnCropTab = document.getElementById('btnCropTab');
  const btnQuickNote = document.getElementById('btnQuickNote');
  const pillAuto = document.getElementById('pillAuto');
  const pillManual = document.getElementById('pillManual');
  const selectPlan = document.getElementById('selectPlan');
  const selectSubject = document.getElementById('selectSubject');
  const selectTopic = document.getElementById('selectTopic');
  const tabHostLabel = document.getElementById('tabHostLabel');
  const tabAutoStatus = document.getElementById('tabAutoStatus');
  const btnToggleTabHud = document.getElementById('btnToggleTabHud');
  const btnToggleSiteRule = document.getElementById('btnToggleSiteRule');
  const selectAutoShowMode = document.getElementById('selectAutoShowMode');
  const siteHintText = document.getElementById('siteHintText');
  const inputServerUrl = document.getElementById('inputServerUrl');
  const inputToken = document.getElementById('inputToken');
  const btnSync = document.getElementById('btnSync');
  const syncMsg = document.getElementById('syncMsg');

  let currentState = null;
  let activeTabInfo = {
    id: null,
    isHttp: false,
    hostname: '',
    cleanHost: '',
    hudShowing: null,
  };

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    return [hrs, mins, rem].map((v) => String(v).padStart(2, '0')).join(':');
  }

  function showMessage(text, isOk) {
    syncMsg.textContent = text;
    syncMsg.className = `msg ${isOk ? 'ok' : 'err'}`;
  }

  function computeDisplaySec(tm) {
    if (!tm) return 0;
    const isRunning = Boolean(tm.isActive && !tm.isPaused);
    let elapsed = Number(tm.elapsedSeconds) || 0;
    if (isRunning && tm.updatedAt > 0) {
      elapsed += Math.min(Math.max(0, Math.floor((Date.now() - tm.updatedAt) / 1000)), 3600);
    }
    if (tm.mode === 'countdown') {
      return Math.max(0, (Number(tm.targetSeconds) || 2700) - elapsed);
    }
    return elapsed;
  }

  function renderUI(state, populateSelectors = false) {
    currentState = state;
    if (!state) return;

    if (state.connected) {
      statusBadge.textContent = state.username ? `🟢 ${state.username}` : '🟢 Conectado';
      statusBadge.className = 'status-badge';
    } else {
      statusBadge.textContent = '🔴 Offline';
      statusBadge.className = 'status-badge offline';
    }

    const tm = state.timer || {};
    const isRunning = Boolean(tm.isActive && !tm.isPaused);
    timerDigits.textContent = formatTime(computeDisplaySec(tm));
    timerDigits.className = `timer-digits ${isRunning ? '' : 'paused'}`;
    btnToggleTimer.textContent = isRunning ? '⏸ Pausar' : '▶ Iniciar';
    timerSubjectLabel.textContent = tm.subjectName || 'Cronômetro Krono';

    renderActiveTabControls(state);

    const useOverride = Boolean(state.overrideTarget?.useOverride);
    pillAuto.classList.toggle('active', !useOverride);
    pillManual.classList.toggle('active', useOverride);

    if (populateSelectors) {
      inputServerUrl.value = state.serverUrl || 'http://localhost:3000';
      inputToken.value = state.pairingToken || '';
      populateSelectOptions(state);
    }
  }

  function populateSelectOptions(state) {
    const plans = Array.isArray(state.plans) ? state.plans : [];
    const ov = state.overrideTarget || {};
    const tm = state.timer || {};

    const desiredPlan =
      (ov.useOverride ? ov.planFile : tm.planFile) ||
      ov.planFile ||
      plans[0]?.fileName ||
      '';

    if (plans.length === 0) {
      selectPlan.innerHTML = `<option value="">Nenhum plano sincronizado</option>`;
      selectSubject.innerHTML = `<option value="">Abra o Krono ou conecte abaixo</option>`;
      selectTopic.innerHTML = `<option value="">—</option>`;
      return;
    }

    selectPlan.innerHTML = plans
      .map(
        (p) =>
          `<option value="${escapeAttr(p.fileName)}" ${p.fileName === desiredPlan ? 'selected' : ''}>${escapeText(p.name)}</option>`
      )
      .join('');

    populateSubjectsForPlan(selectPlan.value, state);
  }

  function populateSubjectsForPlan(planFile, state) {
    const plans = Array.isArray(state.plans) ? state.plans : [];
    const planObj = plans.find((p) => p.fileName === planFile) || plans[0];
    const subs = Array.isArray(planObj?.subjects) ? planObj.subjects : [];
    const ov = state.overrideTarget || {};
    const tm = state.timer || {};

    const desiredSub =
      (ov.useOverride ? ov.subjectName : tm.subjectName) ||
      ov.subjectName ||
      subs[0]?.subject ||
      '';

    if (subs.length === 0) {
      selectSubject.innerHTML = `<option value="">Sem disciplinas</option>`;
      selectTopic.innerHTML = `<option value="">—</option>`;
      return;
    }

    selectSubject.innerHTML = subs
      .map(
        (s) =>
          `<option value="${escapeAttr(s.subject)}" ${s.subject === desiredSub ? 'selected' : ''}>${escapeText(s.subject)}</option>`
      )
      .join('');

    populateTopicsForSubject(planFile, selectSubject.value, state);
  }

  function populateTopicsForSubject(planFile, subjectName, state) {
    const plans = Array.isArray(state.plans) ? state.plans : [];
    const planObj = plans.find((p) => p.fileName === planFile) || plans[0];
    const subs = Array.isArray(planObj?.subjects) ? planObj.subjects : [];
    const subObj = subs.find((s) => s.subject === subjectName) || subs[0];
    const tops = Array.isArray(subObj?.topics) ? subObj.topics : [];
    const ov = state.overrideTarget || {};
    const tm = state.timer || {};

    const desiredTop =
      (ov.useOverride ? ov.topicName : tm.topicName) ||
      ov.topicName ||
      tops[0] ||
      '';

    if (tops.length === 0) {
      selectTopic.innerHTML = `<option value="">Tópico Geral</option>`;
      return;
    }

    selectTopic.innerHTML = tops
      .map(
        (t) =>
          `<option value="${escapeAttr(t)}" ${t === desiredTop ? 'selected' : ''}>${escapeText(t)}</option>`
      )
      .join('');
  }

  function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeText(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function saveTargetOverride(useOverride) {
    chrome.runtime.sendMessage(
      {
        type: 'KRONO_SET_TARGET_OVERRIDE',
        useOverride,
        planFile: selectPlan.value,
        subjectName: selectSubject.value,
        topicName: selectTopic.value,
      },
      (res) => {
        if (res?.state) renderUI(res.state, false);
      }
    );
  }

  // Events
  btnToggleTimer.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'KRONO_TOGGLE_TIMER' }, (res) => {
      if (res?.state) renderUI(res.state, false);
    });
  });

  btnCropTab.addEventListener('click', () => {
    chrome.runtime.sendMessage(
      { type: 'KRONO_TRIGGER_ACTIVE_TAB', command: 'KRONO_START_CROP_FROM_POPUP' },
      (res) => {
        if (res && res.ok) {
          window.close();
        } else {
          showMessage(res?.error || 'Abra um site de questões para recortar.', false);
        }
      }
    );
  });

  btnQuickNote.addEventListener('click', () => {
    chrome.runtime.sendMessage(
      { type: 'KRONO_TRIGGER_ACTIVE_TAB', command: 'KRONO_OPEN_QUICK_NOTE_FROM_POPUP' },
      (res) => {
        if (res && res.ok) {
          window.close();
        } else {
          showMessage(res?.error || 'Abra um site de estudos para anotar.', false);
        }
      }
    );
  });

  const FALLBACK_STUDY_HOSTS = [
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

  function cleanHostname(host) {
    return String(host || '').toLowerCase().replace(/^www\./, '');
  }

  function hostMatchesList(hostname, list) {
    const cleanHost = cleanHostname(hostname);
    if (!cleanHost || !Array.isArray(list)) return false;
    return list.some((entry) => {
      const domain = cleanHostname(entry);
      if (!domain) return false;
      return cleanHost === domain || cleanHost.endsWith(`.${domain}`);
    });
  }

  function willAutoShowOnHost(state, hostname) {
    if (!state || state.hudVisible === false || !hostname) return false;
    if (hostMatchesList(hostname, state.customBlockedHosts)) return false;
    if (hostMatchesList(hostname, state.customAllowedHosts)) return true;
    const mode = state.autoShowMode || 'study_sites';
    if (mode === 'all_sites') return true;
    if (mode === 'manual') return false;
    const studyList =
      Array.isArray(state.defaultStudyHosts) && state.defaultStudyHosts.length > 0
        ? state.defaultStudyHosts
        : FALLBACK_STUDY_HOSTS;
    return hostMatchesList(hostname, studyList);
  }

  function renderActiveTabControls(state) {
    if (!state) return;
    const mode = state.autoShowMode || 'study_sites';
    selectAutoShowMode.value = mode;

    const customCount = Array.isArray(state.customAllowedHosts) ? state.customAllowedHosts.length : 0;
    if (mode === 'all_sites') {
      siteHintText.textContent =
        'Abre automaticamente em qualquer site HTTP/HTTPS (exceto os bloqueados). Use ✕ na barra para fechar em uma aba.';
    } else if (mode === 'manual') {
      siteHintText.textContent =
        'Modo manual: a barra só abre quando você clicar em "Abrir Barra Aqui" ou usar Alt+S / +Nota.';
    } else {
      const extraNote = customCount > 0 ? ` (+${customCount} site${customCount > 1 ? 's' : ''} seu${customCount > 1 ? 's' : ''})` : '';
      siteHintText.textContent = `Monitora QConcursos, TEC, Caveira, Planalto, Estratégia, Gran e +8 portais${extraNote}. Use ✕ na barra para fechar.`;
    }

    if (!activeTabInfo.isHttp || !activeTabInfo.cleanHost) {
      tabHostLabel.textContent = 'Aba interna / sem site web';
      tabAutoStatus.textContent = 'Indisponível';
      tabAutoStatus.className = 'rule-badge';
      btnToggleTabHud.disabled = true;
      btnToggleTabHud.textContent = '👁️ Abra um Site Web';
      btnToggleTabHud.className = 'btn';
      btnToggleSiteRule.disabled = true;
      btnToggleSiteRule.textContent = '➕ Regra do Site';
      btnToggleSiteRule.dataset.action = '';
      return;
    }

    tabHostLabel.textContent = activeTabInfo.cleanHost;
    btnToggleTabHud.disabled = false;
    btnToggleSiteRule.disabled = false;

    const isHudOpen =
      activeTabInfo.hudShowing !== null
        ? Boolean(activeTabInfo.hudShowing)
        : willAutoShowOnHost(state, activeTabInfo.hostname);

    if (isHudOpen) {
      btnToggleTabHud.textContent = '✕ Fechar Barra Aqui';
      btnToggleTabHud.className = 'btn btn-danger-soft';
      btnToggleTabHud.dataset.open = 'true';
    } else {
      btnToggleTabHud.textContent = '👁️ Abrir Barra Aqui';
      btnToggleTabHud.className = 'btn btn-primary';
      btnToggleTabHud.dataset.open = 'false';
    }

    const studyList =
      Array.isArray(state.defaultStudyHosts) && state.defaultStudyHosts.length > 0
        ? state.defaultStudyHosts
        : FALLBACK_STUDY_HOSTS;
    const inBlocked = hostMatchesList(activeTabInfo.hostname, state.customBlockedHosts);
    const inAllowed = hostMatchesList(activeTabInfo.hostname, state.customAllowedHosts);
    const inDefault = hostMatchesList(activeTabInfo.hostname, studyList);

    if (inBlocked) {
      tabAutoStatus.textContent = '🚫 Bloqueado';
      tabAutoStatus.className = 'rule-badge blocked';
      btnToggleSiteRule.textContent = '✅ Reativar Auto Aqui';
      btnToggleSiteRule.dataset.action = mode === 'manual' ? 'allow' : 'clear';
    } else if (inAllowed) {
      tabAutoStatus.textContent = '✅ Sempre Auto';
      tabAutoStatus.className = 'rule-badge auto';
      btnToggleSiteRule.textContent = inDefault && mode !== 'manual' ? '🚫 Não Abrir Aqui' : '🚫 Tirar dos Autos';
      btnToggleSiteRule.dataset.action = inDefault && mode !== 'manual' ? 'block' : 'clear';
    } else if (mode === 'all_sites') {
      tabAutoStatus.textContent = '🌐 Auto (Todos)';
      tabAutoStatus.className = 'rule-badge auto';
      btnToggleSiteRule.textContent = '🚫 Não Abrir Aqui';
      btnToggleSiteRule.dataset.action = 'block';
    } else if (mode === 'manual') {
      tabAutoStatus.textContent = '👆 Manual';
      tabAutoStatus.className = 'rule-badge';
      btnToggleSiteRule.textContent = '➕ Sempre Auto Aqui';
      btnToggleSiteRule.dataset.action = 'allow';
    } else if (inDefault) {
      tabAutoStatus.textContent = '🎯 Site de Estudo';
      tabAutoStatus.className = 'rule-badge auto';
      btnToggleSiteRule.textContent = '🚫 Não Abrir Aqui';
      btnToggleSiteRule.dataset.action = 'block';
    } else {
      tabAutoStatus.textContent = '👆 Só Manual aqui';
      tabAutoStatus.className = 'rule-badge';
      btnToggleSiteRule.textContent = '➕ Sempre Auto Aqui';
      btnToggleSiteRule.dataset.action = 'allow';
    }
  }

  function refreshActiveTabInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      void chrome.runtime.lastError;
      const tab = Array.isArray(tabs) ? tabs[0] : null;
      if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) {
        activeTabInfo = { id: null, isHttp: false, hostname: '', cleanHost: '', hudShowing: null };
        if (currentState) renderActiveTabControls(currentState);
        return;
      }

      let hostname = '';
      try {
        hostname = new URL(tab.url).hostname || '';
      } catch {
        hostname = '';
      }

      activeTabInfo = {
        id: tab.id,
        isHttp: Boolean(hostname),
        hostname,
        cleanHost: cleanHostname(hostname),
        hudShowing: null,
      };

      if (currentState) renderActiveTabControls(currentState);

      chrome.tabs.sendMessage(tab.id, { type: 'KRONO_QUERY_TAB_HUD_STATUS' }, (resp) => {
        if (chrome.runtime.lastError) {
          activeTabInfo.hudShowing = null;
        } else if (resp && typeof resp.hudShowing === 'boolean') {
          activeTabInfo.hudShowing = resp.hudShowing;
        }
        if (currentState) renderActiveTabControls(currentState);
      });
    });
  }

  btnToggleTabHud.addEventListener('click', () => {
    if (!activeTabInfo.isHttp || !activeTabInfo.id) return;
    const isOpen = btnToggleTabHud.dataset.open === 'true';

    if (isOpen) {
      chrome.tabs.sendMessage(activeTabInfo.id, { type: 'KRONO_HIDE_HUD_FROM_POPUP' }, () => {
        void chrome.runtime.lastError;
      });
      activeTabInfo.hudShowing = false;
      if (currentState) renderActiveTabControls(currentState);
    } else {
      chrome.runtime.sendMessage(
        { type: 'KRONO_TRIGGER_ACTIVE_TAB', command: 'KRONO_SHOW_HUD_FROM_POPUP' },
        () => {
          void chrome.runtime.lastError;
        }
      );
      activeTabInfo.hudShowing = true;
      if (currentState) renderActiveTabControls(currentState);
    }
  });

  btnToggleSiteRule.addEventListener('click', () => {
    const action = btnToggleSiteRule.dataset.action;
    const host = activeTabInfo.cleanHost;
    if (!action || !host) return;

    const payload = { type: 'KRONO_SET_AUTO_SHOW_SETTINGS' };
    if (action === 'allow') payload.allowHost = host;
    if (action === 'block') payload.blockHost = host;
    if (action === 'clear') payload.clearHost = host;

    chrome.runtime.sendMessage(payload, (res) => {
      void chrome.runtime.lastError;
      if (res?.ok && res.state) {
        const shouldShowNow = willAutoShowOnHost(res.state, activeTabInfo.hostname);
        if (action === 'block' || !shouldShowNow) {
          if (activeTabInfo.id) {
            chrome.tabs.sendMessage(activeTabInfo.id, { type: 'KRONO_HIDE_HUD_FROM_POPUP' }, () => {
              void chrome.runtime.lastError;
            });
          }
          activeTabInfo.hudShowing = false;
        } else if (shouldShowNow) {
          chrome.runtime.sendMessage(
            { type: 'KRONO_TRIGGER_ACTIVE_TAB', command: 'KRONO_SHOW_HUD_FROM_POPUP' },
            () => {
              void chrome.runtime.lastError;
            }
          );
          activeTabInfo.hudShowing = true;
        }
        renderUI(res.state);
      }
    });
  });

  selectAutoShowMode.addEventListener('change', () => {
    const autoShowMode = selectAutoShowMode.value;
    chrome.runtime.sendMessage({ type: 'KRONO_SET_AUTO_SHOW_SETTINGS', autoShowMode }, (res) => {
      void chrome.runtime.lastError;
      if (res?.ok && res.state) {
        if (activeTabInfo.isHttp && activeTabInfo.id) {
          const shouldShowNow = willAutoShowOnHost(res.state, activeTabInfo.hostname);
          if (shouldShowNow) {
            chrome.runtime.sendMessage(
              { type: 'KRONO_TRIGGER_ACTIVE_TAB', command: 'KRONO_SHOW_HUD_FROM_POPUP' },
              () => {
                void chrome.runtime.lastError;
              }
            );
            activeTabInfo.hudShowing = true;
          } else {
            chrome.tabs.sendMessage(activeTabInfo.id, { type: 'KRONO_HIDE_HUD_FROM_POPUP' }, () => {
              void chrome.runtime.lastError;
            });
            activeTabInfo.hudShowing = false;
          }
        }
        renderUI(res.state);
      }
    });
  });

  refreshActiveTabInfo();

  pillAuto.addEventListener('click', () => saveTargetOverride(false));
  pillManual.addEventListener('click', () => saveTargetOverride(true));

  selectPlan.addEventListener('change', () => {
    if (currentState) populateSubjectsForPlan(selectPlan.value, currentState);
    saveTargetOverride(true);
  });

  selectSubject.addEventListener('change', () => {
    if (currentState) populateTopicsForSubject(selectPlan.value, selectSubject.value, currentState);
    saveTargetOverride(true);
  });

  selectTopic.addEventListener('change', () => {
    saveTargetOverride(true);
  });

  btnSync.addEventListener('click', () => {
    btnSync.disabled = true;
    btnSync.textContent = '⏳ Conectando...';
    chrome.runtime.sendMessage(
      {
        type: 'KRONO_REFRESH_CONTEXT',
        serverUrl: inputServerUrl.value.trim() || 'http://localhost:3000',
        pairingToken: inputToken.value.trim(),
      },
      (res) => {
        btnSync.disabled = false;
        btnSync.textContent = '🔄 Conectar & Sincronizar Planos';
        if (res && res.ok && res.state) {
          renderUI(res.state, true);
          showMessage(`Conectado! ${res.state.plans?.length || 0} plano(s) sincronizado(s).`, true);
        } else {
          showMessage(res?.error || 'Não foi possível conectar. Verifique o token ou faça login no Krono.', false);
        }
      }
    );
  });

  // Initial load + 1s timer refresh in popup
  chrome.runtime.sendMessage({ type: 'KRONO_GET_STATE' }, (res) => {
    if (res && res.ok && res.state) {
      renderUI(res.state, true);
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'KRONO_STATE_BROADCAST' && msg.state) {
      renderUI(msg.state, false);
    }
  });

  setInterval(() => {
    if (currentState?.timer?.isActive && !currentState?.timer?.isPaused) {
      timerDigits.textContent = formatTime(computeDisplaySec(currentState.timer));
    }
  }, 500);
})();
