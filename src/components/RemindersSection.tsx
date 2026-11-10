'use client';

import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Plus, Trash2, Edit2, StickyNote } from 'lucide-react';

const RemindersSection = () => {
  const { reminderNotes, addReminderNote, toggleReminderNote, deleteReminderNote, updateReminderNote } = useData();
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteText, setEditedNoteText] = useState('');

  const handleEditClick = (noteId: string, currentText: string) => {
    setEditingNoteId(noteId);
    setEditedNoteText(currentText);
  };

  const handleSaveEdit = () => {
    if (editingNoteId && editedNoteText.trim()) {
      updateReminderNote(editingNoteId, editedNoteText.trim());
    } else if (editingNoteId) {
      deleteReminderNote(editingNoteId);
    }
    setEditingNoteId(null);
    setEditedNoteText('');
  };

  const handleAddNote = () => {
    if (newNoteText.trim()) {
      addReminderNote(newNoteText.trim());
      setNewNoteText('');
    }
  };

  return (
    <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote size={16} className="text-emerald-500" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Lembretes Rápidos
        </h2>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Adicionar lembrete..."
          className="flex-grow px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddNote();
          }}
        />
        <button
          onClick={handleAddNote}
          className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors flex items-center justify-center flex-shrink-0"
        >
          <Plus size={16} />
        </button>
      </div>

      {reminderNotes.length > 0 ? (
        <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {reminderNotes.map((note) => (
            <li
              key={note.id}
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-100 dark:border-[#1a293e]"
            >
              <div className="flex items-center gap-2.5 flex-grow min-w-0">
                <input
                  type="checkbox"
                  checked={note.completed}
                  onChange={() => toggleReminderNote(note.id)}
                  className="h-4 w-4 rounded accent-emerald-500 cursor-pointer flex-shrink-0"
                />
                {editingNoteId === note.id ? (
                  <input
                    type="text"
                    value={editedNoteText}
                    onChange={(e) => setEditedNoteText(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                    }}
                    className="flex-grow px-2 py-0.5 text-xs rounded bg-white dark:bg-[#131f33] border border-emerald-500 text-slate-800 dark:text-slate-100 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <span
                    className={`text-xs truncate flex-grow ${
                      note.completed
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-700 dark:text-slate-200 font-medium'
                    }`}
                    onDoubleClick={() => handleEditClick(note.id, note.text)}
                  >
                    {note.text}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {editingNoteId !== note.id && (
                  <button
                    onClick={() => handleEditClick(note.id, note.text)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <Edit2 size={12} />
                  </button>
                )}
                <button
                  onClick={() => deleteReminderNote(note.id)}
                  className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400 text-center py-4">Nenhum lembrete ativo.</p>
      )}
    </div>
  );
};

export default RemindersSection;
