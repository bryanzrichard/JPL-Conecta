import React from 'react';
// FIX: Corrected import paths from `../../` to `../` to match the project structure.
import { HistoryIcon } from '../lib/icons';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import NotasHistorico from '../components/historico/NotasHistorico';
import ServicosHistorico from '../components/historico/ServicosHistorico';
import AdiantamentosHistorico from '../components/historico/AdiantamentosHistorico';

const Historico: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HistoryIcon className="h-8 w-8 text-brand-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Histórico de Registros</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Consulte, edite ou exclua registros passados.</p>
        </div>
      </div>

      <Tabs defaultValue="notas">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="notas">Notas Fiscais</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="adiantamentos">Adiantamentos</TabsTrigger>
        </TabsList>
        <TabsContent value="notas">
          <NotasHistorico />
        </TabsContent>
        <TabsContent value="servicos">
          <ServicosHistorico />
        </TabsContent>
        <TabsContent value="adiantamentos">
          <AdiantamentosHistorico />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Historico;