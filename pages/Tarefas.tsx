import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMediaQuery } from '../hooks/use-media-query';
import { Task } from '../types';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { ResponsiveModal, ResponsiveModalContent } from '../components/ui/ResponsiveModal';
import TarefasTable from '../components/tarefas/TarefasTable';
import TaskDetailPanel from '../components/tarefas/TaskDetailPanel';
import PautaWhatsAppPanel from '../components/tarefas/PautaWhatsAppPanel';
import TaskFormDrawer from '../components/tarefas/TaskFormDrawer';
import FiltrosTarefas from '../components/tarefas/FiltrosTarefas';
import { TarefasCabecalho } from '../components/tarefas/TarefasCabecalho';
import { TarefasBarraAbas } from '../components/tarefas/TarefasBarraAbas';
import { CopilotPanel } from '../components/tarefas/CopilotPanel';
import { BellIcon } from '../lib/icons';
import { useCopilot } from '../hooks/useCopilot';
import { useTarefasDados } from '../hooks/useTarefasDados';
import { useTarefasListas } from '../hooks/useTarefasListas';
import { useTarefasDeepLink } from '../hooks/useTarefasDeepLink';
import { useNotificacaoTarefas } from '../hooks/useNotificacaoTarefas';
import { usePautaWhatsApp } from '../hooks/usePautaWhatsApp';
import { useTarefaMutations } from '../hooks/useTarefaMutations';

export const Tarefas: React.FC = () => {
  const { user, profile } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Modais de Criação / Edição em Gaveta e Exclusão
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState<boolean>(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // -------------------------------------------------------------
  // 1. DADOS DO SUPABASE (OBRAS, COLABORADORES, SERVIÇOS E TAREFAS)
  // -------------------------------------------------------------
  const {
    projects,
    isLoadingProjects,
    collaborators,
    isLoadingCollaborators,
    projectsMap,
    collaboratorsMap,
    openServices,
    allTasks,
    isLoadingTasks,
  } = useTarefasDados(profile?.company_id);

  // -------------------------------------------------------------
  // 2. LISTAS, FILTROS, ABAS E SELEÇÃO DE TAREFA
  // -------------------------------------------------------------
  const {
    todayStr,
    tomorrowStr,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    isFilterDrawerOpen,
    setIsFilterDrawerOpen,
    enrichedTasks,
    activeFiltersCount,
    filteredTasks,
    todayAndTomorrowTasks,
    counts,
    activeTabTasks,
    selectedTask,
    setSelectedTask,
    isMobileDetailDrawerOpen,
    setIsMobileDetailDrawerOpen,
    selectedTaskIndex,
    hasPrevTask,
    hasNextTask,
    handlePrevTask,
    handleNextTask,
    handleSelectTask,
    handleTabChange,
  } = useTarefasListas({
    allTasks,
    projectsMap,
    collaboratorsMap,
    isDesktop,
  });

  // Deep link ?tarefa=<id>
  useTarefasDeepLink({
    allTasks,
    enrichedTasks,
    isLoadingTasks,
    setSearchTerm,
    setFilters,
    setActiveTab,
    setSelectedTask,
    setIsMobileDetailDrawerOpen,
    isDesktop,
    tomorrowStr,
  });

  // -------------------------------------------------------------
  // 3. COPILOTO JPL (HISTÓRICO, ÁUDIO & MENSAGENS IA)
  // -------------------------------------------------------------
  const copilot = useCopilot({
    companyId: profile?.company_id,
    userId: user?.id,
    projects,
    collaborators,
    allTasks,
    projectsMap,
    collaboratorsMap,
    openServices,
  });

  // -------------------------------------------------------------
  // 4. NOTIFICAÇÕES NATIVAS DO SMARTPHONE / COMPUTADOR
  // -------------------------------------------------------------
  const { hasNotificationPermission, requestNotificationPermission } = useNotificacaoTarefas({
    todayAndTomorrowTasks,
    todayStr,
  });

  // -------------------------------------------------------------
  // 5. GERAÇÃO DA PAUTA DO WHATSAPP (LIVE PREVIEW)
  // -------------------------------------------------------------
  const {
    previewDateMode,
    setPreviewDateMode,
    isCopiedSuccess,
    isMobileWhatsappPreviewOpen: isPautaOpen,
    setIsMobileWhatsappPreviewOpen: setIsPautaOpen,
    whatsappTasks,
    formattedWhatsAppText,
    dailyProgress,
    handleCopyWhatsApp,
    handleDirectGroupSend,
  } = usePautaWhatsApp({
    filteredTasks,
    filters,
    projectsMap,
    todayStr,
    tomorrowStr,
  });

  // -------------------------------------------------------------
  // 6. MUTATIONS (CRIAR, TOGGLE, REAGENDAR, EXCLUIR)
  // -------------------------------------------------------------
  const {
    toggleTaskStatusMutation,
    rescheduleTaskMutation,
    deleteTaskMutation,
    isTaskMutating,
  } = useTarefaMutations({
    companyId: profile?.company_id,
    userId: user?.id,
    projects,
    collaborators,
    projectsMap,
    filters,
    tomorrowStr,
    selectedTask,
    setSelectedTask,
    taskToDelete,
    setTaskToDelete,
  });

  const handleOpenEditDrawer = (task: Task) => {
    setTaskToEdit(task);
    setIsFormDrawerOpen(true);
  };

  return (
    <div className="w-full space-y-4 animate-in fade-in-50">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO DA CENTRAL DE AÇÃO                           */}
      {/* ========================================================= */}
      <TarefasCabecalho
        hasNotificationPermission={hasNotificationPermission}
        onRequestNotificationPermission={requestNotificationPermission}
        onOpenPauta={() => setIsPautaOpen(true)}
        dailyProgress={dailyProgress}
      />

      {/* ========================================================= */}
      {/* 2. COPILOTO JPL — CHAT & VOZ WHATSAPP-STYLE COM GEMINI IA  */}
      {/* ========================================================= */}
      <CopilotPanel
        isExpanded={copilot.isExpanded}
        onToggleExpanded={copilot.onToggleExpanded}
        chatMessages={copilot.chatMessages}
        chatInputText={copilot.chatInputText}
        onChatInputChange={copilot.onChatInputChange}
        onSendTextMessage={copilot.onSendTextMessage}
        isProcessingAudioIA={copilot.isProcessingAudioIA}
        isRecordingAudio={copilot.isRecordingAudio}
        recordingSeconds={copilot.recordingSeconds}
        onStartAudioRecording={copilot.onStartAudioRecording}
        onStopAudioRecording={copilot.onStopAudioRecording}
        onCancelAudioRecording={copilot.onCancelAudioRecording}
        onConfirmActions={copilot.onConfirmActions}
        onCancelActions={copilot.onCancelActions}
        onRefreshConsulta={copilot.onRefreshConsulta}
        onRetryTextMessage={copilot.onRetryTextMessage}
        onClearConversation={copilot.onClearConversation}
      />

      {/* ========================================================= */}
      {/* 2.1 BANNER AUTOMÁTICO DE NOTIFICAÇÃO (HOJE & AMANHÃ)       */}
      {/* ========================================================= */}
      {counts.today > 0 && (
        <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in-50">
          <div className="flex items-center gap-2 min-w-0">
            <BellIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">
              <strong>Lembrete automático:</strong> Você tem{' '}
              <strong>{counts.today} pendência(s)</strong> no prazo de hoje ou amanhã no canteiro.
            </span>
          </div>
          {activeTab !== 'today' && (
            <button
              type="button"
              onClick={() => handleTabChange('today')}
              className="font-bold underline hover:text-amber-700 dark:hover:text-white cursor-pointer shrink-0 text-xs"
            >
              Ver tarefas →
            </button>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. BARRA DE ABAS, BUSCA, FILTROS E NOVA TAREFA            */}
      {/* ========================================================= */}
      <div className="space-y-0">
        <TarefasBarraAbas
          activeTab={activeTab}
          onTabChange={handleTabChange}
          counts={counts}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeFiltersCount={activeFiltersCount}
          onOpenFilterDrawer={() => setIsFilterDrawerOpen(true)}
          onOpenNewTaskDrawer={() => {
            setTaskToEdit(null);
            setIsFormDrawerOpen(true);
          }}
          filters={filters}
          setFilters={setFilters}
          projects={projects}
          projectsMap={projectsMap}
          collaboratorsMap={collaboratorsMap}
          todayStr={todayStr}
          tomorrowStr={tomorrowStr}
        />

        {/* ========================================================= */}
        {/* 4. ÁREA PRINCIPAL: SPLIT VIEW (TABELA + PAINEL DE DETALHE) */}
        {/* ========================================================= */}
        <div
          className={`overflow-hidden rounded-b-xl border-x border-b border-slate-200/80 dark:border-gray-800 bg-white dark:bg-[#111827] shadow-xs flex flex-col lg:flex-row ${
            selectedTask && isDesktop ? 'items-stretch' : ''
          }`}
        >
          {/* LADO ESQUERDO: TABELA RETRÁTIL */}
          <div
            className={`${
              selectedTask && isDesktop
                ? 'w-full lg:w-[48%] xl:w-[46%] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-gray-800'
                : 'w-full'
            }`}
          >
            <TarefasTable
              tasks={activeTabTasks}
              selectedTaskId={selectedTask?.id || null}
              isTaskMutating={isTaskMutating}
              onSelectTask={handleSelectTask}
              onToggleStatus={(task) =>
                toggleTaskStatusMutation.mutate({
                  taskId: task.id,
                  newStatus: task.isCompleted ? 'Planejada' : 'Concluída',
                })
              }
              onRescheduleTomorrow={(task) =>
                rescheduleTaskMutation.mutate({ taskId: task.id, newDate: tomorrowStr })
              }
              isDetailOpen={!!selectedTask && isDesktop}
              emptyMessage={
                activeTab === 'purchases'
                  ? 'Nenhum material pendente de compra!'
                  : activeTab === 'completed'
                  ? 'Nenhuma tarefa concluída nesta visualização!'
                  : 'Tudo em dia nesta visão!'
              }
              emptySubtitle={
                activeTab === 'purchases'
                  ? 'Adicione itens de compra com o botão "+ Nova Tarefa" ou pelo Copiloto.'
                  : 'Nenhuma pendência encontrada para os filtros selecionados.'
              }
            />
          </div>

          {/* LADO DIREITO (DESKTOP): PAINEL DE DETALHE QUANDO HOUVER TAREFA SELECIONADA */}
          {isDesktop && selectedTask && (
            <div
              className="w-full lg:w-[52%] xl:w-[54%] shrink-0 min-h-[480px] max-h-[calc(100vh-270px)] overflow-hidden flex flex-col animate-in fade-in-0 duration-150 p-3 sm:p-4"
            >
              <TaskDetailPanel
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                isMutating={isTaskMutating(selectedTask.id)}
                onEdit={handleOpenEditDrawer}
                onDelete={(task) => setTaskToDelete(task)}
                onToggleStatus={(task) =>
                  toggleTaskStatusMutation.mutate({
                    taskId: task.id,
                    newStatus: task.isCompleted ? 'Planejada' : 'Concluída',
                  })
                }
                onRescheduleTomorrow={(task) =>
                  rescheduleTaskMutation.mutate({ taskId: task.id, newDate: tomorrowStr })
                }
                onPrevTask={handlePrevTask}
                onNextTask={handleNextTask}
                hasPrev={hasPrevTask}
                hasNext={hasNextTask}
                currentIndex={selectedTaskIndex}
                totalCount={activeTabTasks.length}
              />
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. GAVETAS & MODAIS                                       */}
      {/* ========================================================= */}
      {/* Drawer de Formulário de Tarefa (Criar / Editar) */}
      <TaskFormDrawer
        isOpen={isFormDrawerOpen}
        onClose={() => {
          setIsFormDrawerOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
        projects={projects}
        collaborators={collaborators}
        isLoadingPrerequisites={isLoadingProjects || isLoadingCollaborators}
      />

      {/* Drawer de Filtros */}
      <FiltrosTarefas
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        onApplyFilters={(newFilters) => setFilters(newFilters)}
        projects={projects}
        collaborators={collaborators}
      />

      {/* Painel de Detalhes no Celular (Gaveta / Bottom Sheet) */}
      {!isDesktop && selectedTask && (
        <ResponsiveModal
          open={isMobileDetailDrawerOpen}
          onOpenChange={setIsMobileDetailDrawerOpen}
          displayMode="drawer"
        >
          <ResponsiveModalContent size="md">
            <TaskDetailPanel
              task={selectedTask}
              onClose={() => setIsMobileDetailDrawerOpen(false)}
              isMutating={isTaskMutating(selectedTask.id)}
              onEdit={(task) => {
                setIsMobileDetailDrawerOpen(false);
                handleOpenEditDrawer(task);
              }}
              onDelete={(task) => {
                setIsMobileDetailDrawerOpen(false);
                setTaskToDelete(task);
              }}
              onToggleStatus={(task) =>
                toggleTaskStatusMutation.mutate({
                  taskId: task.id,
                  newStatus: task.isCompleted ? 'Planejada' : 'Concluída',
                })
              }
              onRescheduleTomorrow={(task) =>
                rescheduleTaskMutation.mutate({ taskId: task.id, newDate: tomorrowStr })
              }
              onPrevTask={handlePrevTask}
              onNextTask={handleNextTask}
              hasPrev={hasPrevTask}
              hasNext={hasNextTask}
              currentIndex={selectedTaskIndex}
              totalCount={activeTabTasks.length}
            />
          </ResponsiveModalContent>
        </ResponsiveModal>
      )}

      {/* Pauta do WhatsApp (Gaveta Lateral no Desktop & Bottom Sheet no Mobile) */}
      <ResponsiveModal
        open={isPautaOpen}
        onOpenChange={setIsPautaOpen}
        displayMode="drawer"
      >
        <ResponsiveModalContent size="md">
          <PautaWhatsAppPanel
            previewDateMode={previewDateMode}
            setPreviewDateMode={setPreviewDateMode}
            dailyProgress={dailyProgress}
            formattedWhatsAppText={formattedWhatsAppText}
            handleDirectGroupSend={handleDirectGroupSend}
            handleCopyWhatsApp={handleCopyWhatsApp}
            isCopiedSuccess={isCopiedSuccess}
            onClose={() => setIsPautaOpen(false)}
            todayDateStr={todayStr}
            tomorrowDateStr={tomorrowStr}
            tasksCount={whatsappTasks.length}
            completedCount={whatsappTasks.filter((t) => t.status === 'Concluída').length}
            purchasesCount={whatsappTasks.filter((t) => t.isPurchase).length}
          />
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={() => taskToDelete && deleteTaskMutation.mutate(taskToDelete.id)}
        title="Excluir Pendência"
        description={`Tem certeza que deseja excluir "${taskToDelete?.title}"?`}
        isLoading={deleteTaskMutation.isPending}
      />
    </div>
  );
};

export default Tarefas;
