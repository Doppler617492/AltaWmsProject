import React from 'react';
import { MainLayout } from '../src/components/layout/MainLayout';
import ShippingDashboard from '../components/ShippingDashboard';

export default function ShippingPage() {
  return (
    <MainLayout breadcrumb={["Otprema"]} statusInfo={{ receivingActive: undefined, shippingActive: undefined, onlineWorkers: undefined }}>
      <div style={pageStyles.shell}>
        <ShippingDashboard />
      </div>
    </MainLayout>
  );
}

const pageStyles = {
  shell: {
    background: "linear-gradient(180deg,#05070d 0%, #020304 100%)",
    minHeight: '100%',
    padding: "2rem clamp(1.5rem,2vw,3rem)",
  },
};
