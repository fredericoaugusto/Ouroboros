'use client';

import React, { useState, useEffect, useRef, Fragment, useMemo } from 'react';
import { getJsonContent, updateTopicDetailsAction } from '../app/actions';
import { useData, EditalTopic, StudyRecord } from '../context/DataContext';
import { useNotification } from '../context/NotificationContext';
import { useSidebar } from '../context/SidebarContext';
import { calculateSmartSessionReview } from '../lib/scoreEngine';
import AddReviewModal from './AddReviewModal';
import AddSubjectModal from './AddSubjectModal';
import ScoreTutorialModal from './ScoreTutorialModal';
import Breadcrumbs from './Breadcrumbs';
import {
  ArrowLeft,
  Calendar,
  Folder,
  Layers,
  Clock,
  FileText,
  BookOpen,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Sparkles,
  Check,
  HelpCircle,
  Info,
  ExternalLink,
} from 'lucide-react';

export type { StudyRecord };

interface Topic extends EditalTopic {}

interface Subject {
  id?: string;
  subject: string;
  topics: Topic[];
  color?: string;
}

interface VideoInput {
  title: string;
  start: string;
  end: string;
}

interface PageInput {
  start: string;
  end: string;
}

interface QuestionInput {
  correct: string;
  incorrect: string;
}

interface StudyRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (record: StudyRecord) => void;
  initialRecord?: Partial<StudyRecord> | null;
  topic?: { subject: string; topic: Topic } | null;
  initialTime?: number;
  justification?: string | null;
  showDeleteButton?: boolean;
}

// Máscara automática para inputs de tempo (digitar 004500 -> 00:45:00)
const applyTimeMask = (rawValue: string): string => {
  const digits = rawValue.replace(/\D/g, '').slice(0, 6);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`;
};

// Normaliza string parcial de tempo no onBlur (ex: "00:45" -> "00:45:00" ou "45" -> "00:45:00")
const normalizeTimeOnBlur = (val: string): string => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 2) {
    // Ex: digitou "45" -> 00:45:00
    const mins = Math.min(59, parseInt(digits, 10) || 0);
    return `00:${String(mins).padStart(2, '0')}:00`;
  }
  if (digits.length <= 4) {
    // Ex: digitou "0045" -> 00:45:00
    const padded = digits.padEnd(6, '0');
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
  }
  const padded = digits.padStart(6, '0').slice(0, 6);
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
};

// Componente de Checkbox Customizado Clean
const CustomCheckbox: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  badge?: string;
}> = ({ checked, onChange, label, badge }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none group"
  >
    <span
      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all duration-150 ${
        checked
          ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/25'
          : 'bg-slate-50 dark:bg-[#0c1421] border-slate-300 dark:border-[#263959] group-hover:border-emerald-500/60'
      }`}
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </span>
    <span>{label}</span>
    {badge && (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
        {badge}
      </span>
    )}
  </button>
);

// Item Hierárquico Limpo (sem setas brutas ↳)
const TopicSelectItem: React.FC<{
  topic: Topic;
  level: number;
  selectedTopic: string;
  onSelect: (topicText: string) => void;
}> = ({ topic, level, selectedTopic, onSelect }) => {
  const isGroupingTopic =
    topic.is_grouping_topic || (topic.sub_topics && topic.sub_topics.length > 0);
  const isSelected = selectedTopic === topic.topic_text;

  return (
    <Fragment>
      <div
        onClick={() => onSelect(topic.topic_text)}
        className={`group text-xs select-none relative py-2 pr-4 cursor-pointer transition-colors flex items-center gap-2 ${
          isSelected
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
            : 'hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400'
        } ${
          isGroupingTopic
            ? 'font-bold text-slate-900 dark:text-slate-100'
            : 'font-medium text-slate-600 dark:text-slate-300'
        }`}
        style={{ paddingLeft: `${level * 18 + 14}px` }}
      >
        {level > 0 && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-emerald-500 shrink-0 transition-colors"
          />
        )}
        <span className="block truncate">{topic.topic_text}</span>
        {topic.is_completed && (
          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 shrink-0">
            Concluído
          </span>
        )}
      </div>
      {topic.sub_topics &&
        topic.sub_topics.map((subTopic, index) => (
          <TopicSelectItem
            key={index}
            topic={subTopic}
            level={level + 1}
            selectedTopic={selectedTopic}
            onSelect={onSelect}
          />
        ))}
    </Fragment>
  );
};

const StudyRegisterModal: React.FC<StudyRegisterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRecord,
  topic: initialTopicData,
  initialTime: initialStudyTime,
  justification,
  showDeleteButton = false,
}) => {
  const getLocalYYYYMMDD = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Converte milissegundos em HH:MM:SS com precisão exata
  const formatTimeFromMs = (ms: number): string => {
    if (isNaN(ms) || ms <= 0) return '';
    const totalSeconds = Math.max(1, Math.round(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const parseTime = (timeStr: string): number => {
    const normalized = normalizeTimeOnBlur(timeStr);
    const parts = normalized.split(':').map(Number);
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    return 0;
  };

  const {
    selectedDataFile,
    studyRecords,
    simuladoRecords,
    addStudyRecord,
    updateStudyRecord,
    deleteStudyRecord,
    saveSubject,
    refreshPlans,
    initialStudyRecord: contextInitialRecord,
    setInitialStudyRecord,
  } = useData();
  const { showNotification } = useNotification();
  const { isSidebarExpanded } = useSidebar();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [isTeoriaFinalizada, setIsTeoriaFinalizada] = useState(false);
  const [countInPlanning, setCountInPlanning] = useState(true);
  const [autoScoreReview, setAutoScoreReview] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('teoria');
  const [studyTime, setStudyTime] = useState('');
  const [isReviewSchedulingEnabled, setIsReviewSchedulingEnabled] = useState(false);
  const [reviewPeriods, setReviewPeriods] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(getLocalYYYYMMDD());
  const [questions, setQuestions] = useState<QuestionInput[]>([{ correct: '', incorrect: '' }]);
  const [selectedErrorReasons, setSelectedErrorReasons] = useState<string[]>([]);
  const [pages, setPages] = useState<PageInput[]>([{ start: '', end: '' }]);
  const [videos, setVideos] = useState<VideoInput[]>([{ title: '', start: '', end: '' }]);
  const [material, setMaterial] = useState('');
  const [comments, setComments] = useState('');
  const [newNotebookUrl, setNewNotebookUrl] = useState('');
  const [firstStudyRelevance, setFirstStudyRelevance] = useState(3);
  const [firstStudyDifficulty, setFirstStudyDifficulty] = useState(3);
  const [firstStudyMastery, setFirstStudyMastery] = useState(3);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isCalendarPopoverOpen, setIsCalendarPopoverOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [isAddReviewModalOpen, setIsAddReviewModalOpen] = useState(false);
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [isScoreTutorialOpen, setIsScoreTutorialOpen] = useState(false);
  const [refreshSubjects, setRefreshSubjects] = useState(0);

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const subjectDropdownRef = useRef<HTMLDivElement>(null);
  const topicDropdownRef = useRef<HTMLDivElement>(null);
  const calendarPopoverRef = useRef<HTMLDivElement>(null);

  const categories = [
    { value: 'teoria', label: 'Teoria' },
    { value: 'questoes', label: 'Questões' },
    { value: 'revisao', label: 'Revisão' },
    { value: 'leitura_lei', label: 'Lei Seca' },
    { value: 'jurisprudencia', label: 'Jurisprudência' },
  ];

  const matchedTopicNode = useMemo(() => {
    if (!selectedTopic) return null;
    const findTopicNode = (list: Topic[]): Topic | null => {
      for (const t of list) {
        if (t.topic_text === selectedTopic) return t;
        if (t.sub_topics && t.sub_topics.length > 0) {
          const found = findTopicNode(t.sub_topics);
          if (found) return found;
        }
      }
      return null;
    };
    return findTopicNode(topics);
  }, [selectedTopic, topics]);

  const existingTopicRecords = useMemo(() => {
    if (!selectedSubject || !selectedTopic) return [];
    return (studyRecords || []).filter(
      (r) =>
        (!initialRecord?.id || r.id !== initialRecord.id) &&
        r.subject === selectedSubject &&
        r.topic === selectedTopic
    );
  }, [studyRecords, selectedSubject, selectedTopic, initialRecord?.id]);

  const isFirstStudyOfTopic = Boolean(
    selectedSubject && selectedTopic && existingTopicRecords.length === 0
  );
  const existingNotebookUrl = (matchedTopicNode as any)?.notebookUrl
    ? String((matchedTopicNode as any).notebookUrl).trim()
    : '';

  useEffect(() => {
    if (matchedTopicNode) {
      setFirstStudyRelevance((matchedTopicNode as any).relevance ?? 3);
      setFirstStudyDifficulty((matchedTopicNode as any).difficulty ?? 3);
      setFirstStudyMastery(
        (matchedTopicNode as any).perceivedMastery ?? (matchedTopicNode as any).mastery ?? 3
      );
      setNewNotebookUrl('');
    }
  }, [matchedTopicNode]);

  // Calcula o intervalo da próxima revisão automática pelo Score completo (histórico tópico + sessão + disciplina + simulados + R/D/P + perfil pessoal)
  const smartReviewEstimate = useMemo(() => {
    const corr = parseInt(questions[0]?.correct || '0', 10) || 0;
    const inc = parseInt(questions[0]?.incorrect || '0', 10) || 0;
    const allRecs = (studyRecords || []).filter(
      (r) => !initialRecord?.id || r.id !== initialRecord.id
    );
    const subjRecs = selectedSubject
      ? allRecs.filter((r) => r.subject === selectedSubject)
      : [];

    const effR = isFirstStudyOfTopic
      ? firstStudyRelevance
      : (matchedTopicNode as any)?.relevance ?? 3;
    const effD = isFirstStudyOfTopic
      ? firstStudyDifficulty
      : (matchedTopicNode as any)?.difficulty ?? 3;
    const effP = isFirstStudyOfTopic
      ? firstStudyMastery
      : (matchedTopicNode as any)?.perceivedMastery ?? (matchedTopicNode as any)?.mastery ?? 3;

    return calculateSmartSessionReview({
      sessionCorrect: corr,
      sessionIncorrect: inc,
      previousSessionsCount: existingTopicRecords.length,
      relevance: effR,
      difficulty: effD,
      perceivedMastery: effP,
      topicRecords: existingTopicRecords,
      subjectRecords: subjRecs,
      allStudyRecords: allRecs,
      simuladoRecords: simuladoRecords || [],
      subjectName: selectedSubject,
      topicName: selectedTopic,
    });
  }, [
    questions,
    studyRecords,
    simuladoRecords,
    selectedSubject,
    selectedTopic,
    matchedTopicNode,
    existingTopicRecords,
    isFirstStudyOfTopic,
    firstStudyRelevance,
    firstStudyDifficulty,
    firstStudyMastery,
    initialRecord?.id,
  ]);

  const estimatedAutoReviewDays = smartReviewEstimate.days;

  const handleDateSelect = (type: 'today' | 'yesterday') => {
    const today = new Date();
    let dateToSet = today;
    if (type === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      dateToSet = yesterday;
    }
    setSelectedDate(getLocalYYYYMMDD(dateToSet));
    setShowDatePicker(false);
    setIsCalendarPopoverOpen(false);
  };

  const resetForm = () => {
    setSelectedSubject('');
    setSelectedTopic('');
    setIsTeoriaFinalizada(false);
    setCountInPlanning(true);
    setAutoScoreReview(true);
    setSelectedCategory('teoria');
    setStudyTime('');
    setIsReviewSchedulingEnabled(false);
    setReviewPeriods([]);
    setSelectedDate(getLocalYYYYMMDD());
    setQuestions([{ correct: '', incorrect: '' }]);
    setPages([{ start: '', end: '' }]);
    setVideos([{ title: '', start: '', end: '' }]);
    setMaterial('');
    setComments('');
    setErrors({});
    setShowDatePicker(false);
    setIsCalendarPopoverOpen(false);
  };

  useEffect(() => {
    const fetchEditalData = async () => {
      if (selectedDataFile) {
        try {
          const data = await getJsonContent(selectedDataFile);
          let loadedSubjects: Subject[] = [];
          if (Array.isArray(data)) {
            loadedSubjects = data;
          } else if (data && typeof data === 'object' && Array.isArray(data.subjects)) {
            loadedSubjects = data.subjects;
          }
          setSubjects(loadedSubjects);
        } catch (error) {
          console.error('Error fetching edital data:', error);
          setSubjects([]);
        }
      } else {
        setSubjects([]);
      }
    };
    fetchEditalData();
  }, [selectedDataFile, refreshSubjects]);

  useEffect(() => {
    if (selectedSubject) {
      const subjectData = subjects.find((s) => s.subject === selectedSubject);
      setTopics(subjectData?.topics || []);
    } else {
      setTopics([]);
    }
  }, [selectedSubject, subjects]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      const effectiveRecord = initialRecord || contextInitialRecord;
      if (effectiveRecord) {
        setSelectedSubject(effectiveRecord.subject || '');
        setSelectedTopic(effectiveRecord.topic || '');
        setIsTeoriaFinalizada(effectiveRecord.teoriaFinalizada ?? false);
        setCountInPlanning(effectiveRecord.countInPlanning ?? true);
        setSelectedCategory(effectiveRecord.category || 'teoria');
        setStudyTime(
          effectiveRecord.studyTime && effectiveRecord.studyTime > 0
            ? formatTimeFromMs(effectiveRecord.studyTime)
            : ''
        );
        setIsReviewSchedulingEnabled(!!effectiveRecord.reviewPeriods?.length);
        setReviewPeriods(effectiveRecord.reviewPeriods ?? []);
        const recDate = effectiveRecord.date || getLocalYYYYMMDD();
        setSelectedDate(recDate);
        const [ry, rm, rd] = recDate.split('-').map(Number);
        if (ry && rm && rd) setCalendarViewDate(new Date(ry, rm - 1, rd));

        const today = getLocalYYYYMMDD();
        const yesterday = getLocalYYYYMMDD(new Date(new Date().setDate(new Date().getDate() - 1)));
        setShowDatePicker(Boolean(recDate !== today && recDate !== yesterday));

        const total = effectiveRecord.questions?.total || 0;
        const correct = effectiveRecord.questions?.correct || 0;
        const incorrect = Math.max(0, total - correct);
        setQuestions([
          {
            correct: total > 0 || correct > 0 ? String(correct) : '',
            incorrect: total > 0 || incorrect > 0 ? String(incorrect) : '',
          },
        ]);
        setPages(
          effectiveRecord.pages && effectiveRecord.pages.length > 0
            ? effectiveRecord.pages.map((p) => ({
                start: p.start > 0 ? String(p.start) : '',
                end: p.end > 0 ? String(p.end) : '',
              }))
            : [{ start: '', end: '' }]
        );
        setVideos(
          effectiveRecord.videos && effectiveRecord.videos.length > 0
            ? effectiveRecord.videos.map((v) => ({
                title: v.title || '',
                start: v.start && v.start !== '00:00:00' ? v.start : '',
                end: v.end && v.end !== '00:00:00' ? v.end : '',
              }))
            : [{ title: '', start: '', end: '' }]
        );
        setComments(effectiveRecord.notes || '');
        setSelectedErrorReasons(effectiveRecord.errorReasons || []);
      } else if (initialTopicData) {
        setSelectedErrorReasons([]);
        setSelectedSubject(initialTopicData.subject);
        setSelectedTopic(initialTopicData.topic.topic_text);
        setStudyTime(
          initialStudyTime && initialStudyTime > 0 ? formatTimeFromMs(initialStudyTime) : ''
        );
      } else if (initialStudyTime && initialStudyTime > 0) {
        setSelectedErrorReasons([]);
        setStudyTime(formatTimeFromMs(initialStudyTime));
      } else {
        setSelectedErrorReasons([]);
      }
    }
  }, [isOpen, initialRecord, contextInitialRecord, initialTopicData, initialStudyTime]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node))
        setIsCategoryDropdownOpen(false);
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(event.target as Node))
        setIsSubjectDropdownOpen(false);
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(event.target as Node))
        setIsTopicDropdownOpen(false);
      if (calendarPopoverRef.current && !calendarPopoverRef.current.contains(event.target as Node))
        setIsCalendarPopoverOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const addPagePair = () => setPages([...pages, { start: '', end: '' }]);
  const addVideoRow = () => setVideos([...videos, { title: '', start: '', end: '' }]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const normalizedTime = normalizeTimeOnBlur(studyTime);
    const timeRegex = /^([0-9]{2}):[0-5][0-9]:[0-5][0-9]$/;
    if (!selectedSubject) newErrors.subject = 'Selecione uma disciplina';
    if (!selectedCategory) newErrors.category = 'Selecione uma categoria';
    if (!normalizedTime || normalizedTime === '00:00:00') {
      newErrors.studyTime = 'Informe o tempo de estudo';
    } else if (!timeRegex.test(normalizedTime)) {
      newErrors.studyTime = 'Use o formato HH:MM:SS';
    }
    if (selectedSubject && !selectedTopic && topics.length > 0) {
      newErrors.topic = 'Selecione um tópico do edital';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    const normalizedTime = normalizeTimeOnBlur(studyTime);
    if (normalizedTime !== studyTime) {
      setStudyTime(normalizedTime);
    }
    if (!validateForm()) return;

    const matchedSub = subjects.find((s) => s.subject === selectedSubject);
    const corrNum = parseInt(questions[0]?.correct || '0', 10) || 0;
    const incNum = parseInt(questions[0]?.incorrect || '0', 10) || 0;

    // Combina revisão automática pelo Score e/ou revisões manuais
    let finalReviewPeriods: string[] | undefined = undefined;
    if (isReviewSchedulingEnabled && reviewPeriods.length > 0) {
      finalReviewPeriods = reviewPeriods;
    } else if (autoScoreReview) {
      finalReviewPeriods = [`${estimatedAutoReviewDays}d`];
    }

    const studyRecord: StudyRecord = {
      id: initialRecord?.id || '',
      date: selectedDate,
      subjectId: matchedSub?.id || initialRecord?.subjectId || '',
      subject: selectedSubject,
      topic: selectedTopic || 'Estudo Geral',
      studyTime: parseTime(normalizedTime),
      questions: {
        correct: corrNum,
        total: corrNum + incNum,
      },
      notes: comments,
      category: selectedCategory,
      reviewPeriods: finalReviewPeriods,
      teoriaFinalizada: isTeoriaFinalizada,
      countInPlanning: countInPlanning,
      errorReasons: incNum > 0 ? selectedErrorReasons : [],
      pages: pages
        .map((p) => ({
          start: parseInt(p.start || '0', 10) || 0,
          end: parseInt(p.end || '0', 10) || 0,
        }))
        .filter((p) => p.start > 0 || p.end > 0),
      videos: videos
        .map((v) => ({
          title: v.title,
          start: normalizeTimeOnBlur(v.start) || '00:00:00',
          end: normalizeTimeOnBlur(v.end) || '00:00:00',
        }))
        .filter((v) => v.title),
    };
    if (onSave) {
      onSave(studyRecord);
    } else if (studyRecord.id) {
      updateStudyRecord(studyRecord);
    } else {
      addStudyRecord(studyRecord);
    }

    // Se for o 1º registro do tópico OU se o usuário cadastrou o link do caderno de questões agora, persiste no tópico do Edital
    if (selectedDataFile && selectedSubject && selectedTopic) {
      const topicUpdates: Record<string, any> = {};
      if (isFirstStudyOfTopic) {
        topicUpdates.relevance = firstStudyRelevance;
        topicUpdates.difficulty = firstStudyDifficulty;
        topicUpdates.perceivedMastery = firstStudyMastery;
        topicUpdates.mastery = firstStudyMastery;
      }
      if (!existingNotebookUrl && newNotebookUrl.trim()) {
        topicUpdates.notebookUrl = newNotebookUrl.trim();
      }
      if (Object.keys(topicUpdates).length > 0) {
        updateTopicDetailsAction(
          selectedDataFile,
          selectedSubject,
          selectedTopic,
          topicUpdates
        ).then(() => {
          if (refreshPlans) refreshPlans();
        });
      }
    }

    if (setInitialStudyRecord) {
      setInitialStudyRecord(null);
    }
    onClose();
  };

  const handleDelete = () => {
    if (initialRecord?.id && window.confirm('Tem certeza que deseja excluir este registro?')) {
      deleteStudyRecord(initialRecord.id);
      onClose();
    }
  };

  const handleAddReview = (days: number) => {
    setReviewPeriods((prev) => [...prev, `${days}d`]);
    setIsAddReviewModalOpen(false);
  };

  const handleAddSubject = async (subjectName: string, newTopics: Topic[], color: string) => {
    if (!saveSubject) return;
    const result = await saveSubject({ subject: subjectName, topics: newTopics, color });
    if (result.success) {
      setIsAddSubjectModalOpen(false);
      setSelectedSubject(subjectName);
      setRefreshSubjects((prev) => prev + 1);
    }
  };

  // Utilitários do Calendário Customizado
  const formatDisplayDate = (yyyyMmDd: string) => {
    const [y, m, d] = yyyyMmDd.split('-');
    if (!y || !m || !d) return yyyyMmDd;
    return `${d}/${m}/${y}`;
  };

  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number | null; dateStr: string }[] = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ day: null, dateStr: '' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr });
    }
    return cells;
  }, [calendarViewDate]);

  if (!isOpen) return null;

  const isToday = selectedDate === getLocalYYYYMMDD() && !showDatePicker;
  const isYesterday =
    selectedDate === getLocalYYYYMMDD(new Date(new Date().setDate(new Date().getDate() - 1))) &&
    !showDatePicker;

  return (
    <>
      <div
        className={`fixed top-0 right-0 bottom-14 ${
          isSidebarExpanded ? 'lg:left-64 left-0' : 'left-0'
        } bg-[#f8fafc] dark:bg-[#0b1320] z-30 overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fadeIn transition-all duration-300`}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Breadcrumbs
              items={[
                { label: 'Estudos', onClick: onClose },
                ...(selectedSubject ? [{ label: selectedSubject, onClick: onClose }] : []),
                { label: initialRecord?.id ? 'Editar Registro' : 'Registrar Estudo' },
              ]}
              className="mb-0"
            />
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
            >
              <ArrowLeft size={14} />
              Voltar
            </button>
          </div>

          <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl shadow-sm w-full flex flex-col">
            {/* Header Clean */}
            <div className="flex justify-between items-start px-6 py-4 border-b border-slate-100 dark:border-[#1a293e]">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Registro de Estudo
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Preencha os detalhes da sessão para contabilizar seu tempo, questões e avanço no edital
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {justification && (
                <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs flex items-center gap-2.5">
                  <Sparkles size={16} className="flex-shrink-0 text-indigo-500" />
                  <span>{justification}</span>
                </div>
              )}

              {/* Barra de Data: Hoje | Ontem | Outro (Com Calendário Customizado) */}
              <div className="flex items-center gap-2.5 flex-wrap relative" ref={calendarPopoverRef}>
                <Calendar size={16} className="text-slate-400" />
                <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a]">
                  <button
                    type="button"
                    onClick={() => handleDateSelect('today')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isToday
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateSelect('yesterday')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isYesterday
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Ontem
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDatePicker(true);
                      setIsCalendarPopoverOpen(true);
                    }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      showDatePicker
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Outro
                  </button>
                </div>

                {showDatePicker && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCalendarPopoverOpen((prev) => !prev)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-[#0c1421] border border-emerald-500/40 text-slate-800 dark:text-slate-100 hover:border-emerald-500 transition-colors shadow-sm"
                    >
                      <Calendar size={14} className="text-emerald-500" />
                      <span>{formatDisplayDate(selectedDate)}</span>
                      <ChevronDown size={13} className="text-slate-400" />
                    </button>

                    {isCalendarPopoverOpen && (
                      <div className="absolute left-0 top-full mt-2 z-50 w-72 p-4 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] shadow-2xl animate-fadeIn">
                        {/* Cabeçalho Mês/Ano */}
                        <div className="flex items-center justify-between mb-3">
                          <button
                            type="button"
                            onClick={() =>
                              setCalendarViewDate(
                                new Date(
                                  calendarViewDate.getFullYear(),
                                  calendarViewDate.getMonth() - 1,
                                  1
                                )
                              )
                            }
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2942] text-slate-500 dark:text-slate-300"
                          >
                            <ChevronLeft size={15} />
                          </button>
                          <span className="text-xs font-extrabold capitalize text-slate-800 dark:text-white">
                            {calendarViewDate.toLocaleDateString('pt-BR', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCalendarViewDate(
                                new Date(
                                  calendarViewDate.getFullYear(),
                                  calendarViewDate.getMonth() + 1,
                                  1
                                )
                              )
                            }
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2942] text-slate-500 dark:text-slate-300"
                          >
                            <ChevronRight size={15} />
                          </button>
                        </div>

                        {/* Dias da Semana */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-bold text-slate-400 dark:text-slate-500 py-1"
                            >
                              {d}
                            </span>
                          ))}
                        </div>

                        {/* Grade de Dias */}
                        <div className="grid grid-cols-7 gap-1">
                          {calendarDays.map((cell, idx) => {
                            if (!cell.day) {
                              return <div key={idx} className="h-8" />;
                            }
                            const isSelectedDay = cell.dateStr === selectedDate;
                            const isCurrentToday = cell.dateStr === getLocalYYYYMMDD();
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSelectedDate(cell.dateStr);
                                  setIsCalendarPopoverOpen(false);
                                }}
                                className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                                  isSelectedDay
                                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                                    : isCurrentToday
                                    ? 'border border-emerald-500/50 text-emerald-500 font-extrabold'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2942]'
                                }`}
                              >
                                {cell.day}
                              </button>
                            );
                          })}
                        </div>

                        {/* Rodapé do Calendário */}
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-[#1f304a]">
                          <button
                            type="button"
                            onClick={() => handleDateSelect('today')}
                            className="text-[11px] font-bold text-emerald-500 hover:underline"
                          >
                            Ir para Hoje
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCalendarPopoverOpen(false)}
                            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Linha 1: Categoria, Disciplina e Tempo */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                {/* Categoria (3 cols) */}
                <div className="sm:col-span-3" ref={categoryDropdownRef}>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Categoria
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] text-xs font-medium text-slate-800 dark:text-slate-100 hover:border-emerald-500/50 transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Folder size={14} className="text-slate-400 flex-shrink-0" />
                        {categories.find((c) => c.value === selectedCategory)?.label || 'Teoria'}
                      </span>
                      <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
                    </button>
                    {isCategoryDropdownOpen && (
                      <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-xl shadow-xl py-1 overflow-hidden">
                        {categories.map((cat) => (
                          <div
                            key={cat.value}
                            onClick={() => {
                              setSelectedCategory(cat.value);
                              setIsCategoryDropdownOpen(false);
                            }}
                            className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-500 cursor-pointer transition-colors"
                          >
                            {cat.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Disciplina (6 cols) */}
                <div className="sm:col-span-6" ref={subjectDropdownRef}>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Disciplina
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-grow min-w-0">
                      <button
                        type="button"
                        onClick={() => setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border ${
                          errors.subject
                            ? 'border-rose-500'
                            : 'border-slate-200 dark:border-[#1f304a]'
                        } text-xs font-medium text-slate-800 dark:text-slate-100 hover:border-emerald-500/50 transition-colors`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Layers size={14} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            {selectedSubject || 'Selecione a disciplina...'}
                          </span>
                        </span>
                        <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
                      </button>
                      {isSubjectDropdownOpen && (
                        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-xl shadow-xl max-h-56 overflow-y-auto py-1">
                          {subjects.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400">
                              Nenhuma disciplina cadastrada
                            </div>
                          ) : (
                            subjects.map((sub, index) => (
                              <div
                                key={index}
                                onClick={() => {
                                  setSelectedSubject(sub.subject);
                                  setIsSubjectDropdownOpen(false);
                                  setSelectedTopic('');
                                }}
                                className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-500 cursor-pointer flex items-center gap-2 transition-colors"
                              >
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: sub.color || '#10b981' }}
                                />
                                <span className="truncate">{sub.subject}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddSubjectModalOpen(true)}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#0c1421] hover:bg-emerald-500/15 text-slate-600 dark:text-slate-300 hover:text-emerald-500 border border-slate-200 dark:border-[#1f304a] transition-colors flex-shrink-0"
                      title="Criar nova disciplina"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  {errors.subject && (
                    <p className="mt-1 text-[11px] text-rose-500">{errors.subject}</p>
                  )}
                </div>

                {/* Tempo de Estudo com Máscara Automática (3 cols) */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tempo de estudo
                  </label>
                  <div className="relative">
                    <Clock
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={studyTime}
                      onChange={(e) => setStudyTime(applyTimeMask(e.target.value))}
                      onBlur={() => {
                        if (studyTime) setStudyTime(normalizeTimeOnBlur(studyTime));
                      }}
                      placeholder="00:00:00"
                      className={`w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border ${
                        errors.studyTime
                          ? 'border-rose-500'
                          : 'border-slate-200 dark:border-[#1f304a]'
                      } text-xs font-mono font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    />
                  </div>
                  {errors.studyTime && (
                    <p className="mt-1 text-[11px] text-rose-500">{errors.studyTime}</p>
                  )}
                </div>
              </div>

              {/* Linha 2: Tópico e Material */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                {/* Tópico (8 cols) */}
                <div className="sm:col-span-8" ref={topicDropdownRef}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Tópico
                    </label>
                    {existingNotebookUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const url = existingNotebookUrl.startsWith('http')
                            ? existingNotebookUrl
                            : `https://${existingNotebookUrl}`;
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                        title="Abrir Caderno de Questões já cadastrado neste tópico"
                      >
                        <ExternalLink size={12} />
                        Abrir Caderno de Questões
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      disabled={!selectedSubject}
                      onClick={() => setIsTopicDropdownOpen(!isTopicDropdownOpen)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border ${
                        errors.topic
                          ? 'border-rose-500'
                          : 'border-slate-200 dark:border-[#1f304a]'
                      } text-xs font-medium text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:border-emerald-500/50 transition-colors`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FileText size={14} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {selectedTopic || 'Selecione um tópico do edital...'}
                        </span>
                      </span>
                      <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
                    </button>
                    {isTopicDropdownOpen && (
                      <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-xl shadow-xl max-h-64 overflow-y-auto py-1.5 divide-y divide-slate-100/60 dark:divide-[#1a293e]/50">
                        {topics.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-400">
                            Nenhum tópico nesta disciplina
                          </div>
                        ) : (
                          topics.map((topic, index) => (
                            <TopicSelectItem
                              key={index}
                              topic={topic}
                              level={0}
                              selectedTopic={selectedTopic}
                              onSelect={(topicText) => {
                                setSelectedTopic(topicText);
                                setIsTopicDropdownOpen(false);
                              }}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {errors.topic && (
                    <p className="mt-1 text-[11px] text-rose-500">{errors.topic}</p>
                  )}
                </div>

                {/* Material (4 cols) */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Material <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <BookOpen
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Ex.: PDF Aula 01"
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Opção de Cadastrar Link do Caderno de Questões (Apenas se o tópico AINDA NÃO tiver um cadastrado) */}
              {selectedSubject && selectedTopic && !existingNotebookUrl && (
                <div className="p-3 rounded-xl bg-indigo-500/[0.04] border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <div className="flex items-center gap-2 shrink-0">
                    <ExternalLink size={14} className="text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Link do Caderno de Questões <span className="text-slate-400 font-normal">(opcional)</span>:
                    </span>
                  </div>
                  <input
                    type="url"
                    value={newNotebookUrl}
                    onChange={(e) => setNewNotebookUrl(e.target.value)}
                    placeholder="Cole o link do TEC / QConcursos para salvar direto neste tópico..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Calibração Inicial do 1º Estudo do Tópico (Relevância, Dificuldade e Domínio 0-5) */}
              {isFirstStudyOfTopic && (
                <div className="p-3.5 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/25 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Sparkles size={14} />
                      1º Registro neste Tópico — Calibre o Score Inicial (0 a 5)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Salvo automaticamente no Cockpit do tópico
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Relevância */}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a]">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Relevância na Prova
                        </span>
                        <strong className="text-amber-500">{firstStudyRelevance}/5</strong>
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {[0, 1, 2, 3, 4, 5].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFirstStudyRelevance(v)}
                            className={`py-1 rounded text-[11px] font-bold border transition-all ${
                              firstStudyRelevance === v
                                ? 'bg-amber-500/20 border-amber-500 text-amber-500'
                                : 'bg-slate-50 dark:bg-[#131f33] border-slate-200 dark:border-[#1f304a] text-slate-400'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dificuldade */}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a]">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Dificuldade Pessoal
                        </span>
                        <strong className="text-rose-500">{firstStudyDifficulty}/5</strong>
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {[0, 1, 2, 3, 4, 5].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFirstStudyDifficulty(v)}
                            className={`py-1 rounded text-[11px] font-bold border transition-all ${
                              firstStudyDifficulty === v
                                ? 'bg-rose-500/20 border-rose-500 text-rose-500'
                                : 'bg-slate-50 dark:bg-[#131f33] border-slate-200 dark:border-[#1f304a] text-slate-400'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Domínio Declarado */}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a]">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Domínio Sentido
                        </span>
                        <strong className="text-emerald-500">{firstStudyMastery}/5</strong>
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {[0, 1, 2, 3, 4, 5].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFirstStudyMastery(v)}
                            className={`py-1 rounded text-[11px] font-bold border transition-all ${
                              firstStudyMastery === v
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500'
                                : 'bg-slate-50 dark:bg-[#131f33] border-slate-200 dark:border-[#1f304a] text-slate-400'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Checkboxes Customizados Modernos */}
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <CustomCheckbox
                  checked={isTeoriaFinalizada}
                  onChange={setIsTeoriaFinalizada}
                  label="Teoria finalizada"
                />

                <CustomCheckbox
                  checked={countInPlanning}
                  onChange={setCountInPlanning}
                  label="Contabilizar no planejamento"
                />

                <div className="inline-flex items-center gap-1.5">
                  <CustomCheckbox
                    checked={autoScoreReview}
                    onChange={(val) => {
                      setAutoScoreReview(val);
                      if (val) setIsReviewSchedulingEnabled(false);
                    }}
                    label="Revisão inteligente pelo Score"
                    badge={`+${estimatedAutoReviewDays || 7}d • ${smartReviewEstimate?.tierLabel || 'Consolidação'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setIsScoreTutorialOpen(true)}
                    className="p-1 rounded-full text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                    title="Entenda como o intervalo de revisão e o Score são calculados"
                  >
                    <HelpCircle size={14} />
                  </button>
                </div>

                <CustomCheckbox
                  checked={isReviewSchedulingEnabled}
                  onChange={(val) => {
                    setIsReviewSchedulingEnabled(val);
                    if (val) setAutoScoreReview(false);
                  }}
                  label="Revisões manuais fixas"
                />
              </div>

              {autoScoreReview && (
                <div className="p-3 rounded-xl bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08] border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-start sm:items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Info size={14} className="text-emerald-500 shrink-0 mt-0.5 sm:mt-0" />
                    <span>
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        Por que +{estimatedAutoReviewDays || 7} dias ({smartReviewEstimate?.tierLabel || 'Consolidação'})?
                      </strong>{' '}
                      {smartReviewEstimate?.reason || 'Calculado pelo algoritmo com base no seu histórico e curva de esquecimento.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScoreTutorialOpen(true)}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 self-end sm:self-center"
                  >
                    Ver regras do algoritmo →
                  </button>
                </div>
              )}

              {isReviewSchedulingEnabled && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a]">
                  {reviewPeriods.map((period, index) => (
                    <span
                      key={index}
                      className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5"
                    >
                      {period}
                      <button
                        type="button"
                        onClick={() =>
                          setReviewPeriods((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="hover:text-rose-400"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsAddReviewModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Plus size={12} /> Adicionar dia
                  </button>
                </div>
              )}

              {/* Linha 3: Questões, Páginas e Videoaulas (Com Placeholders Limpos) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                {/* Card Questões (4 cols) */}
                <div className="md:col-span-4 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] space-y-2.5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Questões <span className="text-slate-400 font-normal">(opcional)</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">Acertos / Erros</p>
                  </div>
                  {questions.map((q, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={q.correct}
                        onChange={(e) => {
                          const next = [...questions];
                          next[index].correct = e.target.value.replace(/\D/g, '');
                          setQuestions(next);
                        }}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs font-bold text-center text-emerald-500 placeholder:text-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={q.incorrect}
                        onChange={(e) => {
                          const next = [...questions];
                          next[index].incorrect = e.target.value.replace(/\D/g, '');
                          setQuestions(next);
                        }}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs font-bold text-center text-rose-500 placeholder:text-rose-500/40 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                  ))}

                  {/* Diagnóstico de Erros (aparece se houver questões erradas) */}
                  {parseInt(questions[0]?.incorrect || '0', 10) > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-[#1f304a] space-y-1.5 animate-fadeIn">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
                        Motivo do Erro:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { id: 'teoria', label: '📚 Teoria' },
                          { id: 'letra_lei', label: '⚖️ Lei Seca' },
                          { id: 'jurisprudencia', label: '🏛️ Juris' },
                          { id: 'atencao', label: '⚡ Atenção' },
                        ].map((chip) => {
                          const isSel = selectedErrorReasons.includes(chip.id);
                          return (
                            <button
                              key={chip.id}
                              type="button"
                              onClick={() =>
                                setSelectedErrorReasons((prev) =>
                                  isSel ? prev.filter((r) => r !== chip.id) : [...prev, chip.id]
                                )
                              }
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                                isSel
                                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                                  : 'bg-white dark:bg-[#131f33] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#243552] hover:border-rose-400'
                              }`}
                            >
                              {chip.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Páginas (3 cols) */}
                <div className="md:col-span-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Páginas
                      </h3>
                      <p className="text-[10px] text-slate-400">Início / Fim</p>
                    </div>
                    <button
                      type="button"
                      onClick={addPagePair}
                      className="p-1 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {pages.map((p, index) => (
                    <div key={index} className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={p.start}
                        onChange={(e) => {
                          const next = [...pages];
                          next[index].start = e.target.value.replace(/\D/g, '');
                          setPages(next);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs text-center text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={p.end}
                        onChange={(e) => {
                          const next = [...pages];
                          next[index].end = e.target.value.replace(/\D/g, '');
                          setPages(next);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs text-center text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  ))}
                </div>

                {/* Card Videoaulas com Máscara Automática HH:MM:SS (5 cols) */}
                <div className="md:col-span-5 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Videoaulas <span className="text-slate-400 font-normal">(opcional)</span>
                      </h3>
                      <p className="text-[10px] text-slate-400">Título / Início / Fim</p>
                    </div>
                    <button
                      type="button"
                      onClick={addVideoRow}
                      className="p-1 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {videos.map((v, index) => (
                    <div key={index} className="grid grid-cols-3 gap-1.5">
                      <input
                        type="text"
                        placeholder="Aula"
                        value={v.title}
                        onChange={(e) => {
                          const next = [...videos];
                          next[index] = { ...next[index], title: e.target.value };
                          setVideos(next);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="00:00:00"
                        value={v.start}
                        onChange={(e) => {
                          const next = [...videos];
                          next[index] = { ...next[index], start: applyTimeMask(e.target.value) };
                          setVideos(next);
                        }}
                        onBlur={() => {
                          if (v.start) {
                            const next = [...videos];
                            next[index] = {
                              ...next[index],
                              start: normalizeTimeOnBlur(v.start),
                            };
                            setVideos(next);
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-[11px] font-mono text-center text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="00:00:00"
                        value={v.end}
                        onChange={(e) => {
                          const next = [...videos];
                          next[index] = { ...next[index], end: applyTimeMask(e.target.value) };
                          setVideos(next);
                        }}
                        onBlur={() => {
                          if (v.end) {
                            const next = [...videos];
                            next[index] = {
                              ...next[index],
                              end: normalizeTimeOnBlur(v.end),
                            };
                            setVideos(next);
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-[11px] font-mono text-center text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Comentários */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Comentários <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Adicione observações sobre o seu estudo..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Footer Clean */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 dark:border-[#1a293e] bg-slate-50/50 dark:bg-[#0c1421]/50 rounded-b-2xl">
              <div>
                {initialRecord?.id && showDeleteButton && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white text-xs font-bold transition-colors"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
                >
                  Salvar estudo
                </button>
              </div>
            </div>
          </div>
        </div>

        {isAddReviewModalOpen && (
          <AddReviewModal
            isOpen={isAddReviewModalOpen}
            onClose={() => setIsAddReviewModalOpen(false)}
            onSave={handleAddReview}
          />
        )}
        <AddSubjectModal
          isOpen={isAddSubjectModalOpen}
          onClose={() => setIsAddSubjectModalOpen(false)}
          onSave={handleAddSubject}
        />
        <ScoreTutorialModal
          isOpen={isScoreTutorialOpen}
          onClose={() => setIsScoreTutorialOpen(false)}
        />
      </div>
    </>
  );
};

export default StudyRegisterModal;
