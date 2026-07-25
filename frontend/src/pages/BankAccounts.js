import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import Money from '../components/Money';
import { useAuth } from '../context/AuthContext';

const PROVIDERS = [
  { value: 'manual', label: 'Manual (no API sync)' },
  { value: 'axis', label: 'Axis Bank (API sync)' },
];

function AddAccountDialog({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    account_name: '', bank_name: '', account_number: '', ifsc_code: '', provider: 'manual',
    api_client_id: '', api_client_secret: '', api_base_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isNonManual = form.provider !== 'manual';

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/bank-accounts', form);
      setForm({ account_name: '', bank_name: '', account_number: '', ifsc_code: '', provider: 'manual', api_client_id: '', api_client_secret: '', api_base_url: '' });
      onClose();
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add bank account</DialogTitle>
      <DialogContent>
        <TextField fullWidth label="Account nickname" margin="normal" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="e.g. Axis Current Account — Ops" />
        <TextField fullWidth label="Bank name" margin="normal" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
        <TextField fullWidth label="Account number" margin="normal" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
        <TextField fullWidth label="IFSC code (optional)" margin="normal" value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value })} />
        <TextField fullWidth select label="Provider" margin="normal" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
          {PROVIDERS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
        </TextField>

        {isNonManual && (
          <>
            <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
              Each account needs its own API credentials, even if you have multiple accounts at the same bank — they don't share one global config.
            </Alert>
            <TextField fullWidth label="API Client ID" margin="normal" value={form.api_client_id} onChange={(e) => setForm({ ...form, api_client_id: e.target.value })} />
            <TextField fullWidth label="API Client Secret" type="password" margin="normal" value={form.api_client_secret} onChange={(e) => setForm({ ...form, api_client_secret: e.target.value })} />
            <TextField fullWidth label="API Base URL" margin="normal" value={form.api_base_url} onChange={(e) => setForm({ ...form, api_base_url: e.target.value })} placeholder="https://api.axisbank.com/..." />
          </>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave}
          disabled={saving || !form.account_name || !form.bank_name || !form.account_number || (isNonManual && (!form.api_client_id || !form.api_client_secret || !form.api_base_url))}
        >
          {saving ? 'Saving…' : 'Add account'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function UpdateBalanceDialog({ account, onClose, onSaved }) {
  const [balance, setBalance] = useState(account?.current_balance || '');
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    try {
      await client.put(`/bank-accounts/${account.id}/balance`, { balance });
      onClose();
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update balance');
    }
  };

  return (
    <Dialog open={!!account} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Update balance — {account?.account_name}</DialogTitle>
      <DialogContent>
        <TextField fullWidth type="number" label="Current balance (₹)" margin="normal" value={balance} onChange={(e) => setBalance(e.target.value)} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function UpdateCredentialsDialog({ account, onClose, onSaved }) {
  const [form, setForm] = useState({ api_client_id: '', api_client_secret: '', api_base_url: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (account) { setForm({ api_client_id: '', api_client_secret: '', api_base_url: '' }); setError(''); }
  }, [account]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await client.put(`/bank-accounts/${account.id}/credentials`, form);
      onClose();
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!account} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Update API credentials — {account?.account_name}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>
          These are specific to this account only — updating them won't affect any of your other accounts, even at the same bank.
        </Typography>
        <TextField fullWidth label="API Client ID" margin="normal" value={form.api_client_id} onChange={(e) => setForm({ ...form, api_client_id: e.target.value })} />
        <TextField fullWidth label="API Client Secret" type="password" margin="normal" value={form.api_client_secret} onChange={(e) => setForm({ ...form, api_client_secret: e.target.value })} />
        <TextField fullWidth label="API Base URL" margin="normal" value={form.api_base_url} onChange={(e) => setForm({ ...form, api_base_url: e.target.value })} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.api_client_id || !form.api_client_secret || !form.api_base_url}>
          {saving ? 'Saving…' : 'Save credentials'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function BankAccounts() {
  const { staff } = useAuth();
  const authorized = ['owner', 'admin', 'finance'].includes(staff?.role);

  const [accounts, setAccounts] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [currencyWarning, setCurrencyWarning] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [balanceDialogAccount, setBalanceDialogAccount] = useState(null);
  const [credentialsDialogAccount, setCredentialsDialogAccount] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [message, setMessage] = useState(null);

  const load = () => client.get('/bank-accounts')
    .then(({ data }) => { setAccounts(data.accounts); setTotalBalance(data.totalBalanceInr); setCurrencyWarning(data.currencyWarning); })
    .catch(() => setAccounts([]));

  useEffect(() => { if (authorized) load(); }, []);

  const runSync = async (account) => {
    setSyncingId(account.id);
    setMessage(null);
    try {
      const { data } = await client.post(`/bank-accounts/${account.id}/sync`);
      setMessage({ severity: 'success', text: `Synced ${data.transactionsInserted ?? 0} new transaction(s), auto-matched ${data.autoMatched ?? 0}.` });
      load();
    } catch (err) {
      setMessage({ severity: 'warning', text: err.response?.data?.error || 'Sync failed — this account may be set to manual, or its API credentials may not be configured yet.' });
    } finally {
      setSyncingId(null);
    }
  };

  if (!authorized) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">This page is restricted to Owner, Admin, and Finance roles.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Bank Accounts</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Add account</Button>
      </Box>

      {message && <Alert severity={message.severity} sx={{ mb: 2.5 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
      {currencyWarning && <Alert severity="warning" sx={{ mb: 2.5 }}>{currencyWarning}</Alert>}

      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total cash position — all accounts</Typography>
        <Money amount={totalBalance} size="1.6rem" />
      </Paper>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Account</TableCell>
              <TableCell>Bank</TableCell>
              <TableCell>Account #</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell>As of</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.account_name}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{a.bank_name}</TableCell>
                <TableCell className="figure" sx={{ fontSize: '0.85rem' }}>•••• {a.account_number_last4}</TableCell>
                <TableCell>
                  <Chip size="small" label={a.provider} color={a.provider === 'manual' ? 'default' : 'success'} variant={a.provider === 'manual' ? 'outlined' : 'filled'} />
                  {a.provider !== 'manual' && !a.api_configured && (
                    <Typography sx={{ fontSize: '0.68rem', color: 'error.main', mt: 0.25 }}>No credentials set</Typography>
                  )}
                </TableCell>
                <TableCell align="right"><Money amount={a.current_balance || 0} size="0.9rem" /></TableCell>
                <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                  {a.balance_as_of ? new Date(a.balance_as_of).toLocaleString() : '—'}
                  {a.balance_source && <Typography sx={{ fontSize: '0.7rem' }}>({a.balance_source})</Typography>}
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setBalanceDialogAccount(a)}>Update balance</Button>
                  {a.provider !== 'manual' && (
                    <>
                      <Button size="small" onClick={() => setCredentialsDialogAccount(a)}>
                        {a.api_configured ? 'Update credentials' : 'Set credentials'}
                      </Button>
                      <Button size="small" disabled={syncingId === a.id} onClick={() => runSync(a)}>
                        {syncingId === a.id ? 'Syncing…' : 'Sync'}
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!accounts.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No bank accounts added yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <AddAccountDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
      <UpdateBalanceDialog account={balanceDialogAccount} onClose={() => setBalanceDialogAccount(null)} onSaved={load} />
      <UpdateCredentialsDialog account={credentialsDialogAccount} onClose={() => setCredentialsDialogAccount(null)} onSaved={load} />
    </Box>
  );
}