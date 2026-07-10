import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Box, Typography, Avatar, IconButton, Tooltip, Divider } from '@mui/material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: DashboardOutlinedIcon, end: true },
  { to: '/employees', label: 'People', icon: PeopleOutlinedIcon },
  { to: '/invoices', label: 'Invoices', icon: ReceiptLongOutlinedIcon },
  { to: '/accounting', label: 'Accounting', icon: AccountBalanceOutlinedIcon },
  { to: '/payroll', label: 'Payroll', icon: PaidOutlinedIcon },
  { to: '/import', label: 'Import CSV', icon: UploadFileOutlinedIcon },
  { to: '/team', label: 'Team logins', icon: GroupOutlinedIcon },
];

export default function Layout() {
  const { staff, logout } = useAuth();
  const navigate = useNavigate();

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

        <Box sx={{ px: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
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

        <Divider />
        <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.dark' }}>
            {staff?.email?.[0]?.toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{staff?.email}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'capitalize' }}>{staff?.role}</Typography>
          </Box>
          <Tooltip title="Log out">
            <IconButton size="small" onClick={async () => { await logout(); navigate('/login'); }}>
              <LogoutOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box component="main" sx={{ flex: 1, minWidth: 0, p: 4 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
