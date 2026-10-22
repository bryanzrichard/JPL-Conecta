import React from 'react';
import { HistoryIcon } from '../lib/icons';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import NotasHistorico from '../components/historico/NotasHistorico';
import ServicosHistorico from '../components/historico/ServicosHistorico';
import AdiantamentosHistorico from '../components/historico/AdiantamentosHistorico';

const Historico: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        icon={HistoryIcon}
        title="Histórico de Registros"
        description="Consulte, edite ou exclua registros passados."
      />

      <Tabs defaultValue="notas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:w-fit md:inline-grid md:min-w-[420px]">
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