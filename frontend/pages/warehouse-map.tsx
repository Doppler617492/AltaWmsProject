import React, { useEffect } from "react";
import Link from "next/link";
import { MainLayout } from "../src/components/layout/MainLayout";

export default function WarehouseMapPage() {
  // Temporarily disabled per request
  useEffect(()=>{
    // no-op: keep page accessible but clearly disabled
  },[]);
  return (
    <MainLayout breadcrumb={["Mapa skladišta"]} statusInfo={{ receivingActive: undefined, shippingActive: undefined, onlineWorkers: undefined }}>
      <div style={{ padding: 16 }}>
        <div style={{
          border: '2px solid #FFC300',
          background: '#111',
          color: '#fff',
          borderRadius: 12,
          padding: 24,
        }}>
          <div style={{ fontWeight: 800, marginBottom: 8, color: '#FFC300' }}>Mapa skladišta je trenutno onemogućena</div>
          <div style={{ opacity: 0.85 }}>Funkcije vezane za lokacije i skladištenje su privremeno isključene. Kasnije ćemo ih ponovo aktivirati.</div>
          <div style={{ marginTop: 16 }}>
            <Link
              href="/dashboard"
              style={{
                background: "#FFC300",
                color: "#000",
                padding: "10px 16px",
                borderRadius: 8,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              ← Nazad na kontrolnu tablu
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
