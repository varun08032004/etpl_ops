import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton, Badge, Popover, Box, Typography, List, ListItemButton,
  ListItemText, Divider, Button,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import client from '../api/client';

// Poll every 30s rather than a websocket — simple, cheap, good enough for an
// internal ops tool with a handful of concurrent staff.
const POLL_MS = 30000;

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const timerRef = useRef(null);

  const load = () => {
    client.get('/notifications').then(({ data }) => {
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, []);

  const openMenu = (e) => { setAnchorEl(e.currentTarget); load(); };
  const closeMenu = () => setAnchorEl(null);

  const handleClick = async (n) => {
    if (!n.is_read) {
      await client.post(`/notifications/${n.id}/read`);
      load();
    }
    closeMenu();
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    await client.post('/notifications/read-all');
    load();
  };

  return (
    <>
      <IconButton onClick={openMenu} size="small">
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: 340, maxHeight: 420, overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</Typography>
            {unreadCount > 0 && <Button size="small" onClick={markAllRead}>Mark all read</Button>}
          </Box>
          <Divider />
          <List dense disablePadding>
            {notifications.map((n) => (
              <ListItemButton key={n.id} onClick={() => handleClick(n)} sx={{ bgcolor: n.is_read ? 'transparent' : 'action.hover' }}>
                <ListItemText
                  primary={<Typography sx={{ fontSize: '0.82rem', fontWeight: n.is_read ? 400 : 600 }}>{n.title}</Typography>}
                  secondary={
                    <>
                      {n.body && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{n.body}</Typography>}
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{new Date(n.created_at).toLocaleString()}</Typography>
                    </>
                  }
                />
              </ListItemButton>
            ))}
            {!notifications.length && (
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', textAlign: 'center', py: 3 }}>
                No notifications yet.
              </Typography>
            )}
          </List>
        </Box>
      </Popover>
    </>
  );
}