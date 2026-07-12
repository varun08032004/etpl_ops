import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Badge, Menu, MenuItem, Typography, Box, Divider, Button } from '@mui/material';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import client from '../api/client';

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const load = () => client.get('/automation/notifications').then(({ data }) => {
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }).catch(() => {});

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // poll every minute — no websockets/push set up
    return () => clearInterval(interval);
  }, []);

  const handleClick = async (n) => {
    if (!n.is_read) await client.post(`/automation/notifications/${n.id}/read`);
    setAnchorEl(null);
    load();
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    await client.post('/automation/notifications/mark-all-read');
    load();
  };

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsOutlinedIcon sx={{ fontSize: 20 }} />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { width: 340, maxHeight: 420 } }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Notifications</Typography>
          {unreadCount > 0 && <Button size="small" onClick={markAllRead}>Mark all read</Button>}
        </Box>
        <Divider />
        {notifications.map((n) => (
          <MenuItem key={n.id} onClick={() => handleClick(n)} sx={{ whiteSpace: 'normal', py: 1.25, bgcolor: n.is_read ? 'transparent' : 'rgba(47,191,113,0.06)' }}>
            <Box>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{n.title}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{n.body}</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.25 }}>{new Date(n.created_at).toLocaleString()}</Typography>
            </Box>
          </MenuItem>
        ))}
        {!notifications.length && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>No notifications yet.</Typography>
          </Box>
        )}
      </Menu>
    </>
  );
}