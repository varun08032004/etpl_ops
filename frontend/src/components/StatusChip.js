import { Chip } from '@mui/material';

const COLOR_MAP = {
  paid: 'success', sent: 'info', draft: 'default', overdue: 'error', void: 'default',
  partially_paid: 'warning', active: 'success', exited: 'default', on_leave: 'warning',
  notice_period: 'warning', pending: 'default', approved: 'success', rejected: 'error',
  processing: 'info', failed: 'error',
};

export default function StatusChip({ status }) {
  const color = COLOR_MAP[status] || 'default';
  const label = String(status || '').replace(/_/g, ' ');
  return <Chip size="small" label={label} color={color} variant={color === 'default' ? 'outlined' : 'filled'} sx={{ textTransform: 'capitalize' }} />;
}
