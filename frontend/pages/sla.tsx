import React from 'react';
import { MainLayout } from '../src/components/layout/MainLayout';
import SlaDashboard from '../components/SlaDashboard';

const SlaPage: React.FC = () => {
  return (
    <MainLayout breadcrumb={['SLA usklađenost']}>
      <SlaDashboard />
    </MainLayout>
  );
};

export default SlaPage;
