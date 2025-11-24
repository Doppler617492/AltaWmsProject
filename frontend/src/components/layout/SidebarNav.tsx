import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { colors } from '../../theme/colors';
import { IconDashboard } from "../icons/IconDashboard";
import { IconKpi } from "../icons/IconKpi";
import { IconWorkforce } from "../icons/IconWorkforce";
import { IconInbound } from "../icons/IconInbound";
import { IconOutbound } from "../icons/IconOutbound";
import { IconStock } from "../icons/IconStock";
import { IconAdmin } from "../icons/IconAdmin";
import { IconCommandCenter } from "../icons/IconCommandCenter";
import { IconSla } from "../icons/IconSla";
import { IconMap } from "../icons/IconMap";
import { IconSkart } from "../icons/IconSkart";
import { IconPovracaj } from "../icons/IconPovracaj";
import { IconReports } from "../icons/IconReports";

const navItems = [
  { label: "Kontrolna tabla", icon: IconDashboard, href: "/dashboard", roles: ['admin', 'menadzer', 'sef', 'magacioner', 'komercialista', 'komercijalista'] },
  { label: "KPI tabla", icon: IconKpi, href: "/kpi", roles: ['admin', 'menadzer', 'sef'] },
  { label: "Komandni centar", icon: IconCommandCenter, href: "/command-center", roles: ['admin', 'menadzer', 'sef', 'logistika'] },
  { label: "SLA usklađenost", icon: IconSla, href: "/sla", roles: ['admin', 'menadzer', 'sef'] },
  { label: "Izveštaji", icon: IconReports, href: "/reports", roles: ['admin', 'menadzer', 'sef'] },
  { label: "Radna snaga", icon: IconWorkforce, href: "/workforce", roles: ['admin', 'menadzer', 'sef'] },
  { label: "Prijem", icon: IconInbound, href: "/receiving", roles: ['admin', 'menadzer', 'sef', 'magacioner', 'logistika'] },
  { label: "Otprema", icon: IconOutbound, href: "/shipping", roles: ['admin', 'menadzer', 'sef', 'magacioner', 'komercialista', 'komercijalista'] },
  { label: "Skart", icon: IconSkart, href: "/skart", roles: ['admin', 'menadzer', 'sef', 'sef_magacina', 'sef_prodavnice'] },
  { label: "Povraćaj", icon: IconPovracaj, href: "/povracaj", roles: ['admin', 'menadzer', 'sef', 'sef_magacina', 'sef_prodavnice'] },
  { label: "Analitika", icon: IconKpi, href: "/analytics", roles: ['admin', 'menadzer', 'sef'] },
  { label: "Mapa skladišta", icon: IconMap, href: "/warehouse-map", roles: ['admin', 'menadzer', 'sef'] },
  { label: "Etikete", icon: IconMap, href: "/labeling", roles: ['admin', 'sef_magacina'] },
  { label: "Timovi", icon: IconWorkforce, href: "/teams", roles: ['admin', 'menadzer', 'sef'] },
  { label: "Zalihe & Popis", icon: IconStock, href: "/stock", roles: ['admin', 'menadzer', 'sef'] },
  { label: "Administracija", icon: IconAdmin, href: "/users", roles: ['admin', 'menadzer'] },
];

export const SidebarNav: React.FC = () => {
  const router = useRouter();
  const path = router.pathname;
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const normalize = (r: string | null | undefined) => (r || '').toLowerCase();

  React.useEffect(() => {
    // Get user role from token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = normalize(payload.role);
        const rolesArr: string[] = Array.isArray(payload.roles) ? payload.roles : [];
        const primary = role || normalize(rolesArr[0]);
        setUserRole(primary);
      } catch {}
    }
  }, []);

  // Filter nav items based on role
  const visibleItems = navItems.filter(item => {
    // Temporarily hide warehouse map from navigation
    if (item.href === '/warehouse-map') return false;
    // Temporarily disable Etikete module
    if (item.href === '/labeling') return false;
    if (!item.roles) return true; // No role restriction
    if (!userRole) return false;
    return item.roles.map(normalize).includes(normalize(userRole));
  });

  const accent = '#fcd34d';
  const baseCard = '#1f232d';
  const baseText = '#f3f4f6';
  const mutedText = 'rgba(243,244,246,0.65)';

  return (
    <aside
      style={{
        width: 260,
        background: "linear-gradient(180deg, #0e1118 0%, #050609 100%)",
        borderRight: `1px solid ${colors.borderDefault}`,
        display: "flex",
        flexDirection: "column",
        padding: "1.25rem",
        boxSizing: "border-box",
        color: colors.brandYellow,
        fontFamily: "Inter, sans-serif",
        gap: "1rem",
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:10, padding: '0 0 18px 0', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
        <img src="/logo-white.svg" alt="Alta WMS" style={{ height: 40 }} />
        <div style={{ display:'flex', flexDirection:'column', lineHeight:1.1 }}>
          <span style={{ fontWeight:700, letterSpacing:1, color:'#fff' }}>ALTA</span>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.6)' }}>WMS</span>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                textDecoration: "none",
                padding: "0.85rem 1rem",
                background: active ? accent : baseCard,
                borderRadius: "14px",
                color: active ? '#111' : baseText,
                fontSize: "0.95rem",
                fontWeight: active ? 650 : 500,
                lineHeight: 1.2,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                boxShadow: active ? "0 14px 28px rgba(0,0,0,0.35)" : "0 8px 18px rgba(0,0,0,0.35)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <span style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                background: active ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.04)',
              }}>
                <Icon size={18} color={active ? '#111' : mutedText} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
