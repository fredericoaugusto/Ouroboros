'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiX } from 'react-icons/fi';

interface MultiSelectDropdownProps {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedOptions,
  onChange,
  placeholder = 'Selecione...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleOptionClick = (option: string) => {
    const newSelectedOptions = selectedOptions.includes(option)
      ? selectedOptions.filter(item => item !== option)
      : [...selectedOptions, option];
    onChange(newSelectedOptions);
  };

  const handleRemoveOption = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelectedOptions = selectedOptions.filter(item => item !== option);
    onChange(newSelectedOptions);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div
      className={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      ref={dropdownRef}
    >
      <div
        onClick={handleToggle}
        className="flex items-center w-full border border-slate-200 dark:border-[#1f304a] rounded-xl px-3 py-2 bg-white dark:bg-[#131f33] text-slate-900 dark:text-white text-xs cursor-pointer min-h-[38px] pr-8"
      >
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          ) : (
            selectedOptions.map(option => (
              <span
                key={option}
                className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold px-2 py-0.5 rounded-lg truncate max-w-[180px]"
              >
                <span className="truncate">{option}</span>
                <FiX
                  className="cursor-pointer hover:text-rose-500 flex-shrink-0 w-3 h-3"
                  onClick={e => handleRemoveOption(option, e)}
                />
              </span>
            ))
          )}
        </div>
        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
      </div>
      {isOpen && !disabled && (
        <div className="absolute z-20 mt-1.5 w-full bg-white dark:bg-[#131f33] shadow-xl border border-slate-200 dark:border-[#1f304a] rounded-xl max-h-56 overflow-auto py-1">
          <ul>
            {options?.map(option => (
              <li
                key={option}
                onClick={() => handleOptionClick(option)}
                className="px-3.5 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a2942] flex items-center gap-2.5 text-xs"
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option)}
                  readOnly
                  className="h-3.5 w-3.5 accent-emerald-500 rounded"
                />
                <span className="text-slate-800 dark:text-slate-200 truncate">
                  {option}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
