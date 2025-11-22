import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { colors } from '../../theme/colors';
import { IconSearch } from "../icons/IconSearch";
import { IconOnlineDot } from "../icons/IconOnlineDot";
import { IconOfflineDot } from "../icons/IconOfflineDot";

export interface HeaderBarProps {
  breadcrumb?: string[];
  statusInfo?: {
    receivingActive?: number;
    shippingActive?: number;
    onlineWorkers?: number;
  };
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ breadcrumb = [], statusInfo }) => {
  const isOnline = true;
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    // Get user info from localStorage token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userInfo = {
          id: payload.sub,
          username: payload.username,
          role: payload.role,
          name: payload.fullName || payload.username || 'User'
        };
        setUser(userInfo);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
    // Prepare stable device id for heartbeat
    try {
      let did = localStorage.getItem('device_id') || '';
      if (!did) {
        const base = 'web-' + (navigator.userAgent || 'agent').replace(/\s+/g,'').slice(0,20);
        const rnd = Math.random().toString(36).slice(2, 8);
        did = `${base}-${rnd}`;
        localStorage.setItem('device_id', did);
      }
      setDeviceId(did);
    } catch {}
  }, []);

  // Heartbeat to backend every 60s to keep ONLINE status fresh
  useEffect(() => {
    let timer: any = null;
    const ping = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return; // not logged in
        // Use fetch directly to avoid circular import; but apiClient is fine too if available in this layer
        const res = await fetch('/api/fresh/pwa/heartbeat', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')||''}`,
          },
          body: JSON.stringify({ device_id: deviceId || 'web-local' }),
        });
        // ignore response
      } catch {}
    };
    // initial ping and interval
    ping();
    timer = setInterval(ping, 60000);
    return () => { if (timer) clearInterval(timer); };
  }, [deviceId]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowDropdown(false);
    };
    
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <header
      style={{
        backgroundColor: colors.bgPanelAlt,
        borderBottom: `1px solid ${colors.borderDefault}`,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "0.75rem 1rem",
        color: colors.textPrimary,
        gap: "1rem",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* LEFT: simple brand text + breadcrumb + status */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 6 }}>
          <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 24 }} />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: colors.brandYellow,
            marginBottom: statusInfo ? "0.25rem" : "0",
          }}
        >
          {breadcrumb.length === 0 ? (
            <span style={{ color: colors.brandYellow }}>Kontrolna tabla</span>
          ) : (
            breadcrumb.map((seg, idx) => (
              <span key={idx} style={{ display: "flex", alignItems: "center" }}>
                {idx > 0 && (
                  <span style={{ padding: "0 0.5rem", color: "rgba(255,212,0,0.6)" }}>›</span>
                )}
                <span style={{ color: idx === breadcrumb.length - 1 ? colors.brandYellow : "rgba(255,212,0,0.6)" }}>
                  {seg}
                </span>
              </span>
            ))
          )}
        </div>
        {statusInfo && (
          <div
            style={{
              display: "flex",
              gap: "1rem",
              fontSize: "0.6875rem",
              fontWeight: 500,
              color: "rgba(255,212,0,0.8)",
              marginTop: "0.25rem",
            }}
          >
            {statusInfo.receivingActive !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ color: "rgba(255,212,0,0.6)" }}>Prijem aktivan:</span>
                <span style={{ color: colors.brandYellow }}>{statusInfo.receivingActive}</span>
              </div>
            )}
            {statusInfo.shippingActive !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ color: "rgba(255,212,0,0.6)" }}>Otprema aktivna:</span>
                <span style={{ color: colors.brandYellow }}>{statusInfo.shippingActive}</span>
              </div>
            )}
            {statusInfo.onlineWorkers !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <IconOnlineDot size={8} color={colors.statusOk} />
                <span style={{ color: "rgba(255,212,0,0.6)" }}>Online radnika:</span>
                <span style={{ color: colors.brandYellow }}>{statusInfo.onlineWorkers}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CENTER: search placeholder */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: colors.bgPanel,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: "0.5rem",
          padding: "0.5rem 0.75rem",
          maxWidth: "400px",
          color: colors.textSecondary,
          fontSize: "0.75rem",
        }}
      >
        <IconSearch size={16} color={colors.textSecondary} />
        <span style={{ marginLeft: "0.5rem" }}>
          Pretraga (SKU / lokacija / dokument) — stub
        </span>
      </div>

      {/* RIGHT: user badge with dropdown */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            position: "relative",
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            style={{
              textAlign: "right",
              fontSize: "0.75rem",
              lineHeight: 1.2,
              color: colors.textPrimary,
              cursor: "pointer",
              padding: "8px",
              borderRadius: 6,
              backgroundColor: showDropdown ? colors.bgPanel : 'transparent',
              border: `1px solid ${showDropdown ? colors.borderStrong : 'transparent'}`,
            }}
          >
            <div style={{ fontWeight: 600, color: colors.textPrimary }}>{user?.name || 'User'}</div>
            <div style={{ color: colors.textSecondary, fontSize: "0.7rem" }}>{user?.role || 'role'}</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "0.25rem",
                fontSize: "0.625rem",
                color: colors.statusOk,
                fontWeight: 500,
                marginTop: "0.125rem",
              }}
            >
              <IconOnlineDot size={8} color={colors.statusOk} />
              <span>online</span>
            </div>
          </div>
          {showDropdown && (
            <div
              style={{
                position: "absolute",
                bottom: "-50px",
                right: 0,
                background: colors.bgPanel,
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: 6,
                padding: "8px 0",
                minWidth: "150px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                zIndex: 1000,
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  width: "100%",
                  background: 'transparent',
                  border: 'none',
                  color: colors.textPrimary,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "left",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bgPanelAlt;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Odjavi se
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
