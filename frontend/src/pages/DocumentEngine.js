import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardActionArea, CardContent, Chip, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Checkbox, FormControlLabel,
  Tooltip, MenuItem,
} from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import { useAuth } from '../context/AuthContext';

const CATEGORY_LABELS = { all: 'All', hr: 'HR', legal: 'Legal', finance: 'Finance', compliance: 'Compliance', operations: 'Operations' };

// Mirrors services/documentEngine.js's isFieldApplicable — a field with
// depends_on only shows (and only then counts as required) when the field
// it depends on currently holds one of the listed values. Keeping this
// logic in both places is intentional: the frontend needs it to decide
// what to render, the backend needs it to decide what to validate — they
// operate on different data (form state vs. submitted request body) so a
// shared import isn't a clean fit here.
function isFieldApplicable(field, data) {
  if (!field.depends_on) return true;
  const { key, values } = field.depends_on;
  return values.includes(data[key]);
}

export default function DocumentEngine() {
  const { staff } = useAuth();
  const canApprove = ['owner', 'admin', 'hr', 'finance'].includes(staff?.role);

  const [templates, setTemplates] = useState([]);
  const [category, setCategory] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
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
  const loadDepartments = () => client.get('/departments').then(({ data }) => setDepartments(data.departments || []));
  const loadGenerated = () => {
    setLoadingList(true);
    return client.get('/document-engine/generated').then(({ data }) => setGenerated(data.documents)).finally(() => setLoadingList(false));
  };

  useEffect(() => { loadTemplates(); loadDepartments(); loadGenerated(); }, []);

  const filteredTemplates = useMemo(
    () => templates
      .filter((t) => category === 'all' || t.category === category)
      .filter((t) => departmentFilter === 'all' || t.department_code === departmentFilter),
    [templates, category, departmentFilter]
  );
  const categoriesPresent = useMemo(() => ['all', ...new Set(templates.map((t) => t.category))], [templates]);

  const openTemplate = (t) => {
    setActiveTemplate(t);
    setFormData({});
    setEntityType(''); setEntityId(''); setSendEmail(false); setEmailTo('');
    setError(''); setSuccessDoc(null);
  };

  const handleFieldChange = (key, value) => {
    const next = { ...formData, [key]: value };
    // Any field that depends on this one and is no longer applicable
    // gets its stored value cleared, so switching e.g. Employee Type away
    // from "Intern (Paid)" doesn't silently keep submitting a stipend
    // amount the person can no longer see or edit.
    for (const f of activeTemplate?.fields || []) {
      if (f.depends_on && f.depends_on.key === key && !isFieldApplicable(f, next)) {
        delete next[f.key];
      }
    }
    setFormData(next);
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

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Tabs value={category} onChange={(_, v) => setCategory(v)}>
          {categoriesPresent.map((c) => <Tab key={c} value={c} label={CATEGORY_LABELS[c] || c} />)}
        </Tabs>
        <TextField
          select
          size="small"
          label="Department"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All departments</MenuItem>
          {departments.map((d) => <MenuItem key={d.id} value={d.code}>{d.name} ({d.code})</MenuItem>)}
        </TextField>
      </Box>

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
                  <Chip size="small" label={CATEGORY_LABELS[t.category] || t.category} sx={{ textTransform: 'capitalize', mr: 0.5 }} />
                  <Chip size="small" variant="outlined" label={t.department_code} />
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
                    {(activeTemplate.fields || [])
                      .filter((f) => isFieldApplicable(f, formData))
                      .filter((f) => !f.auto_sequence) // assigned automatically on generation — never shown as an input
                      .map((f) => (
                      <Grid item xs={12} sm={f.type === 'textarea' ? 12 : 6} key={f.key}>
                        {f.key === 'department' ? (
                          // Live dropdown sourced from the real departments table —
                          // not a hardcoded options list — so it always reflects
                          // whatever departments actually exist right now.
                          <TextField
                            select
                            fullWidth
                            label={f.label}
                            required={f.required}
                            value={formData[f.key] || ''}
                            onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          >
                            {departments.map((d) => <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>)}
                          </TextField>
                        ) : f.type === 'select' && f.multiple ? (
                          <TextField
                            select
                            fullWidth
                            label={f.label}
                            required={f.required}
                            SelectProps={{ multiple: true }}
                            value={formData[f.key] || []}
                            onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          >
                            {(f.options || []).map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                          </TextField>
                        ) : f.type === 'select' ? (
                          <TextField
                            select
                            fullWidth
                            label={f.label}
                            required={f.required}
                            value={formData[f.key] || ''}
                            onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          >
                            {(f.options || []).map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                          </TextField>
                        ) : (
                          <TextField
                            fullWidth
                            label={f.label}
                            required={f.required}
                            type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                            multiline={f.type === 'textarea'}
                            minRows={f.type === 'textarea' ? (f.rows || 3) : undefined}
                            InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
                            value={formData[f.key] || ''}
                            onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          />
                        )}
                      </Grid>
                    ))}
                    {(activeTemplate.fields || []).some((f) => f.auto_sequence) && (
                      <Grid item xs={12}>
                        <Alert severity="info" sx={{ py: 0.5 }}>
                          {(activeTemplate.fields || []).filter((f) => f.auto_sequence).map((f) => f.label).join(', ')} will be assigned automatically when this document is generated.
                        </Alert>
                      </Grid>
                    )}

                    {/* Works for every template without any per-template schema change — */}
                    {/* if filled in, it replaces the templated body text entirely, but */}
                    {/* still supports {{placeholder}} substitution server-side. */}
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Custom letter body (optional — overrides the template text above)"
                        placeholder="Leave blank to use the standard template wording. If you write here, it replaces the body entirely — you can still use placeholders like {{candidate_name}} or {{company_name}}."
                        multiline
                        minRows={5}
                        value={formData.custom_body || ''}
                        onChange={(e) => setFormData({ ...formData, custom_body: e.target.value })}
                      />
                    </Grid>

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