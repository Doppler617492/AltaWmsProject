import React, { useEffect, useState } from 'react';
import { MainLayout } from '../src/components/layout/MainLayout';
import PovracajDashboard from '../components/PovracajDashboard';

export default function PovracajPage() {
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.sub,
          username: payload.username,
          role: payload.role,
          name: payload.fullName || payload.username,
        });
      }
    } catch {
      setUser(null);
    }
  }, []);

  return (
    <MainLayout
      breadcrumb={["POVRAĆAJ"]}
      statusInfo={{ receivingActive: undefined, shippingActive: undefined, onlineWorkers: undefined }}
    >
      <div style={pageStyles.shell}>
        <PovracajDashboard user={user} />
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

