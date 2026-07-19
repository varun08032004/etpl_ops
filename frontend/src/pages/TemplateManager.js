import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, FormControlLabel, Checkbox, Alert, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import client from '../api/client';

const CATEGORIES = ['hr', 'legal', 'finance', 'compliance', 'operations'];
const FIELD_TYPES = ['text', 'textarea', 'date', 'number', 'select'];

const emptyField = () => ({
  key: '', label: '', type: 'text', required: true, highlight: false,
  options: [], // used when type === 'select'
  multiple: false, // used when type === 'select' — allow picking more than one option
  rows: undefined, // used when type === 'textarea' — how many rows visible on the Generate form (default 3)
  depends_on: null, // { key: 'other_field_key', values: ['A','B'] } — only shows/required when other_field_key's value is one of values
  auto_sequence: false, // if true, value is assigned automatically (count of previously generated docs + 1) instead of shown as an input
  sequence_prefix: '', // e.g. "SC-" — only used when auto_sequence is true
  sequence_pad: 4, // zero-padding width — e.g. 4 -> "0007"
});

const emptyTemplate = () => ({
  id: null,
  code: '',
  name: '',
  category: 'hr',
  department_code: '',
  title_on_page: '',
  body: '',
  fields: [],
  requires_seal: true,
  requires_signature: true,
  requires_qr: true,
});

export default function TemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyTemplate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadTemplates = () => client.get('/document-templates').then(({ data }) => setTemplates(data.templates));
  const loadDepartments = () => client.get('/departments').then(({ data }) => setDepartments(data.departments));

  useEffect(() => { loadTemplates(); loadDepartments(); }, []);

  const openNew = () => { setForm(emptyTemplate()); setError(''); setOpen(true); };
  const openEdit = (t) => {
    setForm({
      ...emptyTemplate(),
      ...t,
      fields: (t.fields || []).map((f) => ({ ...emptyField(), ...f })),
    });
    setError('');
    setOpen(true);
  };

  const addField = () => setForm({ ...form, fields: [...form.fields, emptyField()] });
  const removeField = (idx) => setForm({ ...form, fields: form.fields.filter((_, i) => i !== idx) });
  const updateField = (idx, patch) => {
    const fields = form.fields.slice();
    fields[idx] = { ...fields[idx], ...patch };
    setForm({ ...form, fields });
  };

  // Auto-derives a field's `key` (used as {{placeholder}} in the body) from
  // its label as the admin types, so they don't have to hand-write snake_case
  // — still editable directly if they want a specific key.
  const deriveKey = (label) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const validate = () => {
    if (!form.code.trim()) return 'Code is required';
    if (!form.name.trim()) return 'Name is required';
    if (!form.department_code) return 'Department is required';
    if (!form.title_on_page.trim()) return 'Title on page is required';
    if (!form.body.trim()) return 'Body is required';
    const keys = form.fields.map((f) => f.key);
    if (keys.some((k) => !k)) return 'Every field needs a key (derived from its label)';
    if (new Set(keys).size !== keys.length) return 'Field keys must be unique';
    for (const f of form.fields) {
      if (f.type === 'select' && (!f.options || f.options.length < 2)) {
        return `"${f.label || f.key}" is a dropdown but has fewer than 2 options`;
      }
      if (f.depends_on && (!f.depends_on.key || !f.depends_on.values?.length)) {
        return `"${f.label || f.key}" has an incomplete "only show when" condition`;
      }
    }
    return '';
  };

  const handleSave = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        code: form.code,
        name: form.name,
        category: form.category,
        department_code: form.department_code,
        title_on_page: form.title_on_page,
        body: form.body,
        fields: form.fields,
        requires_seal: form.requires_seal,
        requires_signature: form.requires_signature,
        requires_qr: form.requires_qr,
      };
      if (form.id) {
        await client.put(`/document-templates/${form.id}`, payload);
      } else {
        await client.post('/document-templates', payload);
      }
      setOpen(false);
      loadTemplates();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this template? Existing generated documents keep referencing it, but it will no longer appear as an option to generate new ones.')) return;
    await client.delete(`/document-templates/${id}`);
    loadTemplates();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Document Templates</Typography>
          <Typography variant="body2" color="text.secondary">
            Add a new document type here — no code changes needed, it shows up in Document Engine immediately.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>New Template</Button>
      </Box>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Fields</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell sx={{ fontFamily: 'monospace' }}>{t.code}</TableCell>
                <TableCell>{t.name}</TableCell>
                <TableCell><Chip size="small" label={t.category} sx={{ textTransform: 'capitalize' }} /></TableCell>
                <TableCell>{t.department_code}</TableCell>
                <TableCell>{(t.fields || []).length}</TableCell>
                <TableCell>
                  <Chip size="small" label={t.is_active ? 'Active' : 'Inactive'} color={t.is_active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(t)}><EditOutlinedIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  {t.is_active && (
                    <Tooltip title="Deactivate">
                      <IconButton size="small" onClick={() => deactivate(t.id)}><BlockOutlinedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!templates.length && (
              <TableRow><TableCell colSpan={7}><Typography color="text.secondary">No templates yet.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{form.id ? `Edit ${form.name}` : 'New Document Template'}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth label="Code" placeholder="OFFER_LETTER"
                value={form.code} disabled={!!form.id}
                helperText={form.id ? 'Code can\u2019t be changed after creation' : 'Auto-uppercased, spaces become underscores'}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Name" placeholder="Offer Letter" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField select fullWidth label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth label="Department" value={form.department_code}
                onChange={(e) => setForm({ ...form, department_code: e.target.value })}
                helperText="Pulled from your departments list — keeps template codes consistent"
              >
                {departments.map((d) => <MenuItem key={d.id} value={d.code}>{d.name} ({d.code})</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Title shown on the PDF" placeholder="OFFER LETTER" value={form.title_on_page} onChange={(e) => setForm({ ...form, title_on_page: e.target.value })} />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth multiline minRows={6} label="Body template"
                placeholder={'Dear {{candidate_name}},\n\nWe are pleased to offer you the position of {{position}}...'}
                helperText="Use {{field_key}} for any field defined below, or {{company_name}}, {{company_cin}}, {{company_gstin}}, {{company_address}}, {{company_email}}, {{company_website}}, {{company_phone}}"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel control={<Checkbox checked={form.requires_signature} onChange={(e) => setForm({ ...form, requires_signature: e.target.checked })} />} label="Requires signature" />
              <FormControlLabel control={<Checkbox checked={form.requires_seal} onChange={(e) => setForm({ ...form, requires_seal: e.target.checked })} />} label="Requires seal" />
              <FormControlLabel control={<Checkbox checked={form.requires_qr} onChange={(e) => setForm({ ...form, requires_qr: e.target.checked })} />} label="Requires QR verification" />
            </Grid>

            <Grid item xs={12}><Divider /></Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">Fields</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addField}>Add field</Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Each field becomes an input on the Generate form, and a <code>{'{{key}}'}</code> placeholder you can use in the body above.
                Toggle <strong>Highlight</strong> to show a field in the boxed summary at the top of the generated PDF
                (e.g. Position, Salary, Joining Date). Number fields with a key containing "salary", "stipend", "ctc",
                "amount", "price", "fee", or "budget" are automatically formatted as ₹ with Indian comma grouping and a
                Lacs/Crore suffix — both inline in the letter text and in the summary box — so admins can just type
                <code>3600000</code> or <code>36,00,000</code> and it renders as <code>₹36,00,000 (36.00 L)</code>.
                Use <strong>select</strong> type for a dropdown with fixed options. A field named exactly <code>department</code>
                always renders as a live dropdown of your actual departments regardless of its declared type or options.
                Use <strong>"Only show when…"</strong> to make a field conditional — e.g. a Stipend field that only
                appears when Employee Type is "Intern (Paid)".
              </Typography>

              {form.fields.map((f, idx) => (
                <Paper key={idx} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
                  <Grid container spacing={1.5} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth size="small" label="Label"
                        value={f.label}
                        onChange={(e) => updateField(idx, { label: e.target.value, key: f.key && f.key !== deriveKey(f.label) ? f.key : deriveKey(e.target.value) })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2.5}>
                      <TextField
                        fullWidth size="small" label="Key ({{placeholder}})"
                        value={f.key}
                        onChange={(e) => updateField(idx, { key: deriveKey(e.target.value) })}
                      />
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <TextField select fullWidth size="small" label="Type" value={f.type} onChange={(e) => updateField(idx, { type: e.target.value })}>
                        {FIELD_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={6} sm={1.75}>
                      <FormControlLabel
                        control={<Checkbox size="small" checked={f.required} onChange={(e) => updateField(idx, { required: e.target.checked })} />}
                        label="Required"
                      />
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <FormControlLabel
                        control={<Checkbox size="small" checked={f.highlight} onChange={(e) => updateField(idx, { highlight: e.target.checked })} />}
                        label="Highlight"
                      />
                    </Grid>
                    <Grid item xs={6} sm={0.75}>
                      <IconButton size="small" onClick={() => removeField(idx)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </Grid>

                    {f.type === 'textarea' && (
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth size="small" type="number" label="Rows (default 3)"
                          placeholder="e.g. 12 for a big paste box"
                          value={f.rows || ''}
                          onChange={(e) => updateField(idx, { rows: e.target.value ? Number(e.target.value) : undefined })}
                        />
                      </Grid>
                    )}

                    {(f.type === 'text' || f.type === 'number') && (
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={<Checkbox size="small" checked={f.auto_sequence} onChange={(e) => updateField(idx, { auto_sequence: e.target.checked, required: e.target.checked ? false : f.required })} />}
                          label="Auto-assign sequence number (not shown as an input — computed from previous documents of this type)"
                        />
                        {f.auto_sequence && (
                          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5, ml: 4 }}>
                            <TextField
                              size="small" label="Prefix (optional)" placeholder="SC-"
                              value={f.sequence_prefix || ''}
                              onChange={(e) => updateField(idx, { sequence_prefix: e.target.value })}
                              sx={{ width: 140 }}
                            />
                            <TextField
                              size="small" type="number" label="Zero-pad width"
                              value={f.sequence_pad ?? 4}
                              onChange={(e) => updateField(idx, { sequence_pad: Number(e.target.value) || 4 })}
                              sx={{ width: 140 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                              Example: {(f.sequence_prefix || '')}{String(7).padStart(f.sequence_pad || 4, '0')}
                            </Typography>
                          </Box>
                        )}
                      </Grid>
                    )}

                    {f.type === 'select' && (
                      <Grid item xs={12}>
                        <TextField
                          fullWidth size="small" label="Dropdown options (comma-separated)"
                          placeholder="Full Time, Contract Based, Intern (Paid), Intern (Unpaid)"
                          value={(f.options || []).join(', ')}
                          onChange={(e) => updateField(idx, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                        />
                        <FormControlLabel
                          sx={{ mt: 0.5 }}
                          control={<Checkbox size="small" checked={f.multiple} onChange={(e) => updateField(idx, { multiple: e.target.checked })} />}
                          label="Allow selecting more than one (e.g. Directors Present)"
                        />
                      </Grid>
                    )}

                    <Grid item xs={12} sm={5}>
                      <TextField
                        select fullWidth size="small" label="Only show when…"
                        value={f.depends_on?.key || ''}
                        onChange={(e) => {
                          const key = e.target.value;
                          updateField(idx, { depends_on: key ? { key, values: f.depends_on?.key === key ? f.depends_on.values : [] } : null });
                        }}
                        helperText="Optional — leave blank to always show this field"
                      >
                        <MenuItem value="">Always show</MenuItem>
                        {form.fields.filter((other) => other.key && other.key !== f.key).map((other) => (
                          <MenuItem key={other.key} value={other.key}>{other.label || other.key}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    {f.depends_on?.key && (
                      <Grid item xs={12} sm={7}>
                        <TextField
                          fullWidth size="small"
                          label={`...equals one of (comma-separated)`}
                          placeholder="Intern (Paid)"
                          value={(f.depends_on.values || []).join(', ')}
                          onChange={(e) => updateField(idx, {
                            depends_on: { key: f.depends_on.key, values: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
                          })}
                        />
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              ))}
              {!form.fields.length && (
                <Typography variant="body2" color="text.secondary">No fields yet — click "Add field" above.</Typography>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save Template'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}