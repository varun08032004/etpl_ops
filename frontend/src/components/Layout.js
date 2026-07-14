import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Box, Typography, Avatar, IconButton, Tooltip, Divider } from '@mui/material';
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
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

// Owner/admin/hr/finance get the full operational console.
// Everyone else (manager/employee) gets a scoped self-service view —
// they should not see company-wide financials, other people's records,
// or admin tools like Team logins / CSV import.
const PRIVILEGED_ROLES = ['owner', 'admin', 'hr', 'finance'];
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
    label: 'People',
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
      { to: '/sales', label: 'Sales', icon: TrendingUpOutlinedIcon },
      { to: '/invoices', label: 'Invoices', icon: ReceiptLongOutlinedIcon },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/accounting', label: 'Accounting', icon: AccountBalanceOutlinedIcon },
      { to: '/payroll', label: 'Payroll', icon: PaidOutlinedIcon },
      { to: '/expenses', label: 'Recurring Expenses', icon: EventRepeatOutlinedIcon },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/documents', label: 'Documents', icon: DescriptionOutlinedIcon },
      { to: '/import', label: 'Import CSV', icon: UploadFileOutlinedIcon },
      { to: '/automation', label: 'Automation', icon: BoltOutlinedIcon },
      { to: '/ai-assistant', label: 'AI Assistant', icon: SmartToyOutlinedIcon },
    ],
  },
];

const ADMIN_NAV_GROUP = {
  label: 'Admin',
  items: [
    { to: '/admin', label: 'Permissions & Audit', icon: AdminPanelSettingsOutlinedIcon },
  ],
};

const SELF_SERVICE_NAV = [
  { to: '/', label: 'My Profile', icon: PersonOutlinedIcon, end: true },
];

export default function Layout() {
  const { staff, logout } = useAuth();
  const navigate = useNavigate();
  const isPrivileged = PRIVILEGED_ROLES.includes(staff?.role);
  const isAdmin = ADMIN_ROLES.includes(staff?.role);
  const navGroups = isAdmin ? [...NAV_GROUPS, ADMIN_NAV_GROUP] : NAV_GROUPS;

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
            navGroups.map((group) => (
              <Box key={group.label} sx={{ mb: 1 }}>
                <Typography sx={{ px: 1.5, pt: 1.5, pb: 0.5, fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {group.label}
                </Typography>
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <Box
                    key={to} component={NavLink} to={to} end={end}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1,
                      borderRadius: 1.5, color: 'text.secondary', fontSize: '0.875rem', fontWeight: 500,
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
                    <Icon className="nav-icon" sx={{ fontSize: 20 }} />
                    {label}
                  </Box>
                ))}
              </Box>
            ))
          ) : (
            SELF_SERVICE_NAV.map(({ to, label, icon: Icon, end }) => (
              <Box
                key={to} component={NavLink} to={to} end={end}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1,
                  borderRadius: 1.5, color: 'text.secondary', fontSize: '0.875rem', fontWeight: 500,
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
                <Icon className="nav-icon" sx={{ fontSize: 20 }} />
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
            <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{staff?.email}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'capitalize' }}>
              {staff?.role === 'owner' ? 'Founder' : staff?.role}
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