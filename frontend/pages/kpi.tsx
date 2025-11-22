import React from 'react';
import { MainLayout } from '../src/components/layout/MainLayout';
import KpiDashboard from '../components/KpiDashboard';

const KpiPage: React.FC = () => {
  return (
    <MainLayout breadcrumb={['KPI tabla']}>
      <KpiDashboard />
    </MainLayout>
  );
};

export default KpiPage;

