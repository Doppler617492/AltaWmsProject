import React from 'react';
import { MainLayout } from '../src/components/layout/MainLayout';
import DashboardPage from '../components/DashboardPage';

const Dashboard: React.FC = () => {
  return (
    <MainLayout breadcrumb={['Dashboard']}>
      <DashboardPage />
    </MainLayout>
  );
};

export default Dashboard;

