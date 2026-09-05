import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Alert, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PhotoIcon from '@mui/icons-material/Photo';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileButton,
  MobileTextField,
  useMobile,
} from '../components/MobileResponsive';
import client from '../api/client';

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MonitoringScreenshots() {
  const isMobile = useMobile();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [employeeId, setEmployeeId] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.ceil(screenshots.length / pageSize);

  useEffect(() => {
    client.get('/employees').then(({ data }) => setEmployees(data.employees || [])).catch(() => setEmployees([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScreenshots([]);
    try {
      const params = { date };
      if (employeeId) params.employee_id = employeeId;
      const { data } = await client.get('/monitoring/screenshots', { params });
      setScreenshots(data.screenshots || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load screenshots');
    } finally {
      setLoading(false);
    }
  }, [date, employeeId]);

  useEffect(() => { load(); }, [load]);

  const displayed = screenshots.slice((page - 1) * pageSize, page * pageSize);

  const openFull = (url) => window.open(url, '_blank');

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Screenshots</Typography>
        <MobileButton variant="outlined" onClick={load} disabled={loading} startIcon={<RefreshIcon />}>
          {loading ? 'Loading…' : 'Refresh'}
        </MobileButton>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileFormGrid>
          <MobileTextField
            select
            size="small"
            label="Employee"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            options={[{ value: '', label: 'All employees' }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))]}
          />
          <MobileTextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
        </MobileFormGrid>
      </MobilePaper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && <CircularProgress size={22} sx={{ display: 'block', margin: 'auto', py: 4 }} />}

      {!loading && screenshots.length && (
        <>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2 }}>
            {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''} for {new Date(date).toLocaleDateString('en-IN')}
            {employeeId && ` · ${employees.find((e) => e.id === employeeId)?.full_name}`}
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 200}px, 1fr))`, gap: 2, mb: 3 }}>
            {displayed.map((s) => (
              <Box key={s.id} sx={{ position: 'relative' }}>
                <Paper sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ flex: 1, position: 'relative', aspectRatio: '16/10' }}>
                    <Box
                      component="img"
                      src={`/api/monitoring/screenshots/${s.id}/url`}
                      alt={`Screenshot at ${fmtDateTime(s.captured_at)}`}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 1,
                        cursor: 'zoom-in',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                      onClick={() => openFull(`/api/monitoring/screenshots/${s.id}/url`)}
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                    <Box
                      sx={{
                        display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 1, border: '1px dashed', borderColor: 'divider', color: 'text.secondary',
                      }}
                    >
                      Failed to load
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>{s.full_name || s.employee_id}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtDateTime(s.captured_at)}</Typography>
                    </Box>
                    <Tooltip title="Open full size">
                      <IconButton size="small" onClick={() => openFull(`/api/monitoring/screenshots/${s.id}/url`)}>
                        <PhotoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Typography>
                </Paper>
              </Box>
            ))}
          </Box>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
              <MobileButton variant="outlined" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</MobileButton>
              <Typography sx={{ fontSize: '0.85rem' }}>Page {page} of {totalPages}</Typography>
              <MobileButton variant="outlined" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</MobileButton>
            </Box>
          )}
        </>
      )}

      {!loading && !screenshots.length && (
        <MobilePaper>
          <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
            No screenshots for {new Date(date).toLocaleDateString('en-IN')}.
          </Typography>
        </MobilePaper>
      )}
    </Box>
  );
}