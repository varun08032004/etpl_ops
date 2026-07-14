import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody, TextField, Chip } from '@mui/material';
import client from '../api/client';

const LEVEL_COLOR = { full: 'success', view: 'info', none: 'default' };

function PermissionsMatrix() {
  const [data, setData] = useState(null);
  useEffect(() => { client.get('/admin/permissions-matrix').then(({ data }) => setData(data)); }, []);
  if (!data) return null;

  return (
    <Box>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2.5 }}>
        This documents what's actually enforced in code — it's a reference view, not a separate
        configurable permission engine. Changing access levels means changing the underlying route code.
      </Typography>
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Module</TableCell>
              {data.roles.map((r) => <TableCell key={r} sx={{ textTransform: 'capitalize' }}>{r}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.modules.map((m) => (
              <TableRow key={m.module}>
                <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{m.module}</TableCell>
                {data.roles.map((r) => {
                  const val = m[r];
                  const color = LEVEL_COLOR[val] || 'warning';
                  return (
                    <TableCell key={r}>
                      <Chip size="small" label={val} color={color} variant={color === 'default' ? 'outlined' : 'filled'} sx={{ fontSize: '0.68rem' }} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [actionFilter, setActionFilter] = useState('');

  const load = () => client.get('/admin/audit-log', { params: actionFilter ? { action: actionFilter } : {} }).then(({ data }) => setEntries(data.entries));
  useEffect(() => { load(); }, [actionFilter]);

  return (
    <Box>
      <TextField size="small" label="Filter by action (e.g. 'role_changed')" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} sx={{ mb: 2.5, minWidth: 320 }} />
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>When</TableCell><TableCell>Who</TableCell><TableCell>Action</TableCell><TableCell>Entity</TableCell><TableCell>Details</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell sx={{ fontSize: '0.78rem' }} className="figure">{new Date(e.created_at).toLocaleString()}</TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{e.staff_email || 'system'}</TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}><Chip size="small" label={e.action} variant="outlined" /></TableCell>
                <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{e.entity}</TableCell>
                <TableCell sx={{ fontSize: '0.72rem', color: 'text.secondary', maxWidth: 320 }}>
                  {e.old_value && <span>from {JSON.stringify(e.old_value)} </span>}
                  {e.new_value && <span>→ {JSON.stringify(e.new_value)}</span>}
                </TableCell>
              </TableRow>
            ))}
            {!entries.length && <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No audit entries yet — they'll appear as staff accounts get created, roles change, or employees exit.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

export default function Admin() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Admin</Typography>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Permissions Matrix" />
        <Tab label="Audit Log" />
      </Tabs>
      {tab === 0 && <PermissionsMatrix />}
      {tab === 1 && <AuditLog />}
    </Box>
  );
}