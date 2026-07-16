import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardActionArea, CardContent, Chip, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Checkbox, FormControlLabel,
  Tooltip,
} from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import { useAuth } from '../context/AuthContext';

const CATEGORY_LABELS = { all: 'All', hr: 'HR', legal: 'Legal', finance: 'Finance', compliance: 'Compliance', operations: 'Operations' };

export default function DocumentEngine() {
  const { staff } = useAuth();
  const canApprove = ['owner', 'admin', 'hr', 'finance'].includes(staff?.role);

  const [templates, setTemplates] = useState([]);
  const [category, setCategory] = useState('all');
  const [generated, setGenerated] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [activeTemplate, setActiveTemplate] = useState(null); // template being filled in
  const [formData, setFormData] = useState({});
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successDoc, setSuccessDoc] = useState(null);

  const loadTemplates = () => client.get('/document-templates', { params: { is_active: 'true' } }).then(({ data }) => setTemplates(data.templates));
  const loadGenerated = () => {
    setLoadingList(true);
    return client.get('/document-engine/generated').then(({ data }) => setGenerated(data.documents)).finally(() => setLoadingList(false));
  };

  useEffect(() => { loadTemplates(); loadGenerated(); }, []);

  const filteredTemplates = useMemo(
    () => (category === 'all' ? templates : templates.filter((t) => t.category === category)),
    [templates, category]
  );
  const categoriesPresent = useMemo(() => ['all', ...new Set(templates.map((t) => t.category))], [templates]);

  const openTemplate = (t) => {
    setActiveTemplate(t);
    setFormData({});
    setEntityType(''); setEntityId(''); setSendEmail(false); setEmailTo('');
    setError(''); setSuccessDoc(null);
  };

  const handleGenerate = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await client.post('/document-engine/generate', {
        template_code: activeTemplate.code,
        data: formData,
        entity_type: entityType || undefined,
        entity_id: entityId || undefined,
        send_email: sendEmail,
        email_to: sendEmail ? emailTo : undefined,
      });
      setSuccessDoc(data.document);
      loadGenerated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate document');
    } finally {
      setSaving(false);
    }
  };

  const download = async (id) => {
    const { data } = await client.get(`/document-engine/generated/${id}/download`);
    window.open(data.url, '_blank');
  };

  const approve = async (id) => { await client.post(`/document-engine/generated/${id}/approve`); loadGenerated(); };
  const voidDoc = async (id) => { await client.post(`/document-engine/generated/${id}/void`); loadGenerated(); };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Document Engine</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Generate letterhead PDFs — offer letters, agreements, resolutions — straight from templates. Each one gets a unique
        document number, version, QR verification, and is stored automatically.
      </Typography>

      <Tabs value={category} onChange={(_, v) => setCategory(v)} sx={{ mb: 2 }}>
        {categoriesPresent.map((c) => <Tab key={c} value={c} label={CATEGORY_LABELS[c] || c} />)}
      </Tabs>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {filteredTemplates.map((t) => (
          <Grid item xs={12} sm={6} md={4} key={t.id}>
            <Card variant="outlined">
              <CardActionArea onClick={() => openTemplate(t)} sx={{ p: 1 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <DescriptionOutlinedIcon fontSize="small" color="action" />
                    <Typography variant="subtitle1">{t.name}</Typography>
                  </Box>
                  <Chip size="small" label={CATEGORY_LABELS[t.category] || t.category} sx={{ textTransform: 'capitalize' }} />
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
        {!filteredTemplates.length && (
          <Grid item xs={12}><Typography color="text.secondary">No templates in this category yet.</Typography></Grid>
        )}
      </Grid>

      <Typography variant="h6" sx={{ mb: 1 }}>Generated documents</Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Doc No.</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Generated by</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {generated.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell sx={{ fontFamily: 'monospace' }}>{d.document_number}</TableCell>
                <TableCell>{d.template_name}</TableCell>
                <TableCell>v{d.version}</TableCell>
                <TableCell><StatusChip status={d.status} /></TableCell>
                <TableCell>{d.generated_by_email}</TableCell>
                <TableCell>{new Date(d.created_at).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Download">
                    <IconButton size="small" onClick={() => download(d.id)}><DownloadOutlinedIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  {canApprove && d.status === 'generated' && (
                    <Tooltip title="Approve">
                      <IconButton size="small" onClick={() => approve(d.id)}><CheckCircleOutlineIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                  {canApprove && d.status !== 'void' && (
                    <Tooltip title="Void">
                      <IconButton size="small" onClick={() => voidDoc(d.id)}><BlockOutlinedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loadingList && !generated.length && (
              <TableRow><TableCell colSpan={7}><Typography color="text.secondary">No documents generated yet.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* ── Generate dialog — form fields are driven entirely by activeTemplate.fields, ── */}
      {/* ── so adding a new template server-side needs no frontend change. ──────────────── */}
      <Dialog open={!!activeTemplate} onClose={() => setActiveTemplate(null)} maxWidth="sm" fullWidth>
        {activeTemplate && (
          <>
            <DialogTitle>{activeTemplate.name}</DialogTitle>
            <DialogContent dividers>
              {successDoc ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Generated <strong>{successDoc.document_number}</strong> (v{successDoc.version}). It's stored in the log below —
                  close this dialog and use the download icon to get the PDF.
                </Alert>
              ) : (
                <>
                  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                  <Grid container spacing={2}>
                    {(activeTemplate.fields || []).map((f) => (
                      <Grid item xs={12} sm={f.type === 'textarea' ? 12 : 6} key={f.key}>
                        <TextField
                          fullWidth
                          label={f.label}
                          required={f.required}
                          type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                          multiline={f.type === 'textarea'}
                          minRows={f.type === 'textarea' ? 3 : undefined}
                          InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
                          value={formData[f.key] || ''}
                          onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                        />
                      </Grid>
                    ))}
                    <Grid item xs={6}>
                      <TextField fullWidth label="Link to entity type (optional)" placeholder="employee / vendor / customer"
                        value={entityType} onChange={(e) => setEntityType(e.target.value)} />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField fullWidth label="Entity ID (optional)" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={<Checkbox checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />}
                        label="Email the PDF once generated"
                      />
                    </Grid>
                    {sendEmail && (
                      <Grid item xs={12}>
                        <TextField fullWidth label="Send to email" type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
                      </Grid>
                    )}
                  </Grid>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setActiveTemplate(null)}>{successDoc ? 'Close' : 'Cancel'}</Button>
              {!successDoc && (
                <Button variant="contained" disabled={saving} onClick={handleGenerate}>
                  {saving ? 'Generating…' : 'Generate PDF'}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
