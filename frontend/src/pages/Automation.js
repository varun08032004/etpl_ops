import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Switch, Button, Alert } from '@mui/material';
import client from '../api/client';
import StatusChip from '../components/StatusChip';

export default function Automation() {
  const [rules, setRules] = useState([]);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  const load = () => client.get('/automation/rules').then(({ data }) => setRules(data.rules));
  useEffect(() => { load(); }, []);

  const toggle = async (id) => {
    await client.post(`/automation/rules/${id}/toggle`);
    load();
  };

  const runOverdueCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const { data } = await client.post('/automation/run-overdue-check');
      setCheckResult(`Flagged ${data.flaggedCount} newly-overdue invoice(s) and notified Finance.`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>Automation</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 3 }}>
        Simple trigger→action rules on data that already exists — not a workflow builder. To add a new rule, it needs a code change (see <code>backend/db/automation_schema.sql</code>), by design, since anything more open-ended is real scope on its own.
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow><TableCell>Rule</TableCell><TableCell>Trigger</TableCell><TableCell>Action</TableCell><TableCell align="right">Active</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell sx={{ fontSize: '0.85rem' }}>{r.name}</TableCell>
                <TableCell><StatusChip status={r.trigger_event} /></TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{r.action_type.replace(/_/g, ' ')}</TableCell>
                <TableCell align="right"><Switch checked={r.is_active} onChange={() => toggle(r.id)} size="small" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: 3, maxWidth: 480 }}>
        <Typography sx={{ fontWeight: 600, mb: 1 }}>Overdue invoice check</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
          Time-based triggers need something to run them — no cron job is set up yet, so run this manually for now, or wire a scheduled job to hit this same endpoint daily.
        </Typography>
        <Button variant="contained" onClick={runOverdueCheck} disabled={checking}>
          {checking ? 'Checking…' : 'Run overdue check now'}
        </Button>
        {checkResult && <Alert severity="success" sx={{ mt: 2 }}>{checkResult}</Alert>}
      </Paper>
    </Box>
  );
}