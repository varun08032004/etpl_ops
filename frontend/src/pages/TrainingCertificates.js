import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem,
  Alert, Chip, IconButton, Tooltip, TextField, InputAdornment,
  FormControl, Select
} from '@mui/material';
import {
  Add, Edit, Delete, Visibility,
  Search, ArrowBack, FilterList,
  Verified, Cancel, Download
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePageHeader, MobilePaper, MobileButton, MobileTextField,
  MobileDialog, MobileActionButtons, MobileStack, MobileFormGrid,
  ResponsiveTableContainer, useMobile
} from '../components/MobileResponsive';

const STATUS_OPTIONS = [
  { value: 'issued', label: 'Issued' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'expired', label: 'Expired' },
];

export default function TrainingCertificates() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [certificates, setCertificates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', programme_id: '', employee_id: '' });
  const [open, setOpen] = useState(false);
  const [revokeId, setRevokeId] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');

  const load = useCallback(async () => {
    const params = { ...filters };
    if (search) params.search = search;
    const { data } = await client.get('/training/certificates', { params });
    setCertificates(data.certificates);
  }, [filters, search]);

  useEffect(() => {
    load();
    client.get('/employees?status=active').then(({ data }) => setEmployees(data.employees));
    client.get('/training/programmes?status=active').then(({ data }) => setProgrammes(data.programmes));
  }, [load]);

  const handleRevoke = async () => {
    if (!revokeId) return;
    try {
      await client.post(`/training/certificates/${revokeId}/revoke`, { reason: revokeReason });
      setRevokeId(null);
      setRevokeReason('');
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to revoke');
    }
  };

  const openRevoke = (id) => { setRevokeId(id); setRevokeReason(''); };

  const setFilter = (key) => (e) => { setFilters({ ...filters, [key]: e.target.value }); load({ ...filters, [key]: e.target.value }); };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Training Certificates</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>Manage and track all training certificates</Typography>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileStack direction="column" gap={2} sx={{ mb: 2 }}>
          <MobileTextField
            placeholder="Search certificates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
          <MobileStack direction="row" gap={2} sx={{ flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select value={filters.status} onChange={setFilter('status')} label="Status" displayEmpty>
                <MenuItem value="">All Statuses</MenuItem>
                {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select value={filters.programme_id} onChange={setFilter('programme_id')} label="Programme" displayEmpty>
                <MenuItem value="">All Programmes</MenuItem>
                {programmes.map(p => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select value={filters.employee_id} onChange={setFilter('employee_id')} label="Employee" displayEmpty>
                <MenuItem value="">All Employees</MenuItem>
                {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</MenuItem>)}
              </Select>
            </FormControl>
          </MobileStack>
        </MobileStack>
      </MobilePaper>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Certificate #</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>Programme</TableCell>
                <TableCell>Programme Version</TableCell>
                <TableCell>Issued Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Issued By</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {certificates.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Verified sx={{ color: c.status === 'issued' ? 'success.main' : 'error.main', fontSize: 22 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{c.certificate_number}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{c.employee_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.employee_code}</Typography>
                  </TableCell>
                  <TableCell>{c.programme_title}</TableCell>
                  <TableCell className="figure">{c.programme_version}</TableCell>
                  <TableCell className="figure">{c.issued_at?.slice(0, 10)}</TableCell>
                  <TableCell><StatusChip status={c.status} /></TableCell>
                  <TableCell>{c.issued_by_email}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Certificate">
                      <IconButton size="small"><Visibility fontSize="small" /></IconButton>
                    </Tooltip>
                    {staff.role === 'owner' && c.status === 'issued' && (
                      <Tooltip title="Revoke Certificate">
                        <IconButton size="small" color="error" onClick={() => openRevoke(c.id)}>
                          <Cancel fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Download PDF">
                      <IconButton size="small"><Download fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!certificates.length && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No certificates found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={!!revokeId} onClose={() => { setRevokeId(null); setRevokeReason(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>Revoke Certificate</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            This action cannot be undone. The certificate will be marked as revoked and the employee
            will no longer be able to use it for verification.
          </Alert>
          <MobileTextField
            fullWidth label="Reason for Revocation" multiline rows={3}
            value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)}
            placeholder="Enter reason for revoking this certificate…"
            required
          />
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => { setRevokeId(null); setRevokeReason(''); }}>Cancel</MobileButton>
          <MobileButton variant="contained" color="error" onClick={handleRevoke} disabled={!revokeReason.trim()}>
            Revoke Certificate
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}