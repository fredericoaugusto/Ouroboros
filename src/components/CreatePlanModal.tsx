'use client';

import React, { useState, useRef, ChangeEvent } from 'react';
import { Camera, ArrowLeft, FolderPlus, Check } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import { useNotification } from '../context/NotificationContext';

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (planData: {
    name: string;
    observations: string;
    cargo: string;
    edital: string;
    banca?: string;
    image?: File;
    imageFile?: File;
    existingIconUrl?: string;
  }) => void;
  initialPlanData?: {
    name: string;
    observations: string;
    cargo?: string;
    edital?: string;
    banca?: string;
    iconUrl?: string;
  } | null;
  isEditing?: boolean;
}

const CreatePlanModal: React.FC<CreatePlanModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPlanData,
  isEditing,
}) => {
  const { showNotification } = useNotification();
  const [planName, setPlanName] = useState(initialPlanData?.name || '');
  const [observations, setObservations] = useState(initialPlanData?.observations || '');
  const [cargo, setCargo] = useState(initialPlanData?.cargo || '');
  const [edital, setEdital] = useState(initialPlanData?.edital || '');
  const [banca, setBanca] = useState(initialPlanData?.banca || '');
  const [imageFile, setImageFile] = useState<File | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPlanData?.iconUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialPlanData) {
      setPlanName(initialPlanData.name || '');
      setObservations(initialPlanData.observations || '');
      setCargo(initialPlanData.cargo || '');
      setEdital(initialPlanData.edital || '');
      setBanca(initialPlanData.banca || '');
      setPreviewUrl(initialPlanData.iconUrl || null);
      setImageFile(undefined);
    } else {
      setPlanName('');
      setObservations('');
      setCargo('');
      setEdital('');
      setBanca('');
      setPreviewUrl(null);
      setImageFile(undefined);
    }
  }, [initialPlanData, isOpen]);

  if (!isOpen) return null;

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFile(undefined);
      if (!initialPlanData?.iconUrl) {
        setPreviewUrl(null);
      }
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (planName.trim()) {
      onSave({
        name: planName.trim(),
        observations,
        cargo,
        edital,
        banca,
        image: imageFile,
        imageFile: imageFile,
        existingIconUrl: imageFile ? undefined : initialPlanData?.iconUrl,
      });
    } else {
      showNotification('O nome do plano não pode estar vazio.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 lg:left-64 bottom-14 bg-[#f8fafc] dark:bg-[#0b1320] z-30 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumbs
            items={[
              { label: 'Planos', onClick: onClose },
              { label: isEditing ? 'Editar Plano' : 'Criar Novo Plano' },
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
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isEditing ? 'Editar Plano de Estudos' : 'Criar Novo Plano'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure as informações do seu concurso ou objetivo
                </p>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Avatar / Image Picker */}
            <div className="flex flex-col items-center shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden"
                accept="image/*"
              />
              <div
                onClick={handleImageClick}
                className="w-24 h-24 rounded-2xl bg-slate-100 dark:bg-[#0b1320] border-2 border-dashed border-slate-300 dark:border-[#263959] hover:border-emerald-500 dark:hover:border-emerald-500 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group relative"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Pré-visualização"
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-slate-400 group-hover:text-emerald-500 transition-colors mb-1" />
                    <span className="text-[10px] font-medium text-slate-400 group-hover:text-emerald-400">
                       Capa / Ícone
                    </span>
                  </>
                )}
              </div>
              {previewUrl && (
                <button
                  type="button"
                  onClick={handleImageClick}
                  className="mt-1.5 text-xs font-medium text-emerald-500 hover:text-emerald-400"
                >
                  Trocar imagem
                </button>
              )}
            </div>

            {/* Main Fields */}
            <div className="flex-1 w-full space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Nome do Plano *
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Ex: Tribunais 2.0, PRF, Receita Federal..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Cargo Alvo (Opcional)
                </label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Analista Judiciário, Policial Rodoviário..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Banca Examinadora
              </label>
              <input
                type="text"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="Ex: Cebraspe, FGV, FCC..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Edital / Ano
              </label>
              <input
                type="text"
                value={edital}
                onChange={(e) => setEdital(e.target.value)}
                placeholder="Ex: Pós-Edital 2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Observações / Anotações do Plano
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Anotações gerais sobre datas de prova, estratégia ou links úteis..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#1f304a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm transition-all"
            >
              <Check className="w-4 h-4" />
              {isEditing ? 'Salvar Alterações' : 'Criar Plano'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePlanModal;
