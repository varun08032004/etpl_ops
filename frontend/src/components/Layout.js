import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Box, Typography, Avatar, IconButton, Tooltip, Divider, Collapse } from '@mui/material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import client from '../api/client';

// Owner/admin/hr/finance/legal_hod/compliance_hod get the full operational console.
// Everyone else (manager/employee) gets a scoped self-service view —
// they should not see company-wide financials, other people's records,
// or admin tools like Team logins / CSV import.
const PRIVILEGED_ROLES = ['owner', 'admin', 'hr', 'finance', 'legal_hod', 'compliance_hod'];
const ADMIN_ROLES = ['owner', 'admin'];

// Grouped instead of one flat list — 13+ items in a row was too much to scan.
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: DashboardOutlinedIcon, end: true },
      { to: '/analytics', label: 'Analytics', icon: InsightsOutlinedIcon },
    ],
  },
  {
    label: 'HR',
    items: [
      { to: '/employees', label: 'People', icon: PeopleOutlinedIcon },
      { to: '/attendance', label: 'Attendance', icon: AccessTimeOutlinedIcon },
      { to: '/org-structure', label: 'Org Structure', icon: AccountTreeOutlinedIcon },
      { to: '/team', label: 'Team logins', icon: GroupOutlinedIcon },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { to: '/crm', label: 'CRM', icon: BusinessOutlinedIcon },
      { to: '/sales', label: 'Sales', icon: TrendingUpOutlinedIcon },
      { to: '/invoices', label: 'Invoices', icon: ReceiptLongOutlinedIcon },
    ],
  },
  {
    label: 'Accounting',
    items: [
      { to: '/accounting', label: 'Accounting', icon: AccountBalanceOutlinedIcon },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance', label: 'Finance', icon: PaidOutlinedIcon },
      { to: '/payroll', label: 'Payroll', icon: PaidOutlinedIcon },
      { to: '/expenses', label: 'Recurring Expenses', icon: EventRepeatOutlinedIcon },
    ],
  },
  {
    label: 'Legal',
    items: [
      { to: '/one-time-compliance', label: 'Registrations', icon: FactCheckOutlinedIcon },
      { to: '/compliance', label: 'Compliance', icon: FactCheckOutlinedIcon },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/documents', label: 'Documents', icon: DescriptionOutlinedIcon },
      { to: '/document-engine', label: 'Document Engine', icon: ArticleOutlinedIcon },
      { to: '/templates', label: 'Templates', icon: ListAltOutlinedIcon },
      { to: '/import', label: 'Import CSV', icon: UploadFileOutlinedIcon },
      { to: '/automation', label: 'Automation', icon: BoltOutlinedIcon },
      { to: '/ai-assistant', label: 'AI Assistant', icon: SmartToyOutlinedIcon },
    ],
  },
];

// Maps a department's granted_roles entries to the existing NAV_GROUPS
// labels they should unlock for a non-privileged member. E.g. a plain
// 'employee' login sitting in a department with granted_roles=['finance']
// sees the Revenue/Accounting/Finance groups (the same routes finance.js/
// accounting.js/invoices.js/expenses.js already gate behind requireRole
// ('finance') — see middleware/auth.js + services/departmentAccess.js).
const ROLE_TO_NAV_GROUP_LABELS = {
  finance: ['Revenue', 'Accounting', 'Finance'],
  hr: ['HR'],
  legal_hod: ['Legal'],
  compliance_hod: ['Legal'],
};

const ADMIN_NAV_GROUP = {
  label: 'Admin',
  items: [
    { to: '/admin', label: 'Permissions & Audit', icon: AdminPanelSettingsOutlinedIcon },
  ],
};

const SELF_SERVICE_NAV = [
  { to: '/', label: 'My Profile', icon: PersonOutlinedIcon, end: true },
];

// Groups open by default so nothing is hidden on first load.
const ALL_GROUP_LABELS = [...NAV_GROUPS, ADMIN_NAV_GROUP].map((g) => g.label);
const DEFAULT_OPEN_STATE = Object.fromEntries(ALL_GROUP_LABELS.map((label) => [label, true]));
const STORAGE_KEY = 'sidebar-open-groups';

// Merge saved collapse state on top of defaults, so any newly-added group
// still defaults to open even if the user's saved state predates it.
function getInitialOpenState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_OPEN_STATE, ...JSON.parse(saved) };
  } catch {
    // ignore malformed/blocked storage, fall back to default
  }
  return DEFAULT_OPEN_STATE;
}

export default function Layout() {
  const { staff, logout } = useAuth();
  const navigate = useNavigate();
  const isPrivileged = PRIVILEGED_ROLES.includes(staff?.role);
  const isAdmin = ADMIN_ROLES.includes(staff?.role);
  const navGroups = isAdmin ? [...NAV_GROUPS, ADMIN_NAV_GROUP] : NAV_GROUPS;

  const [openGroups, setOpenGroups] = useState(getInitialOpenState);
  const [deptAccess, setDeptAccess] = useState(null);

  // Non-privileged staff (plain 'employee'/'manager') can still unlock whole
  // nav groups if their department grants a functional role — e.g. someone
  // in the Finance department sees Revenue/Accounting/Finance even though
  // their login role is just 'employee'. Privileged roles already see
  // everything, so this only matters for the self-service branch below.
  useEffect(() => {
    if (isPrivileged) return;
    client.get('/departments/my-access').then(({ data }) => setDeptAccess(data)).catch(() => setDeptAccess(null));
  }, [isPrivileged]);

  const deptGrantedGroupLabels = new Set(
    (deptAccess?.effectiveRoles || []).flatMap((role) => ROLE_TO_NAV_GROUP_LABELS[role] || [])
  );
  const deptGrantedNav = NAV_GROUPS
    .filter((group) => deptGrantedGroupLabels.has(group.label))
    .flatMap((group) => group.items)
    // "My Profile" (self-service home) always comes first, dedupe just in case.
    .filter((item) => item.to !== '/');
  const selfServiceNav = [...SELF_SERVICE_NAV, ...deptGrantedNav];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      // storage may be unavailable (private mode, quota) — non-critical, skip
    }
  }, [openGroups]);

  const toggleGroup = (label) => setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box
        component="nav"
        sx={{
          width: 232, flexShrink: 0, bgcolor: 'background.paper',
          borderRight: '1px solid', borderColor: 'divider',
          display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
        }}
      >
        <Box sx={{ px: 3, py: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
            ETPL <Box component="span" sx={{ color: 'primary.main' }}>Ops</Box>
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.25 }}>
            EtherTrack Technologies
          </Typography>
        </Box>

        <Box sx={{ px: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, overflowY: 'auto' }}>
          {isPrivileged ? (
            navGroups.map((group) => {
              const isOpen = openGroups[group.label] ?? true;
              return (
                <Box key={group.label} sx={{ mb: 1 }}>
                  <Box
                    onClick={() => toggleGroup(group.label)}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      px: 1.5, pt: 1.5, pb: 0.5, cursor: 'pointer', userSelect: 'none',
                      '&:hover .group-label': { color: 'text.primary' },
                    }}
                  >
                    <Typography
                      className="group-label"
                      sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                    >
                      {group.label}
                    </Typography>
                    <ExpandMoreIcon
                      sx={{
                        fontSize: 16, color: 'text.secondary',
                        transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </Box>
                  <Collapse in={isOpen} timeout={150}>
                    {group.items.map(({ to, label, icon: Icon, end }) => (
                      <Box
                        key={to} component={NavLink} to={to} end={end}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1,
                          borderRadius: 1.5, color: 'text.secondary', fontSize: '0.9375rem', fontWeight: 500,
                          position: 'relative',
                          '&.active': {
                            color: 'text.primary', bgcolor: 'rgba(47,191,113,0.08)',
                            '& .nav-icon': { color: 'primary.main' },
                            '&::before': {
                              content: '""', position: 'absolute', left: -6, top: '20%', bottom: '20%',
                              width: 3, borderRadius: 3, bgcolor: 'primary.main',
                            },
                          },
                          '&:hover': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.03)' },
                        }}
                      >
                        <Icon className="nav-icon" sx={{ fontSize: 21 }} />
                        {label}
                      </Box>
                    ))}
                  </Collapse>
                </Box>
              );
            })
          ) : (
            selfServiceNav.map(({ to, label, icon: Icon, end }) => (
              <Box
                key={to} component={NavLink} to={to} end={end}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1,
                  borderRadius: 1.5, color: 'text.secondary', fontSize: '0.9375rem', fontWeight: 500,
                  position: 'relative',
                  '&.active': {
                    color: 'text.primary', bgcolor: 'rgba(47,191,113,0.08)',
                    '& .nav-icon': { color: 'primary.main' },
                    '&::before': {
                      content: '""', position: 'absolute', left: -6, top: '20%', bottom: '20%',
                      width: 3, borderRadius: 3, bgcolor: 'primary.main',
                    },
                  },
                  '&:hover': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.03)' },
                }}
              >
                <Icon className="nav-icon" sx={{ fontSize: 21 }} />
                {label}
              </Box>
            ))
          )}
        </Box>

        <Divider />
        <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.dark' }}>
            {staff?.email?.[0]?.toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{staff?.email}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textTransform: 'capitalize' }}>
              {staff?.role === 'owner' ? 'Founder' : staff?.role?.replace('_', ' ')}
              {deptAccess?.deptAccess?.isHOD ? ` · ${deptAccess.deptAccess.departmentName} Head` : ''}
            </Typography>
          </Box>
          <Tooltip title="Log out">
            <IconButton size="small" onClick={async () => { await logout(); navigate('/login'); }}>
              <LogoutOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 4, pt: 2 }}>
          <NotificationBell />
        </Box>
        <Box sx={{ px: 4, pb: 4 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}