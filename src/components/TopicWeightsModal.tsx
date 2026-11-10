'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { useData } from '../context/DataContext';
import { Sliders, X, Check } from 'lucide-react';

interface Topic {
  topic_text: string;
  userWeight?: number;
  is_grouping_topic?: boolean;
  sub_topics?: Topic[];
}

interface Subject {
  id: string;
  subject: string;
  topics: Topic[];
}

interface TopicWeightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject | null;
}

const TopicWeightRow: React.FC<{
  topic: Topic;
  level: number;
  weights: { [key: string]: number };
  onWeightChange: (topicText: string, weight: number) => void;
}> = ({ topic, level, weights, onWeightChange }) => {
  const isGroupingTopic =
    topic.is_grouping_topic || (topic.sub_topics && topic.sub_topics.length > 0);
  const currentVal = weights[topic.topic_text] || 3;

  return (
    <Fragment>
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-slate-100 dark:border-[#1f304a] gap-2"
        style={{ paddingLeft: `${level * 18}px` }}
      >
        <p
          className={`text-xs text-slate-800 dark:text-slate-200 flex-1 ${
            isGroupingTopic ? 'font-bold' : 'font-medium'
          }`}
        >
          {topic.topic_text}
        </p>
        {!isGroupingTopic && (
          <div className="flex items-center gap-1.5 shrink-0">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onWeightChange(topic.topic_text, val)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  currentVal === val
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                    : 'bg-slate-100 dark:bg-[#0b1320] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        )}
      </div>
      {topic.sub_topics &&
        topic.sub_topics.map((subTopic) => (
          <TopicWeightRow
            key={subTopic.topic_text}
            topic={subTopic}
            level={level + 1}
            weights={weights}
            onWeightChange={onWeightChange}
          />
        ))}
    </Fragment>
  );
};

const TopicWeightsModal: React.FC<TopicWeightsModalProps> = ({ isOpen, onClose, subject }) => {
  const { updateTopicWeight } = useData();
  const [topicWeights, setTopicWeights] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (subject) {
      const initialWeights: { [key: string]: number } = {};
      const extractWeights = (topics: Topic[]) => {
        for (const topic of topics) {
          initialWeights[topic.topic_text] = topic.userWeight || 3;
          if (topic.sub_topics) {
            extractWeights(topic.sub_topics);
          }
        }
      };
      extractWeights(subject.topics);
      setTopicWeights(initialWeights);
    }
  }, [subject]);

  if (!isOpen || !subject) return null;

  const handleWeightChange = (topicText: string, weight: number) => {
    setTopicWeights((prev) => ({ ...prev, [topicText]: weight }));
    updateTopicWeight(subject.id, topicText, weight);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-2xl w-full max-w-2xl max-h-[82vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Relevância dos Tópicos: <span className="text-emerald-500">{subject.subject}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Escala de 1 (baixa incidência) a 5 (altíssima incidência)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {subject.topics.map((topic) => (
            <TopicWeightRow
              key={topic.topic_text}
              topic={topic}
              level={0}
              weights={topicWeights}
              onWeightChange={handleWeightChange}
            />
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#1f304a] flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Check className="w-4 h-4" />
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicWeightsModal;
