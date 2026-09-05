import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Alert, Chip, IconButton, Tooltip, Tabs, Tab, Grid,
  FormControl, Select, MenuItem, TextField, InputAdornment
} from '@mui/material';
import {
  Search, ArrowBack, FilterList,
  Download, Visibility, History,
  Person, Settings, School,
  MenuBook, Assignment, Quiz
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePageHeader, MobilePaper, MobileButton, MobileTextField,
  MobileStack, ResponsiveTableContainer, useMobile
} from '../components/MobileResponsive';

const ENTITY_TYPES = ['programme', 'course', 'module', 'lesson', 'assessment', 'assignment', 'certificate'];
const ACTIONS = [
  'TRAINING_PROGRAMME_CREATED', 'TRAINING_PROGRAMME_UPDATED', 'TRAINING_PROGRAMME_ARCHIVED',
  'TRAINING_COURSE_CREATED', 'TRAINING_COURSE_UPDATED',
  'TRAINING_CONTENT_UPDATED', 'TRAINING_CONTENT_PUBLISHED', 'TRAINING_CONTENT_ARCHIVED',
  'TRAINING_ASSIGNED', 'TRAINING_REASSIGNED', 'TRAINING_DEADLINE_CHANGED',
  'TRAINING_ASSESSMENT_CREATED', 'TRAINING_ASSESSMENT_UPDATED',
  'TRAINING_SCORE_CORRECTED', 'TRAINING_CERTIFICATE_ISSUED', 'TRAINING_CERTIFICATE_REVOKED',
];

export default function TrainingAudit() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ entity_type: '', action: '', limit: 100, offset: 0 });
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
      const { data } = await client.get(`/training/audit-logs?${params.toString()}`);
      setLogs(data.logs);
      // Total count would need a separate endpoint
    } catch (err) {
      console.error('Audit load error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key) => (e) => { setFilters({ ...filters, [key]: e.target.value, offset: 0 }); };

  const formatAction = (action) => {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Training Audit Logs</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>Track all changes to training content, assignments, and certificates</Typography>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 3 }}>
        <MobileStack direction="column" gap={2} sx={{ mb: 2 }}>
          <MobileStack direction="row" gap={2} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <MobileTextField
              placeholder="Search…"
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: 250 }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select value={filters.entity_type} onChange={setFilter('entity_type')} label="Entity Type" displayEmpty>
                <MenuItem value="">All Types</MenuItem>
                {ENTITY_TYPES.map(t => <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Select value={filters.action} onChange={setFilter('action')} label="Action" displayEmpty>
                <MenuItem value="">All Actions</MenuItem>
                {ACTIONS.map(a => <MenuItem key={a} value={a}>{formatAction(a)}</MenuItem>)}
              </Select>
            </FormControl>
            <MobileButton variant="outlined" startIcon={<Download />} disabled={loading}>Export CSV</MobileButton>
          </MobileStack>
        </MobileStack>
      </MobilePaper>

      <MobilePaper>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>Loading audit logs…</Box>
        ) : (
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Entity</TableCell>
                  <TableCell>Entity ID</TableCell>
                  <TableCell>Changes</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell className="figure">{log.created_at?.slice(0, 19).replace('T', ' ')}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">{log.staff_email || 'System'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={formatAction(log.action)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)} size="small" variant="outlined" color="primary" />
                    </TableCell>
                    <TableCell className="figure" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.entity_id?.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <Box sx={{ maxWidth: 300 }}>
                        {log.old_value && <Typography variant="caption" color="text.secondary">Old: {JSON.stringify(log.old_value).slice(0, 100)}…</Typography>}
                        {log.new_value && <Typography variant="caption" color="text.secondary">New: {JSON.stringify(log.new_value).slice(0, 100)}…</Typography>}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton size="small"><Visibility fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!logs.length && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      No audit logs found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        )}
      </MobilePaper>
    </Box>
  );
}