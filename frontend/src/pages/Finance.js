import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import Money from '../components/Money';
import { useAuth } from '../context/AuthContext';

const STATUS_COLOR = { pending: 'warning', approved: 'success', rejected: 'error', paid: 'info' };
const CATEGORIES = ['travel', 'meals', 'software', 'office_supplies', 'client_entertainment', 'training', 'other'];

function SubmitClaimDialog({ open, onClose, onSubmitted }) {
  const [form, setForm] = useState({ category: 'travel', description: '', amount: '', expense_date: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      let receipt_document_id = null;
      if (receiptFile) {
        const fd = new FormData();
        fd.append('file', receiptFile);
        fd.append('title', `Receipt — ${form.category}`);
        fd.append('doc_type', 'expense_receipt');
        fd.append('entity_type', 'expense_claim');
        fd.append('entity_id', 'pending'); // linked properly once claim exists; acceptable for a receipt attachment
        const { data } = await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        receipt_document_id = data.document.id;
      }
      await client.post('/finance/expense-claims', { ...form, receipt_document_id });
      setForm({ category: 'travel', description: '', amount: '', expense_date: '' });
      setReceiptFile(null);
      onClose();
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit claim');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Submit expense claim</DialogTitle>
      <DialogContent>
        <TextField fullWidth select label="Category" margin="normal" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c.replace('_', ' ')}</MenuItem>)}
        </TextField>
        <TextField fullWidth label="Description" margin="normal" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <TextField fullWidth type="number" label="Amount (₹)" margin="normal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <TextField fullWidth type="date" label="Expense date" InputLabelProps={{ shrink: true }} margin="normal" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
        <Button component="label" variant="outlined" fullWidth sx={{ mt: 1 }}>
          {receiptFile ? receiptFile.name : 'Attach receipt (optional)'}
          <input type="file" hidden onChange={(e) => setReceiptFile(e.target.files[0])} />
        </Button>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || !form.amount || !form.expense_date}>
          {saving ? 'Submitting…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ClaimsTable({ claims, showEmployee, onDecide }) {
  return (
    <Paper>
      <Table size="small">
        <TableHead>
          <TableRow>
            {showEmployee && <TableCell>Employee</TableCell>}
            <TableCell>Category</TableCell>
            <TableCell>Date</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>Level</TableCell>
            <TableCell>Status</TableCell>
            {onDecide && <TableCell align="right">Decide</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {claims.map((c) => (
            <TableRow key={c.id}>
              {showEmployee && <TableCell sx={{ fontSize: '0.85rem' }}>{c.employee_name}</TableCell>}
              <TableCell sx={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>{c.category.replace('_', ' ')}</TableCell>
              <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{c.expense_date?.slice(0, 10)}</TableCell>
              <TableCell align="right"><Money amount={c.amount} size="0.85rem" /></TableCell>
              <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{c.current_level}/{c.levels_required}</TableCell>
              <TableCell><Chip size="small" label={c.status} color={STATUS_COLOR[c.status]} /></TableCell>
              {onDecide && (
                <TableCell align="right">
                  <Button size="small" color="error" onClick={() => onDecide(c, 'rejected')}>Reject</Button>
                  <Button size="small" variant="contained" onClick={() => onDecide(c, 'approved')}>Approve</Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {!claims.length && (
            <TableRow><TableCell colSpan={showEmployee ? 7 : 6} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>Nothing here.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}

function ThresholdsTab() {
  const [thresholds, setThresholds] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => client.get('/finance/thresholds').then(({ data }) => setThresholds(data.thresholds)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    await client.put(`/finance/thresholds/${editing.id}`, {
      min_amount: editing.min_amount, max_amount: editing.max_amount, levels_required: editing.levels_required,
    });
    setEditing(null);
    load();
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2.5 }}>
        Controls how many approval levels an expense claim needs, by amount. 0 = auto-approved, no chain.
        Changing a band only affects claims submitted after the change — already-submitted claims keep their original requirement.
      </Alert>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Type</TableCell><TableCell align="right">Min (₹)</TableCell><TableCell align="right">Max (₹)</TableCell><TableCell align="right">Levels</TableCell><TableCell align="right"></TableCell></TableRow>
          </TableHead>
          <TableBody>
            {thresholds.map((t) => (
              <TableRow key={t.id}>
                <TableCell sx={{ fontSize: '0.85rem' }}>{t.request_type.replace('_', ' ')}</TableCell>
                <TableCell align="right"><Money amount={t.min_amount} size="0.8rem" /></TableCell>
                <TableCell align="right">{t.max_amount ? <Money amount={t.max_amount} size="0.8rem" /> : '∞'}</TableCell>
                <TableCell align="right">{t.levels_required}</TableCell>
                <TableCell align="right"><Button size="small" onClick={() => setEditing({ ...t })}>Edit</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit threshold band</DialogTitle>
        {editing && (
          <DialogContent>
            <TextField fullWidth type="number" label="Min amount" margin="normal" value={editing.min_amount} onChange={(e) => setEditing({ ...editing, min_amount: e.target.value })} />
            <TextField fullWidth type="number" label="Max amount (blank = unlimited)" margin="normal" value={editing.max_amount || ''} onChange={(e) => setEditing({ ...editing, max_amount: e.target.value })} />
            <TextField fullWidth select type="number" label="Levels required" margin="normal" value={editing.levels_required} onChange={(e) => setEditing({ ...editing, levels_required: Number(e.target.value) })}>
              {[0, 1, 2, 3].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </TextField>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function Finance() {
  const { staff } = useAuth();
  const isAdmin = ['owner', 'admin'].includes(staff?.role);
  const canSeeAll = ['owner', 'admin', 'finance'].includes(staff?.role);

  const [tab, setTab] = useState(0);
  const [myClaims, setMyClaims] = useState([]);
  const [pendingApproval, setPendingApproval] = useState([]);
  const [allClaims, setAllClaims] = useState([]);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [message, setMessage] = useState(null);

  const loadMine = () => client.get('/finance/expense-claims/mine').then(({ data }) => setMyClaims(data.claims)).catch(() => setMyClaims([]));
  const loadPending = () => client.get('/finance/expense-claims/pending-my-approval').then(({ data }) => setPendingApproval(data.claims)).catch(() => setPendingApproval([]));
  const loadAll = () => canSeeAll && client.get('/finance/expense-claims').then(({ data }) => setAllClaims(data.claims)).catch(() => setAllClaims([]));

  useEffect(() => { loadMine(); loadPending(); loadAll(); }, []);

  const decide = async (claim, decision) => {
    try {
      await client.post(`/finance/expense-claims/${claim.id}/decide`, { decision });
      loadPending(); loadMine(); loadAll();
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to record decision' });
    }
  };

  const TABS = ['My Claims', 'Pending My Approval', ...(canSeeAll ? ['All Claims'] : []), ...(isAdmin ? ['Thresholds'] : [])];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Finance</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSubmitOpen(true)}>Submit expense</Button>
      </Box>

      {message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        {TABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      {tab === 0 && <ClaimsTable claims={myClaims} showEmployee={false} />}
      {tab === 1 && <ClaimsTable claims={pendingApproval} showEmployee onDecide={decide} />}
      {tab === 2 && canSeeAll && <ClaimsTable claims={allClaims} showEmployee />}
      {((canSeeAll && tab === 3) || (!canSeeAll && tab === 2)) && isAdmin && <ThresholdsTab />}

      <SubmitClaimDialog open={submitOpen} onClose={() => setSubmitOpen(false)} onSubmitted={loadMine} />
    </Box>
  );
}