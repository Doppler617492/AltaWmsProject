import React, { useCallback, useEffect, useRef, useState } from "react";
import { SidebarNav } from "./SidebarNav";
import { HeaderBar } from "./HeaderBar";
import { colors } from '../../theme/colors';

type LiveAlert = {
  id: string;
  title: string;
  area: "PRIJEM" | "OTPREMA" | "SKART" | "POVRAĆAJ";
  deltaOrders?: number;
  deltaItems?: number;
  totalOrders?: number;
  message?: string;
};

export interface MainLayoutProps {
  children: React.ReactNode;
  breadcrumb?: string[];
  statusInfo?: {
    receivingActive?: number;
    shippingActive?: number;
    onlineWorkers?: number;
  };
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  breadcrumb = [],
  statusInfo,
}) => {
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [wsStatus, setWsStatus] = useState({
    connected: false,
    retries: 0,
    lastError: "",
    blocked: false,
    history: [] as Array<{ connected: boolean; timestamp: number; error?: string }>,
  });

  const prevMetricsRef = useRef<Map<string, {
    receivingOrders: number;
    shippingOrders: number;
    receivingItems: number;
    shippingItems: number;
  }> | null>(null);

  const timeoutsRef = useRef<number[]>([]);

  const pushAlert = useCallback((payload: Omit<LiveAlert, "id">) => {
    const id = `${payload.title}-${payload.area}-${Date.now()}`;
    setLiveAlerts((prev) => [{ ...payload, id }, ...prev].slice(0, 5));
    if (typeof window !== "undefined") {
      const timeoutId = window.setTimeout(() => {
        setLiveAlerts((prev) => prev.filter((a) => a.id !== id));
        timeoutsRef.current = timeoutsRef.current.filter((t) => t !== timeoutId);
      }, 6500);
      timeoutsRef.current.push(timeoutId);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let socket: any = null;
    let watchIntervalId: number | null = null;

    const pushWsStatus = (partial: Partial<typeof wsStatus>) => {
      setWsStatus((prev) => {
        const next = {
          ...prev,
          ...partial,
          history: [
            ...prev.history.slice(-20),
            {
              connected: partial.connected ?? prev.connected,
              timestamp: Date.now(),
              error: partial.lastError,
            },
          ],
        };
        window.__websocketStatus = window.__websocketStatus || {};
        window.__websocketStatus.performance = next;
        return next;
      });
    };

    const connect = () => {
      if (cancelled) return;
      try {
        const io = (window as any).io;
        if (!io) {
          window.setTimeout(connect, 1200);
          return;
        }
        const base =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          `${window.location.origin}`;
        let token =
          process.env.NEXT_PUBLIC_TV_KIOSK_TOKEN ||
          (window as any).__TV_KIOSK_TOKEN ||
          "";
        if (!token) {
          try {
            const stored = window.localStorage.getItem("token");
            if (stored) token = stored;
          } catch {}
        }
        if (!token) token = "change_me_strong_token";

        socket = io(`${base}/ws/performance`, {
          transports: ["websocket"],
          query: { kioskToken: token },
          reconnection: true,
          reconnectionDelayMax: 5000,
          timeout: 15000,
        });
        console.info("[WS] performance socket connecting");
        window.__websocketStatus = window.__websocketStatus || {};
        window.__websocketStatus.performance = window.__websocketStatus.performance || {
          connected: false,
          retries: 0,
          lastError: "",
        };
        if (watchIntervalId) {
          clearInterval(watchIntervalId);
        }
        watchIntervalId = window.setInterval(() => {
          if (!socket) return;
          const status = window.__websocketStatus.performance || {
            connected: false,
            retries: 0,
            lastError: "",
          };
          console.info(
            `[WS][performance] connected=${socket.connected} retries=${status.retries}`
          );
        }, 5000);

        socket.on("connect", () => {
          console.info("[WS] performance connected");
          const prevRetries =
            window.__websocketStatus.performance?.retries ?? 0;
          pushWsStatus({
            connected: true,
            retries: prevRetries + 1,
            lastError: "",
          });
        });
        socket.on("disconnect", (reason: any) => {
          console.warn("[WS] performance disconnected", reason);
          pushWsStatus({
            connected: false,
          });
        });
        socket.on("performance:update", (snap: any) => {
          try {
            const workers = Array.isArray(snap?.workers) ? snap.workers : [];
            const nextMap = new Map<string, {
              receivingOrders: number;
              shippingOrders: number;
              receivingItems: number;
              shippingItems: number;
            }>();

            const prev = prevMetricsRef.current;
            workers.forEach((w: any) => {
              const name =
                String(w?.name || w?.username || w?.full_name || w?.worker_name || `#${w?.user_id ?? ""}`).trim() ||
                "Nepoznat magacioner";
              const receivingOrders = Number(w?.receiving?.box_completed || 0);
              const shippingOrders = Number(w?.shipping?.box_completed || 0);
              const receivingItems = Number(w?.receiving?.items_completed || 0);
              const shippingItems = Number(w?.shipping?.items_completed || 0);

              const snapshot = {
                receivingOrders,
                shippingOrders,
                receivingItems,
                shippingItems,
              };

              if (prev && prev.has(name)) {
                const previous = prev.get(name)!;
                const deltaReceivingOrders = receivingOrders - previous.receivingOrders;
                const deltaShippingOrders = shippingOrders - previous.shippingOrders;
                const deltaReceivingItems = receivingItems - previous.receivingItems;
                const deltaShippingItems = shippingItems - previous.shippingItems;

                if (deltaReceivingOrders > 0) {
                  pushAlert({
                    title: name,
                    area: "PRIJEM",
                    deltaOrders: deltaReceivingOrders,
                    deltaItems: Math.max(deltaReceivingItems, 0),
                    totalOrders: receivingOrders,
                  });
                }

                if (deltaShippingOrders > 0) {
                  pushAlert({
                    title: name,
                    area: "OTPREMA",
                    deltaOrders: deltaShippingOrders,
                    deltaItems: Math.max(deltaShippingItems, 0),
                    totalOrders: shippingOrders,
                  });
                }
              }

              nextMap.set(name, snapshot);
            });

            prevMetricsRef.current = nextMap;
          } catch (err) {
            console.error("Perf socket update error", err);
          }
        });

        // Connect to assignments WebSocket for task completion notifications
        let assignmentsSocket: any = null;
        try {
          assignmentsSocket = io(`${base}/ws/assignments`, {
            transports: ["websocket"],
          });

          assignmentsSocket.on("task:completed", (payload: any) => {
            try {
              const typeLabels: Record<string, string> = {
                'RECEIVING': 'Prijem',
                'SHIPPING': 'Otprema',
                'SKART': 'SKART',
                'POVRACAJ': 'Povraćaj',
              };
              const typeLabel = typeLabels[payload.type] || payload.type;
              const identifier = payload.document_number || payload.order_number || payload.uid || `#${payload.task_id}`;
              const workerOrTeam = payload.team_name 
                ? `Tim "${payload.team_name}"`
                : payload.worker_name 
                  ? payload.worker_name
                  : payload.worker_id 
                    ? `Korisnik #${payload.worker_id}`
                    : 'Nepoznat';
              
              // Show notification alert - worker/team is now available for new tasks
              const areaLabel = payload.type === 'RECEIVING' ? 'PRIJEM' : payload.type === 'SHIPPING' ? 'OTPREMA' : payload.type === 'SKART' ? 'SKART' : 'POVRAĆAJ';
              const completionMessage = `${workerOrTeam} je završio ${typeLabel.toLowerCase()} ${identifier} i sada je slobodan za dodeljivanje novog zadatka.`;
              pushAlert({
                title: workerOrTeam,
                area: areaLabel,
                deltaOrders: 1,
                deltaItems: 0,
                totalOrders: 0,
                message: completionMessage,
              });

              // Also dispatch a custom event for other components to listen
              window.dispatchEvent(new CustomEvent('task:completed', {
                detail: {
                  type: payload.type,
                  typeLabel,
                  identifier,
                  workerOrTeam,
                  workerId: payload.worker_id,
                  teamId: payload.team_id,
                  completedAt: payload.completed_at,
                  message: completionMessage,
                }
              }));
            } catch (err) {
              console.error("Task completion notification error", err);
            }
          });

          assignmentsSocket.on("task:created", (payload: any) => {
            try {
              const typeLabels: Record<string, string> = {
                'RECEIVING': 'Prijem',
                'SHIPPING': 'Otprema',
                'SKART': 'SKART',
                'POVRACAJ': 'Povraćaj',
              };
              const typeLabel = typeLabels[payload.type] || payload.type;
              const identifier = payload.document_number || payload.order_number || payload.uid || `#${payload.task_id}`;
              const creator = payload.created_by_name
                ? payload.created_by_name
                : payload.created_by_id
                  ? `Korisnik #${payload.created_by_id}`
                  : 'Nepoznat korisnik';
              const areaLabel = payload.type === 'RECEIVING'
                ? 'PRIJEM'
                : payload.type === 'SHIPPING'
                  ? 'OTPREMA'
                  : payload.type === 'SKART'
                    ? 'SKART'
                    : 'POVRAĆAJ';
              const locationLabel = payload.store_name || payload.customer_name || payload.supplier_name || '';
              const alertTitle = `Novi ${typeLabel}`;
              const messageParts = [
                `${creator} je kreirao ${typeLabel.toLowerCase()} ${identifier}`,
              ];
              if (locationLabel) {
                messageParts.push(locationLabel);
              }
              const message = messageParts.join(' · ');
              pushAlert({
                title: alertTitle,
                area: areaLabel,
                message,
              });

              window.dispatchEvent(new CustomEvent('task:created', {
                detail: {
                  type: payload.type,
                  typeLabel,
                  identifier,
                  creator,
                  createdAt: payload.created_at,
                  storeName: payload.store_name,
                  customerName: payload.customer_name,
                  supplierName: payload.supplier_name,
                  message,
                }
              }));
            } catch (err) {
              console.error("Task creation notification error", err);
            }
          });
        } catch (e) {
          // Ignore WebSocket connection errors
        }

        socket.on("connect_error", (err: any) => {
          console.error("[WS] performance connect_error", err);
          const retryCount =
            window.__websocketStatus.performance?.retries ?? wsStatus.retries;
          const blocked = retryCount >= 5;
          pushWsStatus({
            connected: false,
            lastError: err?.message || "connect_error",
            blocked,
            retries: retryCount,
          });
          if (!cancelled && !blocked) {
            window.setTimeout(connect, 3000);
          }
        });

        return () => {
          cancelled = true;
          if (socket) {
            try {
              socket.off("performance:update");
              socket.disconnect();
            } catch {}
          }
                  if (assignmentsSocket) {
                    try {
                      assignmentsSocket.off("task:completed");
                      assignmentsSocket.off("task:created");
                      assignmentsSocket.disconnect();
                    } catch {}
                  }
          timeoutsRef.current.forEach((t) => clearTimeout(t));
          timeoutsRef.current = [];
        };
      } catch {
        if (!cancelled) {
          window.setTimeout(connect, 2000);
        }
      }
    };

    connect();
  }, [pushAlert]);

  return (
    <>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          backgroundColor: colors.bgBody,
          color: colors.textPrimary,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <SidebarNav />

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <HeaderBar breadcrumb={breadcrumb} statusInfo={statusInfo} />
        {!wsStatus.connected && (
          <div style={wsBannerStyle}>
            <strong>WS:</strong>{" "}
            {wsStatus.blocked
              ? "blocked due to repeated reconnect failures"
              : `reconnecting attempt ${wsStatus.retries + 1}`}
            {wsStatus.lastError ? ` · ${wsStatus.lastError}` : ""}
          </div>
        )}
          <main
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1rem",
              backgroundColor: colors.bgBody,
              color: colors.textPrimary,
            }}
          >
            {children}
          </main>
        </div>
      </div>
      {liveAlerts.length > 0 && (
        <div style={toastStyles.stack}>
          {liveAlerts.map((alert) => (
            <div key={alert.id} style={toastStyles.card}>
              <div style={toastStyles.header}>
                <span
                  style={{
                    ...toastStyles.badge,
                    background: alert.area === "PRIJEM" ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)",
                    color: alert.area === "PRIJEM" ? "#34d399" : "#60a5fa",
                  }}
                >
                  {alert.area}
                </span>
                {alert.totalOrders !== undefined && (
                  <span style={toastStyles.total}>Ukupno: {alert.totalOrders}</span>
                )}
              </div>
              <div style={toastStyles.title}>{alert.title}</div>
              <div style={toastStyles.body}>
                {alert.message ? (
                  <span>{alert.message}</span>
                ) : (
                  <>
                    <span>
                      {(alert.deltaOrders ?? 0) === 1
                        ? "Završio je 1 nalog"
                        : `Završio je ${alert.deltaOrders ?? 0} naloga`}
                      {(alert.deltaItems ?? 0) > 0 ? ` · +${alert.deltaItems} artikala` : ""}
                    </span>
                    {(alert.deltaOrders ?? 0) > 0 && (alert.deltaItems ?? 0) === 0 && (
                      <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                        Sada je slobodan za dodeljivanje novog zadatka.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

const toastStyles = {
  stack: {
    position: "fixed" as const,
    top: 20,
    right: 24,
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
    width: 320,
    maxWidth: "calc(100vw - 40px)",
    zIndex: 999,
    pointerEvents: "none" as const,
  },
  card: {
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(148,163,184,0.4)",
    borderRadius: 14,
    padding: "14px 16px",
    boxShadow: "0 18px 45px rgba(8,14,35,0.45)",
    pointerEvents: "auto" as const,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  badge: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.35)",
    fontWeight: 700,
  },
  total: {
    color: "#cbd5f5",
    opacity: 0.85,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: "#f8fafc",
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: "#e2e8f0",
    opacity: 0.9,
  },
};
const wsBannerStyle = {
  background: "rgba(239, 68, 68, 0.15)",
  color: "#fee2e2",
  border: "1px solid rgba(248, 113, 113, 0.6)",
  padding: "6px 12px",
  borderRadius: 8,
  margin: "0 1rem 1rem",
  fontSize: 12,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

