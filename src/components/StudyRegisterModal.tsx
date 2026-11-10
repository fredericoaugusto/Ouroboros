'use client';

import React, { useState, useEffect, useRef, Fragment } from 'react';
import { getJsonContent } from '../app/actions';
import { useData, EditalTopic, StudyRecord } from '../context/DataContext';
import { useNotification } from '../context/NotificationContext';
import AddReviewModal from './AddReviewModal';
import AddSubjectModal from './AddSubjectModal';
import Breadcrumbs from './Breadcrumbs';
import {
  X,
  ArrowLeft,
  Calendar,
  Folder,
  Layers,
  Clock,
  FileText,
  BookOpen,
  Plus,
  ChevronDown,
  Trash2,
  Sparkles,
} from 'lucide-react';

export type { StudyRecord };

interface Topic extends EditalTopic {}

interface Subject {
  id?: string;
  subject: string;
  topics: Topic[];
  color?: string;
}

interface Video {
  title: string;
  start: string;
  end: string;
}

interface Page {
  start: number;
  end: number;
}

interface Question {
  correct: number;
  incorrect: number;
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

const TopicSelectItem: React.FC<{
  topic: Topic;
  level: number;
  onSelect: (topicText: string) => void;
}> = ({ topic, level, onSelect }) => {
  const isGroupingTopic = topic.is_grouping_topic || (topic.sub_topics && topic.sub_topics.length > 0);

  return (
    <Fragment>
      <div
        onClick={() => {
          onSelect(topic.topic_text);
        }}
        className={`text-xs select-none relative py-2 pr-4 cursor-pointer transition-colors hover:bg-emerald-500/10 hover:text-emerald-500 ${
          isGroupingTopic
            ? 'font-bold text-slate-800 dark:text-slate-200'
            : 'text-slate-700 dark:text-slate-300'
        }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        <span className="block truncate">
          {level > 0 ? `↳ ${topic.topic_text}` : topic.topic_text}
        </span>
      </div>
      {topic.sub_topics &&
        topic.sub_topics.map((subTopic, index) => (
          <TopicSelectItem key={index} topic={subTopic} level={level + 1} onSelect={onSelect} />
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

  const formatTime = (msOrSec: number): string => {
    if (isNaN(msOrSec) || msOrSec <= 0) return '00:00:00';
    // Se vier em segundos (< 86400) ou milissegundos
    const totalSeconds = msOrSec > 86400 ? Math.floor(msOrSec / 1000) : Math.floor(msOrSec);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    return 0;
  };

  const {
    selectedDataFile,
    addStudyRecord,
    updateStudyRecord,
    deleteStudyRecord,
    saveSubject,
    initialStudyRecord: contextInitialRecord,
    setInitialStudyRecord,
  } = useData();
  const { showNotification } = useNotification();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [isTeoriaFinalizada, setIsTeoriaFinalizada] = useState(false);
  const [countInPlanning, setCountInPlanning] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('teoria');
  const [studyTime, setStudyTime] = useState('00:45:00');
  const [isReviewSchedulingEnabled, setIsReviewSchedulingEnabled] = useState(false);
  const [reviewPeriods, setReviewPeriods] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(getLocalYYYYMMDD());
  const [questions, setQuestions] = useState<Question[]>([{ correct: 0, incorrect: 0 }]);
  const [pages, setPages] = useState<Page[]>([{ start: 0, end: 0 }]);
  const [videos, setVideos] = useState<Video[]>([{ title: '', start: '00:00:00', end: '00:00:00' }]);
  const [material, setMaterial] = useState('');
  const [comments, setComments] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isAddReviewModalOpen, setIsAddReviewModalOpen] = useState(false);
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [refreshSubjects, setRefreshSubjects] = useState(0);

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const subjectDropdownRef = useRef<HTMLDivElement>(null);
  const topicDropdownRef = useRef<HTMLDivElement>(null);

  const categories = [
    { value: 'teoria', label: 'Teoria' },
    { value: 'questoes', label: 'Questões' },
    { value: 'revisao', label: 'Revisão' },
    { value: 'leitura_lei', label: 'Lei Seca' },
    { value: 'jurisprudencia', label: 'Jurisprudência' },
  ];

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
  };

  const resetForm = () => {
    setSelectedSubject('');
    setSelectedTopic('');
    setIsTeoriaFinalizada(false);
    setCountInPlanning(true);
    setSelectedCategory('teoria');
    setStudyTime('00:45:00');
    setIsReviewSchedulingEnabled(false);
    setReviewPeriods([]);
    setSelectedDate(getLocalYYYYMMDD());
    setQuestions([{ correct: 0, incorrect: 0 }]);
    setPages([{ start: 0, end: 0 }]);
    setVideos([{ title: '', start: '00:00:00', end: '00:00:00' }]);
    setMaterial('');
    setComments('');
    setErrors({});
    setShowDatePicker(false);
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
        setStudyTime(effectiveRecord.studyTime ? formatTime(effectiveRecord.studyTime) : '00:45:00');
        setIsReviewSchedulingEnabled(!!effectiveRecord.reviewPeriods?.length);
        setReviewPeriods(effectiveRecord.reviewPeriods ?? []);
        setSelectedDate(effectiveRecord.date || getLocalYYYYMMDD());
        const today = getLocalYYYYMMDD();
        const yesterday = getLocalYYYYMMDD(new Date(new Date().setDate(new Date().getDate() - 1)));
        setShowDatePicker(
          Boolean(effectiveRecord.date && effectiveRecord.date !== today && effectiveRecord.date !== yesterday)
        );
        const total = effectiveRecord.questions?.total || 0;
        const correct = effectiveRecord.questions?.correct || 0;
        setQuestions([{ correct: correct, incorrect: Math.max(0, total - correct) }]);
        setPages(
          effectiveRecord.pages && effectiveRecord.pages.length > 0
            ? effectiveRecord.pages
            : [{ start: 0, end: 0 }]
        );
        setVideos(
          effectiveRecord.videos && effectiveRecord.videos.length > 0
            ? effectiveRecord.videos
            : [{ title: '', start: '00:00:00', end: '00:00:00' }]
        );
        setComments(effectiveRecord.notes || '');
      } else if (initialTopicData) {
        setSelectedSubject(initialTopicData.subject);
        setSelectedTopic(initialTopicData.topic.topic_text);
        setStudyTime(initialStudyTime ? formatTime(initialStudyTime) : '00:45:00');
      } else if (initialStudyTime) {
        setStudyTime(formatTime(initialStudyTime));
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
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const addPagePair = () => setPages([...pages, { start: 0, end: 0 }]);
  const addVideoRow = () => setVideos([...videos, { title: '', start: '00:00:00', end: '00:00:00' }]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (!selectedSubject) newErrors.subject = 'Selecione uma disciplina';
    if (!selectedCategory) newErrors.category = 'Selecione uma categoria';
    if (!studyTime || studyTime === '00:00:00') newErrors.studyTime = 'Informe o tempo de estudo';
    if (!timeRegex.test(studyTime)) newErrors.studyTime = 'Use o formato HH:MM:SS';
    if (selectedSubject && !selectedTopic && topics.length > 0) newErrors.topic = 'Selecione ou digite um tópico';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const matchedSub = subjects.find((s) => s.subject === selectedSubject);

    const studyRecord: StudyRecord = {
      id: initialRecord?.id || '',
      date: selectedDate,
      subjectId: matchedSub?.id || initialRecord?.subjectId || '',
      subject: selectedSubject,
      topic: selectedTopic || 'Estudo Geral',
      studyTime: parseTime(studyTime),
      questions: {
        correct: questions[0].correct,
        total: questions[0].correct + questions[0].incorrect,
      },
      notes: comments,
      category: selectedCategory,
      reviewPeriods: isReviewSchedulingEnabled ? reviewPeriods : undefined,
      teoriaFinalizada: isTeoriaFinalizada,
      countInPlanning: countInPlanning,
      pages: pages.filter((p) => p.start > 0 || p.end > 0),
      videos: videos.filter((v) => v.title),
    };
    if (onSave) {
      onSave(studyRecord);
    } else if (studyRecord.id) {
      updateStudyRecord(studyRecord);
    } else {
      addStudyRecord(studyRecord);
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

  if (!isOpen) return null;

  const isToday = selectedDate === getLocalYYYYMMDD() && !showDatePicker;
  const isYesterday =
    selectedDate === getLocalYYYYMMDD(new Date(new Date().setDate(new Date().getDate() - 1))) &&
    !showDatePicker;

  return (
    <>
      <div className="fixed inset-0 lg:left-64 bottom-14 bg-[#f8fafc] dark:bg-[#0b1320] z-30 overflow-y-auto p-4 sm:p-6 lg:p-8">
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

          <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl shadow-sm w-full flex flex-col overflow-hidden">
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

            {/* Barra de Data: Hoje | Ontem | Outro */}
            <div className="flex items-center gap-2.5 flex-wrap">
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
                  onClick={() => setShowDatePicker(true)}
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
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
                        errors.subject ? 'border-rose-500' : 'border-slate-200 dark:border-[#1f304a]'
                      } text-xs font-medium text-slate-800 dark:text-slate-100 hover:border-emerald-500/50 transition-colors`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Layers size={14} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">{selectedSubject || 'Selecione a disciplina...'}</span>
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
                {errors.subject && <p className="mt-1 text-[11px] text-rose-500">{errors.subject}</p>}
              </div>

              {/* Tempo de Estudo (3 cols) */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tempo de estudo
                </label>
                <div className="relative">
                  <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={studyTime}
                    onChange={(e) => setStudyTime(e.target.value)}
                    placeholder="00:00:00"
                    className={`w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border ${
                      errors.studyTime ? 'border-rose-500' : 'border-slate-200 dark:border-[#1f304a]'
                    } text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  />
                </div>
                {errors.studyTime && <p className="mt-1 text-[11px] text-rose-500">{errors.studyTime}</p>}
              </div>
            </div>

            {/* Linha 2: Tópico e Material */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              {/* Tópico (8 cols) */}
              <div className="sm:col-span-8" ref={topicDropdownRef}>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tópico
                </label>
                <div className="relative">
                  <button
                    type="button"
                    disabled={!selectedSubject}
                    onClick={() => setIsTopicDropdownOpen(!isTopicDropdownOpen)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border ${
                      errors.topic ? 'border-rose-500' : 'border-slate-200 dark:border-[#1f304a]'
                    } text-xs font-medium text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:border-emerald-500/50 transition-colors`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FileText size={14} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{selectedTopic || 'Selecione um tópico do edital...'}</span>
                    </span>
                    <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
                  </button>
                  {isTopicDropdownOpen && (
                    <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
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
                {errors.topic && <p className="mt-1 text-[11px] text-rose-500">{errors.topic}</p>}
              </div>

              {/* Material (4 cols) */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Material <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <BookOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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

            {/* Checkboxes */}
            <div className="flex flex-wrap items-center gap-5 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTeoriaFinalizada}
                  onChange={(e) => setIsTeoriaFinalizada(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                />
                <span>Teoria finalizada</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={countInPlanning}
                  onChange={(e) => setCountInPlanning(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                />
                <span>Contabilizar no planejamento</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReviewSchedulingEnabled}
                  onChange={(e) => setIsReviewSchedulingEnabled(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                />
                <span>Programar revisões manuais</span>
              </label>
            </div>

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
                      onClick={() => setReviewPeriods((prev) => prev.filter((_, i) => i !== index))}
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

            {/* Linha 3: Questões, Páginas e Videoaulas (3 Cards Limpos) */}
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
                      type="number"
                      min="0"
                      value={q.correct}
                      onChange={(e) => {
                        const next = [...questions];
                        next[index].correct = parseInt(e.target.value) || 0;
                        setQuestions(next);
                      }}
                      placeholder="Acertos"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs font-bold text-center text-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="number"
                      min="0"
                      value={q.incorrect}
                      onChange={(e) => {
                        const next = [...questions];
                        next[index].incorrect = parseInt(e.target.value) || 0;
                        setQuestions(next);
                      }}
                      placeholder="Erros"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs font-bold text-center text-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                ))}
              </div>

              {/* Card Páginas (3 cols) */}
              <div className="md:col-span-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Páginas</h3>
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
                      type="number"
                      min="0"
                      value={p.start}
                      onChange={(e) => {
                        const next = [...pages];
                        next[index].start = parseInt(e.target.value) || 0;
                        setPages(next);
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="number"
                      min="0"
                      value={p.end}
                      onChange={(e) => {
                        const next = [...pages];
                        next[index].end = parseInt(e.target.value) || 0;
                        setPages(next);
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                ))}
              </div>

              {/* Card Videoaulas (5 cols) */}
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
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="00:00:00"
                      value={v.start}
                      onChange={(e) => {
                        const next = [...videos];
                        next[index] = { ...next[index], start: e.target.value };
                        setVideos(next);
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-[11px] font-mono text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="00:00:00"
                      value={v.end}
                      onChange={(e) => {
                        const next = [...videos];
                        next[index] = { ...next[index], end: e.target.value };
                        setVideos(next);
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-[11px] font-mono text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 dark:border-[#1a293e] bg-slate-50/50 dark:bg-[#0c1421]/50">
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
      </div>
    </>
  );
};

export default StudyRegisterModal;
