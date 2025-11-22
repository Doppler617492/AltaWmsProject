import React from "react";
import { MainLayout } from "../src/components/layout/MainLayout";
import WorkforceDashboard from "../components/WorkforceDashboard";

export default function WorkforcePage() {
  return (
    <MainLayout
      breadcrumb={["Radna snaga"]}
      statusInfo={{
        receivingActive: 2,
        shippingActive: 1,
        onlineWorkers: 4,
      }}
    >
      <WorkforceDashboard />
    </MainLayout>
  );
}

