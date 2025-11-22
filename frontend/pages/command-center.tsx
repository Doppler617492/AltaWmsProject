import React from 'react';
import { MainLayout } from '../src/components/layout/MainLayout';
import CommandCenter from '../components/CommandCenter';

const CommandCenterPage: React.FC = () => {
  return (
    <MainLayout breadcrumb={['Komandni centar']}>
      <CommandCenter />
    </MainLayout>
  );
};

export default CommandCenterPage;

