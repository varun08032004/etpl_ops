import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
} from '@mui/material';
import client from '../api/client';
import Money from '../components/Money';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Individual synced ledger records for a period, with void capability.
// Distinct from the Sales-tab "Platform Sales" view, which is raw
// read-only platform data with nothing to void — this one shows what's
// actually posted in YOUR books, and lets Finance correct a mistaken
// import by reversing it (never deletes anything).
export default function PlatformSyncLog() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [voidTarget, setVoidTarget] = useState(null); // record being voided
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const load = () => {
    setLoading(true);
    setError(null);
    client.get('/platform-sync/log', { params: { month, year } })
      .then(({ data }) => setRecords(data.records))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load synced records'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [month, year]);

  const openVoid = (record) => {
    setVoidTarget(record);
    setVoidReason('');
    setVoidError('');
  };

  const confirmVoid = async () => {
    if (!voidReason.trim()) { setVoidError('A reason is required.'); return; }
    setVoiding(true);
    setVoidError('');
    try {
      await client.post(`/platform-sync/records/${voidTarget.id}/void`, { reason: voidReason.trim() });
      setVoidTarget(null);
      load();
    } catch (e) {
      setVoidError(e.response?.data?.error || 'Failed to void this record');
    } finally {
      setVoiding(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2.5 }}>
        <TextField select size="small" label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ minWidth: 160 }}>
          {MONTHS.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
          {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
      {loading && <CircularProgress size={22} />}

      {!loading && records && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Journal Entry</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Synced by</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{new Date(r.entry_date).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell><Chip size="small" label={r.source === 'trade_fee' ? 'Trade' : 'Subscription'} variant="outlined" /></TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }} className="figure">{r.entry_number}</TableCell>
                  <TableCell align="right"><Money amount={r.amount_inr} size="0.85rem" /></TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{r.synced_by_email || '—'}</TableCell>
                  <TableCell>
                    {r.voided ? (
                      <Chip size="small" color="warning" label={`Voided — ${r.reversal_entry_number}`} />
                    ) : (
                      <Chip size="small" color="success" variant="outlined" label="Posted" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {!r.voided && (
                      <Button size="small" color="error" onClick={() => openVoid(r)}>Void</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 3 }}>
                  No synced records for {MONTHS[month - 1]} {year}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={!!voidTarget} onClose={() => setVoidTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Void synced record</DialogTitle>
        <DialogContent>
          {voidTarget && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                This posts a reversing journal entry for {voidTarget.entry_number}. The original entry
                stays in the books — nothing is deleted. This cannot be undone from here; a fresh
                correct import (if needed) is a separate step.
              </Alert>
              <TextField
                fullWidth multiline rows={2} autoFocus
                label="Reason for voiding"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                margin="normal"
              />
              {voidError && <Alert severity="error" sx={{ mt: 1 }}>{voidError}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoidTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmVoid} disabled={voiding}>
            {voiding ? 'Voiding…' : 'Void entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}