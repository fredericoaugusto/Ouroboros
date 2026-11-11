'use client';

import { useState, useEffect } from 'react';

export interface GlobalTimerState {
  mode: 'cronometro' | 'timer';
  isRunning: boolean;
  hasStarted: boolean;
  elapsedMs: number;
  targetDurationMs: number;
  pausedMs: number;
  subject: string;
  topic: string;
  subjectColor: string;
}

const initialState: GlobalTimerState = {
  mode: 'cronometro',
  isRunning: false,
  hasStarted: false,
  elapsedMs: 0,
  targetDurationMs: 0,
  pausedMs: 0,
  subject: '',
  topic: '',
  subjectColor: '#10b981',
};

let state: GlobalTimerState = { ...initialState };
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

function ensureTicker() {
  if (typeof window === 'undefined' || ticker !== null) return;
  ticker = setInterval(() => {
    if (state.isRunning) {
      const nextElapsed = state.elapsedMs + 1000;
      if (state.mode === 'timer' && state.targetDurationMs > 0 && nextElapsed >= state.targetDurationMs) {
        state = {
          ...state,
          elapsedMs: state.targetDurationMs,
          isRunning: false,
        };
      } else {
        state = {
          ...state,
          elapsedMs: nextElapsed,
        };
      }
      notify();
    } else if (state.hasStarted && state.elapsedMs > 0) {
      state = {
        ...state,
        pausedMs: state.pausedMs + 1000,
      };
      notify();
    }
  }, 1000);
}

export function getGlobalTimerState(): GlobalTimerState {
  return state;
}

export function startGlobalTimerSession(params: {
  subject?: string;
  topic?: string;
  subjectColor?: string;
  targetDurationMinutes?: number;
  autoStart?: boolean;
}) {
  ensureTicker();
  const targetMin = params.targetDurationMinutes ?? 0;
  const targetMs = targetMin > 0 ? targetMin * 60 * 1000 : 0;
  const autoStart = params.autoStart !== undefined ? params.autoStart : true;

  // Se já estiver rodando exatamente a mesma disciplina/tópico, apenas mantém e abre o foco
  const isSameActiveSession =
    state.hasStarted &&
    state.elapsedMs > 0 &&
    params.subject &&
    state.subject === params.subject &&
    (!params.topic || state.topic === params.topic);

  if (isSameActiveSession) {
    if (autoStart && !state.isRunning) {
      state = { ...state, isRunning: true };
      notify();
    }
    return;
  }

  state = {
    mode: targetMs > 0 ? 'timer' : 'cronometro',
    isRunning: autoStart,
    hasStarted: autoStart,
    elapsedMs: 0,
    targetDurationMs: targetMs,
    pausedMs: 0,
    subject: params.subject ?? state.subject,
    topic: params.topic ?? state.topic,
    subjectColor: params.subjectColor || state.subjectColor || '#10b981',
  };
  notify();
}

export function syncGlobalTimerMetadata(params: {
  subject?: string;
  topic?: string;
  subjectColor?: string;
  targetDurationMinutes?: number;
}) {
  // Só sincroniza metadados automáticos do planejamento se o cronômetro ainda não tiver sido iniciado pelo usuário
  if (state.hasStarted && state.elapsedMs > 0) return;
  const nextTargetMs =
    params.targetDurationMinutes && params.targetDurationMinutes > 0
      ? params.targetDurationMinutes * 60 * 1000
      : state.targetDurationMs;

  const changed =
    (params.subject !== undefined && params.subject !== state.subject) ||
    (params.topic !== undefined && params.topic !== state.topic) ||
    (params.subjectColor !== undefined && params.subjectColor !== state.subjectColor) ||
    nextTargetMs !== state.targetDurationMs;

  if (!changed) return;

  state = {
    ...state,
    subject: params.subject ?? state.subject,
    topic: params.topic ?? state.topic,
    subjectColor: params.subjectColor ?? state.subjectColor,
    targetDurationMs: nextTargetMs,
  };
  notify();
}

export function toggleGlobalTimer() {
  ensureTicker();
  state = {
    ...state,
    hasStarted: true,
    isRunning: !state.isRunning,
  };
  notify();
}

export function setGlobalTimerRunning(running: boolean) {
  ensureTicker();
  state = {
    ...state,
    hasStarted: running ? true : state.hasStarted,
    isRunning: running,
  };
  notify();
}

export function setGlobalTimerMode(
  mode: 'cronometro' | 'timer',
  fallbackTargetMinutes = 45
) {
  ensureTicker();
  const targetMs =
    mode === 'timer'
      ? state.targetDurationMs > 0
        ? state.targetDurationMs
        : fallbackTargetMinutes * 60 * 1000
      : state.targetDurationMs;

  state = {
    ...state,
    mode,
    targetDurationMs: targetMs,
  };
  notify();
}

export function resetGlobalTimer() {
  state = {
    ...state,
    isRunning: false,
    hasStarted: false,
    elapsedMs: 0,
    pausedMs: 0,
  };
  notify();
}

export function useGlobalTimer(): GlobalTimerState {
  const [localState, setLocalState] = useState<GlobalTimerState>(state);

  useEffect(() => {
    ensureTicker();
    const listener = () => setLocalState({ ...state });
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return localState;
}
