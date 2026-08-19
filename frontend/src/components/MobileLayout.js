import { useState, useEffect } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  AppBar,
  Toolbar,
  Typography,
  Collapse,
  Tooltip,
  InputAdornment,
  TextField,
} from '@mui/material';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import client from '../api/client';
import {
  PRIVILEGED_ROLES,
  ADMIN_ROLES,
  NAV_GROUPS,
  ADMIN_NAV_GROUP,
  ROLE_TO_NAV_GROUP_LABELS,
  SELF_SERVICE_NAV,
} from './Layout';
import { MobileButton, MobileAvatar } from './MobileResponsive';

function MobileLayout() {
  const { staff, logout } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deptAccess, setDeptAccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openGroups, setOpenGroups] = useState({});

  const isPrivileged = PRIVILEGED_ROLES.includes(staff?.role);
  const isAdmin = ADMIN_ROLES.includes(staff?.role);

  useEffect(() => {
    if (isPrivileged) return;
    client.get('/departments/my-access')
      .then(({ data }) => setDeptAccess(data))
      .catch(() => setDeptAccess(null));
  }, [isPrivileged]);

  const deptGrantedGroupLabels = new Set(
    (deptAccess?.effectiveRoles || []).flatMap((role) => ROLE_TO_NAV_GROUP_LABELS[role] || [])
  );

  useEffect(() => {
    if (isMobile) setDrawerOpen(false);
  }, [location.pathname, isMobile]);

  if (!isMobile) {
    return <Outlet />;
  }

  const navGroups = isAdmin ? [...NAV_GROUPS, ADMIN_NAV_GROUP] : NAV_GROUPS;

  const toggleGroup = (label) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const filteredNavGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (isPrivileged) return true;
      return deptGrantedGroupLabels.has(group.label) || item.to === '/' || item.to === '/my-activity';
    }),
  })).filter((group) => group.items.length > 0);

  const selfServiceNav = [...SELF_SERVICE_NAV, ...filteredNavGroups.flatMap((g) => g.items).filter((item) => item.to !== '/')];

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleLogout = async () => {
    await logout();
    setDrawerOpen(false);
  };

  const renderNavItem = (item, isActive) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={() => setDrawerOpen(false)}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <ListItem
        button
        disableGutters
        selected={isActive}
        sx={{
          px: 2,
          py: 1.5,
          borderRadius: 2,
          mx: 1,
          minHeight: 48,
          bgcolor: isActive ? 'rgba(47, 191, 113, 0.08)' : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
          '& .nav-icon': { color: isActive ? 'primary.main' : 'text.secondary' },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
          <item.icon className="nav-icon" sx={{ fontSize: 22 }} />
        </ListItemIcon>
        <ListItemText primary={item.label} primaryTypographyProps={{ sx: { fontWeight: 500, fontSize: '0.95rem' } }} />
      </ListItem>
    </NavLink>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', flexDirection: 'column' }}>
      {/* Mobile App Bar */}
      <AppBar position="fixed" elevation={4} sx={{ zIndex: 1200, backgroundColor: theme.palette.background.paper, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Toolbar variant="dense" sx={{ minHeight: 56 }}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 1 }}
            size="large"
          >
            <MenuIcon fontSize="large" />
          </IconButton>

          <Typography
            variant="h6"
            noWrap
            component="span"
            sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: '-0.01em', fontSize: '1.1rem' }}
          >
            ETPL <span style={{ color: 'var(--mui-palette-primary-main)' }}>Ops</span>
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <NotificationBell />
            <Tooltip title={staff?.email}>
              <MobileAvatar
                size="small"
                children={staff?.email?.[0]?.toUpperCase()}
                sx={{ bgcolor: 'primary.dark', width: 36, height: 36, fontSize: '0.75rem' }}
              />
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer - Modal with swipe gesture */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{
          keepMounted: true,
          BackdropProps: {
            timeout: 200,
          },
        }}
        sx={{
          drawer: { width: 300 },
          paper: {
            width: 300,
            borderRight: 'none',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            borderTopLeftRadius: 16,
            borderBottomLeftRadius: 16,
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Header with close button */}
          <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              ETPL <span style={{ color: 'var(--mui-palette-primary-main)' }}>Ops</span>
            </Typography>
            <IconButton onClick={() => setDrawerOpen(false)} size="large" aria-label="close drawer">
              <ChevronLeftIcon fontSize="large" />
            </IconButton>
          </Box>

          {/* User Profile Section */}
          <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <MobileAvatar
              size="medium"
              children={staff?.email?.[0]?.toUpperCase()}
              sx={{ bgcolor: 'primary.dark', width: 48, height: 48, fontSize: '1rem' }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{staff?.email}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textTransform: 'capitalize' }}>
                {staff?.role === 'owner' ? 'Founder' : staff?.role?.replace('_', ' ')}
                {deptAccess?.deptAccess?.isHOD ? ` · ${deptAccess.deptAccess.departmentName} Head` : ''}
              </Typography>
            </Box>
          </Box>

          {/* Search */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              placeholder="Search pages..."
              value={searchQuery}
              onChange={handleSearch}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="text.secondary" /></InputAdornment>,
              }}
              sx={{
                '& .MuiInputBase-input': { padding: '8px 12px', fontSize: '0.875rem' },
                '& .MuiInputLabel-root': { fontSize: '0.75rem' },
              }}
            />
          </Box>

          {/* Navigation */}
          <Box sx={{ flex: 1, overflow: 'auto', pb: 2 }}>
            <List component="nav" aria-label="main navigation" disablePadding>
              {isPrivileged ? (
                filteredNavGroups.map((group) => {
                  const isOpen = openGroups[group.label] ?? true;
                  return (
                    <Box key={group.label}>
                      <Divider sx={{ my: 0.5 }} />
                      <Box
                        onClick={() => toggleGroup(group.label)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 2,
                          py: 1,
                          cursor: 'pointer',
                          userSelect: 'none',
                          minHeight: 44,
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Typography
                          sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                        >
                          {group.label}
                        </Typography>
                        <ExpandMoreIcon
                          sx={{
                            fontSize: 20,
                            color: 'text.secondary',
                            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      </Box>
                      <Collapse in={isOpen} timeout={200} unmountOnExit>
                        <Box sx={{ px: 1 }}>
                          {group.items.map((item) => {
                            const isActive = location.pathname === item.to || (item.end !== false && location.pathname.startsWith(item.to + '/'));
                            return renderNavItem(item, isActive);
                          })}
                        </Box>
                      </Collapse>
                    </Box>
                  );
                })
              ) : (
                selfServiceNav.map((item) => {
                  const isActive = location.pathname === item.to || (item.end !== false && location.pathname.startsWith(item.to + '/'));
                  return renderNavItem(item, isActive);
                })
              )}
            </List>
          </Box>

          {/* Footer with logout */}
          <Divider />
          <Box sx={{ px: 2, py: 1.5 }}>
            <MobileButton
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<IconButton size="small" sx={{ p: 0, mr: -0.5 }}><LogoutOutlinedIcon sx={{ fontSize: 18 }} /></IconButton>}
              onClick={handleLogout}
            >
              Log out
            </MobileButton>
          </Box>
        </Box>
      </Drawer>

      {/* Main Content Area - with Outlet */}
      <Box component="main" sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        mt: '56px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.palette.background.default,
      }}>
        <Box sx={{ flex: 1, minHeight: 0, px: 1.5, pb: 3, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default MobileLayout;