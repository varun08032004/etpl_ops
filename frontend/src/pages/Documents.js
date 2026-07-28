import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, IconButton, Tooltip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import { useAuth } from '../context/AuthContext';

const DOC_TYPES = ['contract', 'offer_letter', 'nda', 'policy', 'certificate', 'board_resolution', 'invoice_attachment', 'id_proof', 'other'];
const ENTITY_TYPES = ['company', 'employee', 'vendor_customer', 'invoice', 'bill'];

export default function Documents() {
  const { staff } = useAuth();
  const [docs, setDocs] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', doc_type: 'contract', entity_type: 'company', entity_id: '', expiry_date: '' });
  const [file, setFile] = useState(null);
  const [historyDoc, setHistoryDoc] = useState(null);
  const [history, setHistory] = useState([]);

  // Duplicate-resolution dialog state — populated when the backend responds
  // 409 to an upload because a document with the same title already exists
  // in the same entity scope.
  const [duplicateInfo, setDuplicateInfo] = useState(null); // { existing, message }
  const [resolving, setResolving] = useState(false);

  const load = () => client.get('/documents').then(({ data }) => setDocs(data.documents));
  useEffect(() => { load(); }, []);

  const buildFormData = (extra = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, v); });
    Object.entries(extra).forEach(([k, v]) => formData.append(k, v));
    return formData;
  };

  const handleUpload = async () => {
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      await client.post('/documents', buildFormData(), { headers: { 'Content-Type': 'multipart/form-data' } });
      closeUploadDialog();
      load();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.duplicate) {
        // Don't close the upload dialog yet — the duplicate dialog stacks
        // on top of it, and file/form state needs to stay intact so
        // "Replace" or "Upload anyway" can still use them.
        setDuplicateInfo(err.response.data);
      } else {
        setError(err.response?.data?.error || 'Upload failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const closeUploadDialog = () => {
    setOpen(false);
    setFile(null);
    setForm({ title: '', doc_type: 'contract', entity_type: 'company', entity_id: '', expiry_date: '' });
  };

  // "Replace" — uploads the new file as the next version of the existing
  // document (reuses the existing new-version endpoint), rather than as an
  // unrelated separate document.
  const handleReplace = async () => {
    setResolving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await client.post(`/documents/${duplicateInfo.existing.id}/new-version`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDuplicateInfo(null);
      closeUploadDialog();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to replace document');
      setDuplicateInfo(null);
    } finally {
      setResolving(false);
    }
  };

  // "Upload anyway" — proceeds as a genuinely separate document, bypassing
  // the duplicate check via allow_duplicate.
  const handleUploadAnyway = async () => {
    setResolving(true);
    try {
      await client.post('/documents', buildFormData({ allow_duplicate: 'true' }), { headers: { 'Content-Type': 'multipart/form-data' } });
      setDuplicateInfo(null);
      closeUploadDialog();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
      setDuplicateInfo(null);
    } finally {
      setResolving(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Permanently delete "${doc.title}"? This removes the file and cannot be undone.`)) return;
    try {
      await client.delete(`/documents/${doc.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete document');
    }
  };

  const handleDownload = async (doc) => {
    const { data } = await client.get(`/documents/${doc.id}/download`);
    window.open(data.url, '_blank');
  };

  const openHistory = async (doc) => {
    setHistoryDoc(doc);
    const { data } = await client.get(`/documents/${doc.id}/history`);
    setHistory(data.history);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Documents</Typography>
        <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setOpen(true)}>Upload document</Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Linked to</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Last updated</TableCell>
              <TableCell>Expiry</TableCell>
              <TableCell>Uploaded by</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {docs.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.title}</TableCell>
                <TableCell><StatusChip status={d.doc_type} /></TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{d.entity_type}{d.entity_id ? ` · ${d.entity_id.slice(0, 8)}` : ''}</TableCell>
                <TableCell className="figure">v{d.version}</TableCell>
                <TableCell className="figure" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell className="figure">
                  {d.expiry_date ? (
                    <Typography component="span" sx={{ color: new Date(d.expiry_date) < new Date() ? 'error.main' : 'inherit', fontSize: '0.85rem' }}>
                      {d.expiry_date.slice(0, 10)}
                    </Typography>
                  ) : '—'}
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{d.uploaded_by_email || '—'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Download">
                    <IconButton size="small" onClick={() => handleDownload(d)}><DownloadIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Version history">
                    <IconButton size="small" onClick={() => openHistory(d)}><HistoryIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  {['owner', 'admin', 'hr'].includes(staff?.role) && (
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(d)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!docs.length && (
              <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No documents yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload document</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" margin="normal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth select label="Document type" margin="normal" value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}>
            {DOC_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth select label="Linked to" margin="normal" value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })}>
            {ENTITY_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
          </TextField>
          {form.entity_type !== 'company' && (
            <TextField fullWidth label={`${form.entity_type} ID (optional — leave blank for general)`} margin="normal" value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })} />
          )}
          <TextField fullWidth type="date" label="Expiry date (optional)" margin="normal" InputLabelProps={{ shrink: true }} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />

          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ mt: 2 }}>
            {file ? file.name : 'Choose file'}
            <input type="file" hidden onChange={(e) => setFile(e.target.files[0])} />
          </Button>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload} disabled={saving || !file || !form.title}>
            {saving ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Duplicate found — offer Replace (new version) or Upload anyway ── */}
      <Dialog open={!!duplicateInfo} onClose={() => setDuplicateInfo(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Duplicate document found</DialogTitle>
        <DialogContent>
          <Alert severity="warning">{duplicateInfo?.message}</Alert>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Replace it with this new file as the next version, or upload this as a separate, unrelated document instead?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateInfo(null)} disabled={resolving}>Cancel</Button>
          <Button onClick={handleUploadAnyway} disabled={resolving}>Upload as separate</Button>
          <Button variant="contained" onClick={handleReplace} disabled={resolving}>
            {resolving ? 'Replacing…' : `Replace (→ v${(duplicateInfo?.existing?.version || 1) + 1})`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!historyDoc} onClose={() => setHistoryDoc(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Version history — {historyDoc?.title}</DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Version</TableCell><TableCell>Uploaded</TableCell><TableCell>File</TableCell><TableCell align="right"></TableCell></TableRow>
            </TableHead>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="figure">v{h.version}{h.is_current ? ' (current)' : ''}</TableCell>
                  <TableCell className="figure">{new Date(h.created_at).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{h.file_name}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleDownload(h)}><DownloadIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDoc(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}