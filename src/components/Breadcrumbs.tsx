'use client';

import React from 'react';
import Link from 'next/link';
import { FiChevronRight, FiHome } from 'react-icons/fi';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center flex-wrap gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-4 ${className}`}
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
        title="Ir para Home"
      >
        <FiHome className="w-3.5 h-3.5" />
      </Link>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            <FiChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
            {isLast ? (
              <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[260px] sm:max-w-[420px]">
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            ) : item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors truncate max-w-[200px] text-left"
              >
                {item.label}
              </button>
            ) : (
              <span className="truncate max-w-[200px]">{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
