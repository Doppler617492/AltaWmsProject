import React, { useEffect, useState } from 'react';
import { MainLayout } from '../src/components/layout/MainLayout';
import Prijem from '../components/Prijem';

export default function ReceivingPage() {
  const [user, setUser] = useState<any|null>(null);
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: payload.sub, username: payload.username, role: payload.role, name: payload.username });
      }
    } catch {}
  }, []);

  return (
    <MainLayout breadcrumb={["Prijem"]} statusInfo={{ receivingActive: undefined, shippingActive: undefined, onlineWorkers: undefined }}>
      <div style={pageStyles.shell}>
        <Prijem user={user} />
      </div>
    </MainLayout>
  );
}

const pageStyles = {
  shell: {
    background: "linear-gradient(180deg,#05070d 0%,#020304 100%)",
    minHeight: '100%',
  },
};


