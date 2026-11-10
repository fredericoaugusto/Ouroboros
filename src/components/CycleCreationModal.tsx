'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { updateAllTopicWeightsAction } from '../app/actions';
import { useNotification } from '../context/NotificationContext';
import {
  Wand2,
  Sliders,
  Search,
  X,
  Clock,
  Calendar,
  HelpCircle,
  Check,
  Copy,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Wrench,
  Trash2,
} from 'lucide-react';
import TopicWeightsModal from './TopicWeightsModal';
import Breadcrumbs from './Breadcrumbs';

interface Subject {
  id: string;
  subject: string;
  topics: Topic[];
  color: string;
}

interface Topic {
  topic_text: string;
  userWeight?: number;
  sub_topics?: Topic[];
  is_grouping_topic?: boolean;
}

interface SubjectSettings {
  [subjectId: string]: { importance: number; knowledge: number };
}

interface StudySession {
  id: any;
  subjectId: string;
  subject: string;
  duration: number;
  color: string;
}

interface CycleCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: {
    studyHours: string;
    weeklyQuestionsGoal: string;
    subjectSettings: SubjectSettings;
    selectedSubjects: string[];
    minSession: string;
    maxSession: string;
    studyDays: string[];
  };
}

const KNOWLEDGE_LABELS = [
  { value: 1, label: 'Não conheço' },
  { value: 2, label: 'Conheço pouco' },
  { value: 3, label: 'Mediano' },
  { value: 4, label: 'Conheço bem' },
  { value: 5, label: 'Domino' },
];

const IMPORTANCE_LABELS = [
  { value: 1, label: 'Baixo' },
  { value: 2, label: 'Médio-Baixo' },
  { value: 3, label: 'Médio' },
  { value: 4, label: 'Alto' },
  { value: 5, label: 'Muito Alto' },
];

const CycleCreationModal: React.FC<CycleCreationModalProps> = ({
  isOpen,
  onClose,
  isEditing = false,
  initialData,
}) => {
  const {
    generateStudyCycle,
    selectedDataFile,
    setStudyCycle,
    setCurrentProgressMinutes,
    setCompletedCycles,
    setSessionProgressMap,
    studyHours: dataContextStudyHours,
    weeklyQuestionsGoal: dataContextWeeklyQuestionsGoal,
    setStudyHours: setContextStudyHours,
    setWeeklyQuestionsGoal: setContextWeeklyQuestionsGoal,
    setStudyDays: setContextStudyDays,
    stats,
    studyPlans,
    availablePlans,
    refreshPlans,
  } = useData();

  const { showNotification } = useNotification();
  const [modalStep, setModalStep] = useState(0);
  const [wizardMode, setWizardMode] = useState<'simple' | 'detailed' | 'manual'>('detailed');
  const [topicSuggestionMode, setTopicSuggestionMode] = useState<'auto' | 'manual'>('auto');

  const subjects: Subject[] = useMemo(() => stats.editalData || [], [stats.editalData]);
  const currentPlan = useMemo(() => {
    const planIndex = availablePlans.indexOf(selectedDataFile);
    return planIndex !== -1 ? studyPlans[planIndex] : null;
  }, [selectedDataFile, availablePlans, studyPlans]);
  const bancaTopicWeights = useMemo(() => currentPlan?.bancaTopicWeights || null, [currentPlan]);

  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectSettings, setSubjectSettings] = useState<SubjectSettings>({});
  const [studyHours, setStudyHours] = useState('25');
  const [studyDays, setStudyDays] = useState<string[]>([
    'Segunda',
    'Terça',
    'Quarta',
    'Quinta',
    'Sexta',
  ]);
  const [minSession, setMinSession] = useState('45');
  const [maxSession, setMaxSession] = useState('90');
  const [weeklyQuestionsGoal, setWeeklyQuestionsGoal] = useState('200');
  const [searchTerm, setSearchTerm] = useState('');
  const [manualStudySessions, setManualStudySessions] = useState<StudySession[]>([]);
  const [newManualSessionSubjectId, setNewManualSessionSubjectId] = useState('');
  const [newManualSessionDuration, setNewManualSessionDuration] = useState('60');

  const [isTopicWeightsModalOpen, setIsTopicWeightsModalOpen] = useState(false);
  const [selectedSubjectForWeights, setSelectedSubjectForWeights] = useState<Subject | null>(
    null
  );

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        setStudyHours(initialData.studyHours || dataContextStudyHours || '25');
        setWeeklyQuestionsGoal(
          initialData.weeklyQuestionsGoal || dataContextWeeklyQuestionsGoal || '200'
        );
        setSelectedSubjectIds(
          initialData.selectedSubjects?.length
            ? initialData.selectedSubjects
            : subjects.map((s) => s.id)
        );
        setSubjectSettings(initialData.subjectSettings || {});
        setMinSession(initialData.minSession || '45');
        setMaxSession(initialData.maxSession || '90');
        setStudyDays(
          initialData.studyDays || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
        );
        setModalStep(0);
      } else {
        setStudyHours(dataContextStudyHours || '25');
        setWeeklyQuestionsGoal(dataContextWeeklyQuestionsGoal || '200');
        setSelectedSubjectIds(subjects.map((s) => s.id));
        setSubjectSettings({});
        setMinSession('45');
        setMaxSession('90');
        setStudyDays(['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']);
        setModalStep(0);
      }
    }
  }, [isOpen, isEditing, initialData, dataContextStudyHours, dataContextWeeklyQuestionsGoal, subjects]);

  useEffect(() => {
    if (isOpen && selectedSubjectIds.length > 0) {
      setSubjectSettings((prevSettings) => {
        const newSettings = { ...prevSettings };
        let changed = false;
        selectedSubjectIds.forEach((subjectId) => {
          if (!newSettings[subjectId]) {
            newSettings[subjectId] = { importance: 3, knowledge: 3 };
            changed = true;
          }
        });
        return changed ? newSettings : prevSettings;
      });
    }
  }, [selectedSubjectIds, isOpen]);

  const percentages = useMemo(() => {
    const weights: { [key: string]: number } = {};
    let totalWeight = 0;
    selectedSubjectIds.forEach((subjectId) => {
      const setting = subjectSettings[subjectId] || { importance: 3, knowledge: 3 };
      const weight = setting.importance / (setting.knowledge || 1);
      weights[subjectId] = weight;
      totalWeight += weight;
    });
    const newPercentages: { [key: string]: string } = {};
    Object.keys(weights).forEach((subjectId) => {
      newPercentages[subjectId] =
        totalWeight > 0 ? ((weights[subjectId] / totalWeight) * 100).toFixed(1) : '0.0';
    });
    return newPercentages;
  }, [subjectSettings, selectedSubjectIds]);

  const handleSubjectSelect = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleSettingChange = (
    subjectId: string,
    type: 'importance' | 'knowledge',
    value: number
  ) => {
    setSubjectSettings((prev) => ({
      ...prev,
      [subjectId]: { ...(prev[subjectId] || { importance: 3, knowledge: 3 }), [type]: value },
    }));
  };

  const handleDaySelect = (day: string) => {
    setStudyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const validateNumericalInputs = () => {
    const hours = parseInt(studyHours);
    const min = parseInt(minSession);
    const max = parseInt(maxSession);
    const questionsGoal = parseInt(weeklyQuestionsGoal);

    if (isNaN(hours) || hours <= 0) {
      showNotification('Insira um número válido para as horas semanais.', 'error');
      return false;
    }
    if (isNaN(questionsGoal) || questionsGoal < 0) {
      showNotification('Insira um número válido para a meta de questões.', 'error');
      return false;
    }
    if (isNaN(min) || min <= 0 || isNaN(max) || max <= 0 || min > max) {
      showNotification('Verifique a duração mínima e máxima das sessões.', 'error');
      return false;
    }
    return true;
  };

  const handleGenerateCycle = () => {
    if (!validateNumericalInputs()) return;
    const selectedSubjectsData = subjects.filter((s) => selectedSubjectIds.includes(s.id));
    if (selectedSubjectsData.length === 0) {
      showNotification('Selecione pelo menos uma disciplina.', 'error');
      return;
    }

    generateStudyCycle({
      studyHours: parseInt(studyHours),
      minSession: parseInt(minSession),
      maxSession: parseInt(maxSession),
      subjectSettings,
      subjects: selectedSubjectsData,
      weeklyQuestionsGoal,
    });
    setContextStudyDays(studyDays);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ouroboros_topic_suggestion_mode', topicSuggestionMode);
    }
    showNotification('Planejamento de estudos gerado com sucesso!', 'success');
    onClose();
  };

  const handleAddManualSession = () => {
    if (!newManualSessionSubjectId || !newManualSessionDuration) {
      showNotification('Selecione uma disciplina e a duração.', 'error');
      return;
    }
    const duration = parseInt(newManualSessionDuration);
    if (isNaN(duration) || duration <= 0) return;

    const selectedSubjectData = subjectMap.get(newManualSessionSubjectId);
    if (!selectedSubjectData) return;

    const newSession: StudySession = {
      id: `${Date.now()}-${Math.random()}`,
      subjectId: selectedSubjectData.id,
      subject: selectedSubjectData.subject,
      duration,
      color: selectedSubjectData.color || '#10b981',
    };

    setManualStudySessions((prev) => [...prev, newSession]);
  };

  const handleSaveManualCycle = () => {
    if (manualStudySessions.length === 0) {
      showNotification('Adicione pelo menos uma sessão ao ciclo.', 'error');
      return;
    }
    const totalManualDurationMinutes = manualStudySessions.reduce(
      (sum, session) => sum + session.duration,
      0
    );
    setStudyCycle(manualStudySessions);
    setSessionProgressMap({});
    setCurrentProgressMinutes(0);
    setCompletedCycles(0);
    setContextStudyHours(Math.max(1, Math.round(totalManualDurationMinutes / 60)).toString());
    setContextWeeklyQuestionsGoal(weeklyQuestionsGoal);
    setContextStudyDays(studyDays);
    onClose();
    showNotification('Ciclo de estudos manual salvo com sucesso!', 'success');
  };

  if (!isOpen) return null;

  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const filteredSubjects = subjects.filter((s) =>
    s.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 lg:left-64 bottom-14 bg-[#f8fafc] dark:bg-[#0b1320] z-30 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumbs
            items={[
              { label: 'Planejamento', onClick: onClose },
              { label: 'Configurar Ciclo de Estudos' },
            ]}
            className="mb-0"
          />
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Planejamento
          </button>
        </div>

        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm w-full overflow-hidden flex flex-col md:flex-row min-h-[560px]">
          {/* Left Sidebar (Estudei Print 5 style) */}
        <div className="w-full md:w-64 bg-slate-50 dark:bg-[#0d1626] border-b md:border-b-0 md:border-r border-slate-200 dark:border-[#1f304a] p-6 flex flex-col justify-between shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Criar planejamento
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 mb-6">Leva cerca de 2 minutos</p>

            <div className="space-y-4">
              {[
                { step: 0, title: 'Formato', desc: 'Simples, detalhado ou manual' },
                { step: 1, title: 'Disciplinas', desc: 'O que entra no plano' },
                ...(wizardMode === 'detailed'
                  ? [{ step: 2, title: 'Conhecimento e Peso', desc: 'Domínio e importância' }]
                  : []),
                { step: 3, title: 'Rotina', desc: 'Horas, sessões e dias' },
              ].map((item, idx) => {
                const isActive = modalStep === item.step;
                const isDone = modalStep > item.step;
                return (
                  <div key={item.step} className="flex items-start gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isActive
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                          : isDone
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-200 dark:bg-[#1a2942] text-slate-400'
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <div>
                      <div
                        className={`text-xs font-bold ${
                          isActive
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Box */}
          <div className="mt-6 p-3.5 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] space-y-2 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              SEU PLANEJAMENTO
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Formato</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {wizardMode === 'simple'
                  ? 'Simples'
                  : wizardMode === 'detailed'
                  ? 'Detalhado'
                  : 'Manual'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Assuntos</span>
              <span className="font-semibold text-emerald-500">
                {topicSuggestionMode === 'auto' ? 'Automático' : 'Livre'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Disciplinas</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {selectedSubjectIds.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Por semana</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {studyHours}h
              </span>
            </div>
          </div>
        </div>

        {/* Right Main Content */}
        <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* STEP 0: Choose Format (Estudei Print 5) */}
          {modalStep === 0 && (
            <div className="space-y-6 my-auto">
              <div>
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                  Criar planejamento
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                  Como você quer montar seu planejamento?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Nos dois caminhos o Ouroboros monta a rotina ideal para você.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Começar Simples */}
                <div
                  onClick={() => {
                    setWizardMode('simple');
                    setModalStep(1);
                  }}
                  className="group p-5 rounded-2xl border-2 border-emerald-500/40 hover:border-emerald-500 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06] cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-4 shadow-md shadow-emerald-500/20">
                      <Wand2 className="w-5 h-5" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">
                      Começar simples
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Escolha as disciplinas e diga quanto tempo tem. O sistema distribui o resto — você ajusta depois.
                    </p>
                  </div>
                  <div className="mt-5 pt-3 flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-500 dark:text-slate-300">
                        3 etapas
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-500 dark:text-slate-300">
                        ~1 min
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-500 inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Começar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Ajustar em detalhe */}
                <div
                  onClick={() => {
                    setWizardMode('detailed');
                    setModalStep(1);
                  }}
                  className="group p-5 rounded-2xl border border-slate-200 dark:border-[#243552] hover:border-indigo-500 bg-slate-50/50 dark:bg-[#0f1929]/50 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-[#1a2942] text-indigo-400 flex items-center justify-center mb-4">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">
                      Ajustar em detalhe
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Diga quanto já domina de cada disciplina e quanto ela pesa na prova, e o tempo é dividido com base nisso.
                    </p>
                  </div>
                  <div className="mt-5 pt-3 flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-500 dark:text-slate-300">
                        4 etapas
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-500 dark:text-slate-300">
                        ~2 min
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-white inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Ajustar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Topic Suggestion Option */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Sugestão de Assuntos na hora de estudar:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTopicSuggestionMode('auto')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      topicSuggestionMode === 'auto'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                        : 'border-slate-200 dark:border-[#1f304a] text-slate-500'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />O sistema sugere o próximo tópico
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Segue a sequência do edital verticalizado automaticamente
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopicSuggestionMode('manual')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      topicSuggestionMode === 'manual'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                        : 'border-slate-200 dark:border-[#1f304a] text-slate-500'
                    }`}
                  >
                    <div className="text-xs font-bold">Eu escolho o assunto na hora</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Apenas a disciplina do bloco é indicada
                    </div>
                  </button>
                </div>
              </div>

              {/* Manual option button */}
              <button
                type="button"
                onClick={() => {
                  setWizardMode('manual');
                  setModalStep(4);
                }}
                className="w-full p-4 rounded-xl border border-slate-200 dark:border-[#243552] hover:border-slate-400 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Wrench className="w-4 h-4 text-slate-400" />
                  Prefiro montar do zero, disciplina por disciplina
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          )}

          {/* STEP 1: Select Disciplines */}
          {modalStep === 1 && (
            <div className="space-y-4 flex-1 flex flex-col">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Quais disciplinas entram no seu ciclo?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecione as matérias que deseja estudar neste planejamento
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar disciplina..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const allIds = filteredSubjects.map((s) => s.id);
                    const allSelected = allIds.every((id) => selectedSubjectIds.includes(id));
                    if (allSelected) {
                      setSelectedSubjectIds((prev) => prev.filter((id) => !allIds.includes(id)));
                    } else {
                      setSelectedSubjectIds((prev) => Array.from(new Set([...prev, ...allIds])));
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 hover:bg-emerald-500 hover:text-white transition-colors"
                >
                  Selecionar Todas
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto max-h-[300px] pr-1 flex-1">
                {filteredSubjects.map((s) => {
                  const isSelected = selectedSubjectIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSubjectSelect(s.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 text-slate-900 dark:text-white font-semibold'
                          : 'border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0b1320]/50 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span
                          className="w-2.5 h-6 rounded-full shrink-0"
                          style={{ backgroundColor: s.color || '#10b981' }}
                        />
                        <span className="text-xs truncate">{s.subject}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 text-white'
                            : 'border border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-[#1f304a]">
                <button
                  type="button"
                  onClick={() => setModalStep(0)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={selectedSubjectIds.length === 0}
                  onClick={() => setModalStep(wizardMode === 'simple' ? 3 : 2)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40"
                >
                  Avançar
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Knowledge & Exam Weight (Estudei Pills) */}
          {modalStep === 2 && (
            <div className="space-y-4 flex-1 flex flex-col">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Seu Conhecimento e Peso na Prova
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Disciplinas com maior peso e menor domínio recebem mais blocos no seu ciclo
                </p>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[340px] pr-1 flex-1">
                {selectedSubjectIds.map((subjectId) => {
                  const subject = subjectMap.get(subjectId);
                  if (!subject) return null;
                  const currentKnow = subjectSettings[subjectId]?.knowledge || 3;
                  const currentImp = subjectSettings[subjectId]?.importance || 3;
                  const sharePct = percentages[subjectId] || '0.0';

                  return (
                    <div
                      key={subjectId}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-5 rounded-full"
                            style={{ backgroundColor: subject.color || '#10b981' }}
                          />
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {subject.subject}
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          {sharePct}% do ciclo
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Knowledge */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Seu Conhecimento Atual
                          </label>
                          <div className="flex flex-wrap gap-1">
                            {KNOWLEDGE_LABELS.map((k) => (
                              <button
                                key={k.value}
                                type="button"
                                onClick={() =>
                                  handleSettingChange(subjectId, 'knowledge', k.value)
                                }
                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                  currentKnow === k.value
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-white dark:bg-[#131f33] text-slate-500 border border-slate-200 dark:border-[#1f304a]'
                                }`}
                              >
                                {k.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Importance */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Peso na Prova
                          </label>
                          <div className="flex flex-wrap gap-1">
                            {IMPORTANCE_LABELS.map((imp) => (
                              <button
                                key={imp.value}
                                type="button"
                                onClick={() =>
                                  handleSettingChange(subjectId, 'importance', imp.value)
                                }
                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                  currentImp === imp.value
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-white dark:bg-[#131f33] text-slate-500 border border-slate-200 dark:border-[#1f304a]'
                                }`}
                              >
                                {imp.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-[#1f304a]">
                <button
                  type="button"
                  onClick={() => setModalStep(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => setModalStep(3)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  Avançar
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Routine (Hours, Session Duration, Days) */}
          {modalStep === 3 && (
            <div className="space-y-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Defina sua Rotina Semanal
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure quantas horas por semana pretende estudar e a duração de cada bloco
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    Horas de Estudo por Semana
                  </label>
                  <input
                    type="number"
                    value={studyHours}
                    onChange={(e) => setStudyHours(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-2">
                    <HelpCircle className="w-4 h-4 text-indigo-400" />
                    Meta Semanal de Questões
                  </label>
                  <input
                    type="number"
                    value={weeklyQuestionsGoal}
                    onChange={(e) => setWeeklyQuestionsGoal(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-2">
                    Duração de cada Bloco de Estudo (minutos)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Mínimo (min)</span>
                      <input
                        type="number"
                        value={minSession}
                        onChange={(e) => setMinSession(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] text-sm font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Máximo (min)</span>
                      <input
                        type="number"
                        value={maxSession}
                        onChange={(e) => setMaxSession(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] text-sm font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    Dias de Estudo na Semana
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map((day) => {
                      const active = studyDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDaySelect(day)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                            active
                              ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                              : 'bg-white dark:bg-[#131f33] text-slate-500 border border-slate-200 dark:border-[#1f304a]'
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-[#1f304a]">
                <button
                  type="button"
                  onClick={() => setModalStep(wizardMode === 'simple' ? 1 : 2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleGenerateCycle}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                >
                  <Check className="w-4 h-4" />
                  Gerar Ciclo de Estudos
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Manual Mode */}
          {modalStep === 4 && (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Montar Ciclo Manualmente
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Adicione cada bloco de disciplina na ordem exata em que deseja estudar
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <select
                  value={newManualSessionSubjectId}
                  onChange={(e) => setNewManualSessionSubjectId(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Selecione uma disciplina...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.subject}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={newManualSessionDuration}
                  onChange={(e) => setNewManualSessionDuration(e.target.value)}
                  placeholder="Minutos"
                  className="w-28 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddManualSession}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shrink-0"
                >
                  + Adicionar Bloco
                </button>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-[260px] flex-1">
                {manualStudySessions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-[#1f304a] rounded-xl">
                    Nenhum bloco adicionado ainda.
                  </div>
                ) : (
                  manualStudySessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-5 rounded-full"
                          style={{ backgroundColor: session.color }}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {session.subject}
                        </span>
                        <span className="text-xs text-slate-400">{session.duration} min</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setManualStudySessions((prev) => [
                              ...prev,
                              { ...session, id: `${Date.now()}-${Math.random()}` },
                            ])
                          }
                          className="p-1.5 text-slate-400 hover:text-indigo-400"
                          title="Duplicar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setManualStudySessions((prev) =>
                              prev.filter((s) => s.id !== session.id)
                            )
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-500"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-[#1f304a]">
                <button
                  type="button"
                  onClick={() => setModalStep(0)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualCycle}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <Check className="w-4 h-4" />
                  Salvar Ciclo Manual
                </button>
              </div>
            </div>
          )}
        </div>

        <TopicWeightsModal
          isOpen={isTopicWeightsModalOpen}
          onClose={() => setIsTopicWeightsModalOpen(false)}
          subject={selectedSubjectForWeights}
        />
        </div>
      </div>
    </div>
  );
};

export default CycleCreationModal;
