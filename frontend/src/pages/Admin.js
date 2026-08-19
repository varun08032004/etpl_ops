import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody, TextField, Chip, Grid, Alert } from '@mui/material';
import client from '../api/client';
import {
  MobilePageHeader,
  MobileButton,
  MobilePaper,
  MobileTextField,
  MobileFormGrid,
  MobileStack,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const LEVEL_COLOR = { full: 'success', view: 'info', none: 'default' };

function PermissionsMatrix() {
  const [data, setData] = useState(null);
  const isMobile = useMobile();
  useEffect(() => { client.get('/admin/permissions-matrix').then(({ data }) => setData(data)); }, []);
  if (!data) return null;

  return (
    <Box>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2.5 }}>
        This documents what's actually enforced in code — it's a reference view, not a separate
        configurable permission engine. Changing access levels means changing the underlying route code.
      </Typography>
      <MobilePaper>
        <ResponsiveTableContainer>
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
                  <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 600 }}>{m.module}</TableCell>
                  {data.roles.map((r) => {
                    const val = m[r];
                    const color = LEVEL_COLOR[val] || 'warning';
                    return (
                      <TableCell key={r}>
                        <Chip size="small" label={val} color={color} variant={color === 'default' ? 'outlined' : 'filled'} sx={{ fontSize: isMobile ? '0.6rem' : '0.68rem' }} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>
    </Box>
  );
}

function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [actionFilter, setActionFilter] = useState('');
  const isMobile = useMobile();

  const load = () => client.get('/admin/audit-log', { params: actionFilter ? { action: actionFilter } : {} }).then(({ data }) => setEntries(data.entries));
  useEffect(() => { load(); }, [actionFilter]);

  return (
    <Box>
      <MobileTextField size="small" label="Filter by action (e.g. 'role_changed')" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} sx={{ mb: 2.5, minWidth: isMobile ? '100%' : 320 }} />
      <MobilePaper>
        <ResponsiveTableContainer>
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
                  <TableCell sx={{ fontSize: '0.72rem', color: 'text.secondary', maxWidth: isMobile ? '100%' : 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.old_value && <span>from {JSON.stringify(e.old_value)} </span>}
                    {e.new_value && <span>→ {JSON.stringify(e.new_value)}</span>}
                  </TableCell>
                </TableRow>
              ))}
              {!entries.length && <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No audit entries yet — they'll appear as staff accounts get created, roles change, or employees exit.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>
    </Box>
  );
}

const PROFILE_FIELDS = [
  { key: 'name', label: 'Company name' },
  { key: 'cin', label: 'CIN' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'registered_address', label: 'Registered address', multiline: true },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'phone', label: 'Phone' },
  { key: 'default_signatory_name', label: 'Default signatory name' },
  { key: 'default_signatory_title', label: 'Default signatory title' },
  { key: 'logo_url', label: 'Logo URL' },
  { key: 'seal_image_url', label: 'Seal image URL' },
  { key: 'signature_image_url', label: 'Signature image URL' },
  { key: 'verification_base_url', label: 'Verification base URL', helperText: 'Documents\' QR codes link to {this}/{document_number}' },
];

function CompanyProfile() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const isMobile = useMobile();

  const load = () => client.get('/document-engine/company-profile').then(({ data }) =>
    setForm(data.profile || Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, '']))));

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await client.put('/document-engine/company-profile', form);
      setForm(data.profile);
      setMessage({ severity: 'success', text: 'Company profile saved.' });
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2.5 }}>
        Powers the letterhead on every generated document (offer letters, NDAs, etc.) — logo, seal,
        signatory, and the base URL each document's QR code verifies against.
      </Typography>
      {message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}
      <MobilePaper>
        <MobileFormGrid>
          {PROFILE_FIELDS.map((f) => (
            <MobileTextField
              key={f.key}
              fullWidth
              label={f.label}
              multiline={f.multiline}
              rows={f.multiline ? 2 : undefined}
              helperText={f.helperText}
              value={form[f.key] || ''}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          ))}
        </MobileFormGrid>
        <MobileButton variant="contained" onClick={save} disabled={saving} sx={{ mt: 3 }}>
          {saving ? 'Saving…' : 'Save company profile'}
        </MobileButton>
      </MobilePaper>
    </Box>
  );
}

export default function Admin() {
  const [tab, setTab] = useState(0);
  const isMobile = useMobile();

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>Admin</Typography>
      </MobilePageHeader>
      <MobilePaper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider' }} variant="scrollable" scrollButtons="auto">
          <Tab label="Permissions Matrix" />
          <Tab label="Audit Log" />
          <Tab label="Company Profile" />
        </Tabs>
      </MobilePaper>
      {tab === 0 && <PermissionsMatrix />}
      {tab === 1 && <AuditLog />}
      {tab === 2 && <CompanyProfile />}
    </Box>
  );
}