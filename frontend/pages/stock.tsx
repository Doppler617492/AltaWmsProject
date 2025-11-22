import React from "react";
import { MainLayout } from "../src/components/layout/MainLayout";
import StockDashboard from "../components/StockDashboard";

export default function StockPage() {
  return (
    <MainLayout
      breadcrumb={["Zalihe"]}
      statusInfo={{
        receivingActive: undefined,
        shippingActive: undefined,
        onlineWorkers: undefined,
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg,#05070d 0%,#020304 100%)",
          minHeight: "100%",
          padding: "2rem clamp(1.5rem,2vw,3rem)",
          boxSizing: "border-box",
          color: "#f8fafc",
        }}
      >
        <StockDashboard />
      </div>
    </MainLayout>
  );
}

