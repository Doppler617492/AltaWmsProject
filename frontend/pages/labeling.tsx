import React from 'react';
import { MainLayout } from "../src/components/layout/MainLayout";
import dynamic from 'next/dynamic';

const LabelingDashboard = dynamic(() => import('../components/LabelingDashboard'), { ssr: false });

export default function LabelingPage() {
  return (
    <MainLayout breadcrumb={["Etikete"]}>
      <div
        style={{
          background: "linear-gradient(180deg,#05070d 0%,#020304 100%)",
          minHeight: "100%",
          padding: "2rem clamp(1.5rem,2vw,3rem)",
          boxSizing: "border-box",
          color: "#f8fafc",
        }}
      >
        <LabelingDashboard />
      </div>
    </MainLayout>
  );
}

