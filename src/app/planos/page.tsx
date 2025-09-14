'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useData } from '../../context/DataContext';
import { getJsonContent, createPlanFile, getJsonFiles } from '../actions';
import Link from 'next/link';
import Image from 'next/image';
import CreatePlanModal from '../../components/CreatePlanModal';
import { FaPlusCircle, FaFileAlt, FaTrash } from 'react-icons/fa';
import { useNotification } from '../../context/NotificationContext';
import ConfirmationModal from '../../components/ConfirmationModal';
import ImportGuideForm from '../../components/ImportGuideForm'; // 1. Importar o novo componente

// Interfaces atualizadas
interface PlanContent {
  name: string;
  observations: string;
  iconUrl?: string;
  subjects: Subject[];
  banca?: string; // Adicionado para a banca
}

interface Subject {
  subject: string;
  topics: Topic[];
}

interface Topic {
  topic_number?: string;
  topic_text: string;
  sub_topics?: Topic[];
}


interface PlanInfo {
  fileName: string;
  name: string;
  iconUrl?: string;
  subjectCount: number;
  topicCount: number;
  banca?: string; // Adicionado para a banca
}

interface PlanFormData {
  name: string;
  observations: string;
  cargo: string;
  edital: string;
  image?: File;
}

export default function Planos() {
  const { deletePlan } = useData();
  const { showNotification } = useNotification();
  const [planos, setPlanos] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanInfo | null>(null);

  const fetchPlanData = useCallback(async () => {
    setLoading(true);
    const allFiles = await getJsonFiles();
    const filesToLoad = allFiles.filter(file => file.toUpperCase() !== 'USERS.JSON');
    const loadedPlanos: PlanInfo[] = [];

    // Definir countTopicsRecursively aqui para ser acessível
    const countTopicsRecursively = (topics: Topic[]): number => {
      let count = 0;
      for (const topic of topics) {
        count++; // Count the current topic
        if (topic.sub_topics && topic.sub_topics.length > 0) {
          count += countTopicsRecursively(topic.sub_topics); // Add count of subtopics
        }
      }
      return count;
    };

    for (const file of filesToLoad) {
      if (file === 'study_records.json') continue;

      const rawData = await getJsonContent(file);
      let plan: PlanContent;

      if (Array.isArray(rawData)) {
        plan = {
          name: file.replace('.json', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          observations: '',
          subjects: rawData,
          banca: '', // Definir banca como vazia para planos antigos sem banca
        };
      } else if (rawData && typeof rawData === 'object') {
        plan = rawData as PlanContent;
        plan.banca = (rawData as any).banca || ''; // Adicionado para ler a banca
      } else {
        plan = {
          name: file.replace('.json', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          observations: '',
          subjects: [],
          banca: '', // Definir banca como vazia para planos sem conteúdo
        };
      }

      // Aplicar unicidade às matérias
      const uniqueSubjectsMap = new Map<string, Subject>();
      (plan.subjects || []).forEach(s => uniqueSubjectsMap.set(s.subject, s));
      const subjectsToCount = Array.from(uniqueSubjectsMap.values());

      let totalTopics = 0;
      subjectsToCount.forEach(subject => {
        totalTopics += countTopicsRecursively(subject.topics || []);
      });

      loadedPlanos.push({
        fileName: file,
        name: plan.name || file.replace('.json', '').toUpperCase(),
        iconUrl: plan.iconUrl,
        subjectCount: subjectsToCount.length, // Agora é a contagem de matérias únicas
        topicCount: totalTopics,
      });
    }
    setPlanos(loadedPlanos);
    setLoading(false);
  }, []);

  const handleDeleteClick = (event: React.MouseEvent, plan: PlanInfo) => {
    event.preventDefault();
    event.stopPropagation();
    setPlanToDelete(plan);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (planToDelete) {
      await deletePlan(planToDelete.fileName);
      showNotification(`Plano "${planToDelete.name}" excluído com sucesso.`, 'success');
      setPlanToDelete(null);
      setIsConfirmModalOpen(false);
      await fetchPlanData();
    }
  };

  useEffect(() => {
    fetchPlanData();
  }, [fetchPlanData]);

  const handleSavePlan = async (planData: { name: string; observations: string; cargo: string; edital: string; image?: File }) => {
    const formData = new FormData();
    formData.append('name', planData.name);
    formData.append('observations', planData.observations);
    formData.append('cargo', planData.cargo);
    formData.append('edital', planData.edital);
    if (planData.image) {
      formData.append('image', planData.image);
    }

    const result = await createPlanFile(formData);

    if (result.success) {
      showNotification(`Plano "${planData.name}" criado com sucesso!`, 'success');
      setIsModalOpen(false);
      await fetchPlanData();
    } else {
      showNotification(`Erro: ${result.error}`, 'error');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center"><p>Carregando planos...</p></div>;
  }

  return (
    <>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 pt-12">
        <div className="w-full">
          <div className="mb-6">
          <header className="flex justify-between items-center pt-4">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Meus Planos de Estudo</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center px-4 py-2 bg-amber-500 text-white rounded-full shadow-lg hover:bg-amber-600 transition-all duration-300 text-base font-semibold"
                title="Criar Novo Plano"
              >
                <FaPlusCircle className="mr-2 text-lg" />
                Criar Novo Plano
              </button>
            </div>
          </header>
          <hr className="mt-2 mb-6 border-gray-300 dark:border-gray-700" />
        </div>

        {/* 2. Adicionar o formulário de importação aqui */}
        <ImportGuideForm />

          {/* Seção de Planos Existentes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {planos.map((plan) => (
              <div key={plan.fileName} className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center text-center p-6 group">
                <Link href={`/planos/${plan.fileName}`} className="w-full h-full">
                  {plan.iconUrl ? (
                    <div className="relative w-24 h-24 mb-4 rounded-full overflow-hidden border-4 border-amber-500 shadow-md mx-auto">
                      <Image src={plan.iconUrl} alt={`Ícone do plano ${plan.name}`} layout="fill" objectFit="cover" />
                    </div>
                  ) : (
                    <div className="w-24 h-24 mb-4 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 mx-auto">
                      <FaFileAlt size={48} />
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{plan.name}</h2>
                  {plan.banca && <p className="text-gray-600 dark:text-gray-300 text-sm">Banca: <span className="font-semibold">{plan.banca}</span></p>}
                  <p className="text-gray-600 dark:text-gray-300 text-sm">Matérias: <span className="font-semibold">{plan.subjectCount}</span></p>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">Tópicos: <span className="font-semibold">{plan.topicCount}</span></p>
                </Link>
                <button
                  onClick={(e) => handleDeleteClick(e, plan)}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity duration-300"
                  title="Excluir Plano"
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CreatePlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePlan}
      />
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o plano "${planToDelete?.name}"? Esta ação é irreversível.`}
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </>
  );
}