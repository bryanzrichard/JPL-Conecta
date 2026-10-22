import React from 'react';
import { useAuth } from '../hooks/useAuth';

import { SystemHealthPanel } from '../components/home/SystemHealthPanel';
import { DashboardCharts } from '../components/home/DashboardCharts';
import { AuditLogsPanel } from '../components/home/AuditLogsPanel';

const Home: React.FC = () => {
    return (
        <div className="space-y-6 animate-in fade-in-50 pb-20 md:pb-0">
            {/* DASHBOARD CHARTS */}
            <DashboardCharts />

            {/* AUDIT LOGS */}
            <AuditLogsPanel />

            {/* PAINEL DE SAÚDE DO SISTEMA */}
            <SystemHealthPanel />
        </div>
    );
};

export default Home;