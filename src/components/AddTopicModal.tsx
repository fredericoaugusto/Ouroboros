'use client';

import React, { useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import { Topic, parseTopicsFromString } from './AddSubjectModal';
import Breadcrumbs from './Breadcrumbs';
import { ListPlus, ArrowLeft, Check } from 'lucide-react';

interface AddTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (topics: Topic[], shouldContinue: boolean) => void;
  existingTopics: Topic[];
  isViewMode?: boolean;
}

const AddTopicModal: React.FC<AddTopicModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingTopics,
  isViewMode,
}) => {
  const { showNotification } = useNotification();
  const [content, setContent] = useState('');
  const [shouldContinue, setShouldContinue] = useState(false);

  if (!isOpen) return null;

  const TopicTreeItem: React.FC<{ topic: Topic; level: number }> = ({ topic, level }) => {
    return (
      <li className="py-1 text-xs text-slate-700 dark:text-slate-300">
        <div style={{ paddingLeft: `${level * 14}px` }} className="flex items-center gap-1.5">
          {topic.topic_number && (
            <span className="font-mono text-[10px] text-emerald-500 font-semibold">
              {topic.topic_number}
            </span>
          )}
          <span>{topic.topic_text}</span>
        </div>
        {topic.sub_topics && topic.sub_topics.length > 0 && (
          <ul className="mt-0.5">
            {topic.sub_topics.map((subTopic, index) => (
              <TopicTreeItem key={index} topic={subTopic} level={level + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  const handleAdd = () => {
    const newTopics = parseTopicsFromString(content);
    if (newTopics.length > 0) {
      onAdd(newTopics, shouldContinue);
      setContent('');
      if (!shouldContinue) {
        onClose();
      }
    } else {
      showNotification('Adicione pelo menos um tópico.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 lg:left-64 bottom-14 bg-[#f8fafc] dark:bg-[#0b1320] z-30 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumbs
            items={[
              { label: 'Disciplinas', onClick: onClose },
              { label: isViewMode ? 'Tópicos da Disciplina' : 'Adicionar Tópicos e Subtópicos' },
            ]}
            className="mb-0"
          />
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>

        <div className="bg-white dark:bg-[#131f33] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1f304a] w-full overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <ListPlus className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isViewMode ? 'Tópicos da Disciplina' : 'Adicionar Tópicos e Subtópicos'}
              </h2>
            </div>
          </div>

          <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Tópicos Existentes
              </label>
              <div className="bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] rounded-xl p-3 h-60 overflow-y-auto">
                {existingTopics.length > 0 ? (
                  <ul>
                    {existingTopics.map((topic, index) => (
                      <TopicTreeItem key={index} topic={topic} level={0} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhum tópico adicionado ainda.</p>
                )}
              </div>
            </div>

            {!isViewMode && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Novos Tópicos (2 espaços = subtópico)
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`Tópico Principal\n  Subtópico 1\n    Sub-subtópico 1.1\n  Subtópico 2`}
                  rows={10}
                  className="w-full h-60 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            )}
          </div>

          {!isViewMode && (
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shouldContinue}
                onChange={(e) => setShouldContinue(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-100 dark:bg-[#0b1320] border-slate-300 dark:border-[#243552]"
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Salvar e continuar adicionando
              </span>
            </label>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#1f304a]">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {isViewMode ? 'Fechar' : 'Cancelar'}
            </button>
            {!isViewMode && (
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm transition-all"
              >
                <Check className="w-4 h-4" />
                Adicionar
              </button>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddTopicModal;
