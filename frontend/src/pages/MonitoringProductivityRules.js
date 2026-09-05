import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Alert, Chip, CircularProgress, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  ResponsiveTableContainer,
  MobileButton,
  MobileTextField,
  useMobile,
} from '../components/MobileResponsive';
import client from '../api/client';

const CATEGORIES = ['productive', 'neutral', 'distracting', 'blocked'];
const MATCH_TYPES = ['app', 'domain'];

export default function MonitoringProductivityRules() {
  const isMobile = useMobile();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ match_type: 'app', pattern: '', category: 'neutral', name: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/monitoring/productivity-rules');
      setRules(data.rules || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (editing) {
        await client.put(`/monitoring/productivity-rules/${editing.id}`, form);
      } else {
        await client.post('/monitoring/productivity-rules', form);
      }
      setDialogOpen(false);
      setEditing(null);
      setForm({ match_type: 'app', pattern: '', category: 'neutral', name: '' });
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    setLoading(true);
    try {
      await client.delete(`/monitoring/productivity-rules/${id}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete rule');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({ match_type: rule.match_type, pattern: rule.pattern, category: rule.category, name: rule.name });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ match_type: 'app', pattern: '', category: 'neutral', name: '' });
    setDialogOpen(true);
  };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Productivity Rules</Typography>
        <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openNew}>New Rule</MobileButton>
      </MobilePageHeader>

      <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? '0.7rem' : '0.8rem', mb: 2 }}>
        Rules categorize apps and websites. App rules match exact executable name. Domain rules match substring (e.g., "youtube.com" catches "www.youtube.com").
        Order matters — first match wins. Use specific rules before broad ones.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <MobilePaper>
        {loading ? (
          <CircularProgress size={22} sx={{ display: 'block', margin: 'auto', py: 4 }} />
        ) : (
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Pattern</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{r.name || '—'}</TableCell>
                    <TableCell><Chip size="small" label={r.match_type} variant="outlined" /></TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.pattern}</TableCell>
                    <TableCell><Chip size="small" label={r.category} color={categoryColor(r.category)} variant="outlined" /></TableCell>
                    <TableCell><Chip size="small" label={r.is_active ? 'Yes' : 'No'} color={r.is_active ? 'success' : 'default'} variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!rules.length && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No rules yet. Click "New Rule" to add one.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        )}
      </MobilePaper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Rule' : 'New Rule'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField
              fullWidth
              label="Name (display only)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <MobileTextField
              fullWidth
              select
              label="Match Type"
              value={form.match_type}
              onChange={(e) => setForm({ ...form, match_type: e.target.value })}
              options={MATCH_TYPES.map((m) => ({ value: m, label: m === 'app' ? 'App (exact executable name)' : 'Domain (substring)' }))}
            />
            <MobileTextField
              fullWidth
              label="Pattern"
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              placeholder={form.match_type === 'app' ? 'code, chrome, slack' : 'youtube.com, github.com'}
              required
            />
            <MobileTextField
              fullWidth
              select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </MobileFormGrid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={loading || !form.pattern}>
            {loading ? 'Saving…' : (editing ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function categoryColor(cat) {
  switch (cat) {
    case 'productive': return 'success';
    case 'neutral': return 'default';
    case 'distracting': return 'warning';
    case 'blocked': return 'error';
    default: return 'default';
  }
}