import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, Alert, TextField, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem,
  FormControl, InputLabel, FormHelperText, TablePagination, Button,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  useMobile,
  ResponsiveTableContainer,
} from '../components/MobileResponsive';

const STATUS_CONFIG = {
  active: { color: 'success', label: 'Active', icon: '●' },
  inactive: { color: 'warning', label: 'Inactive (>10min)', icon: '◐' },
  uninstalled: { color: 'error', label: 'Uninstalled/Revoked', icon: '✕' },
  never_installed: { color: 'default', label: 'Never Installed', icon: '○' },
};

const AGENT_STATUSES = ['all', 'active', 'inactive', 'uninstalled', 'never_installed'];

export default function AgentStatusMonitoring() {
  const isMobile = useMobile();
  const [data, setData] = useState({ assets: [], pagination: { total: 0 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    employee_id: '',
    asset_type: '',
    page: 1,
    limit: 25,
  });
  const [detailDialog, setDetailDialog] = useState({ open: false, asset: null });
  const [historyDialog, setHistoryDialog] = useState({ open: false, history: [], asset: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      if (filters.asset_type) params.append('asset_type', filters.asset_type);
      params.append('page', filters.page);
      params.append('limit', filters.limit);

      const { data } = await client.get(`/asset-agent/admin/asset-agent-status?${params.toString()}`);
      setData(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load agent status');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const openDetail = (asset) => setDetailDialog({ open: true, asset });
  const openHistory = async (asset) => {
    try {
      const { data } = await client.get(`/asset-agent/admin/agent-status-history?asset_id=${asset.asset_id}&limit=50`);
      setHistoryDialog({ open: true, history: data.history || [], asset });
    } catch (err) {
      alert('Failed to load history: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredAssets = data?.assets || [];

  const statusCounts = useMemo(() => {
    const counts = { all: filteredAssets.length };
    AGENT_STATUSES.filter(s => s !== 'all').forEach(s => { counts[s] = 0; });
    filteredAssets.forEach(a => { counts[a.agent_current_status] = (counts[a.agent_current_status] || 0) + 1; });
    return counts;
  }, [filteredAssets]);

  if (!data && loading) return <CircularProgress size={60} />;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Agent Status Monitoring</Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          {AGENT_STATUSES.filter(s => s !== 'all').map(s => (
            <Chip
              key={s}
              size="small"
              label={`${STATUS_CONFIG[s].label} (${statusCounts[s] || 0})`}
              color={STATUS_CONFIG[s].color}
              variant="outlined"
              sx={{ '& .MuiChip-icon': { fontSize: 10 } }}
            />
          ))}
        </Box>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <MobilePaper sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200, mr: 2 }}>
          <InputLabel id="status-filter">Agent Status</InputLabel>
          <Select
            value={filters.status}
            label="Agent Status"
            onChange={(e) => handleFilterChange('status', e.target.value)}
            displayEmpty
          >
            {AGENT_STATUSES.map(s => (
              <MenuItem key={s} value={s}>{s === 'all' ? 'All Statuses' : STATUS_CONFIG[s]?.label || s}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 250, mr: 2 }}>
          <InputLabel id="search-filter">Search Employee/Tag</InputLabel>
          <Select
            value={filters.search}
            label="Search"
            onChange={(e) => handleFilterChange('search', e.target.value)}
            displayEmpty
            renderValue={(selected) => selected || 'Search...'}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="laptop">Laptops</MenuItem>
            <MenuItem value="phone">Phones</MenuItem>
            <MenuItem value="monitor">Monitors</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          placeholder="Search employee name, code, or asset tag"
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          sx={{ minWidth: 250 }}
          InputProps={{ startAdornment: <FilterListIcon sx={{ fontSize: 18, color: 'text.secondary' }} /> }}
        />
      </MobilePaper>

<MobilePaper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : (
          <>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell>Tag / Serial</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Agent Status</TableCell>
                    <TableCell>Last Heartbeat</TableCell>
                    <TableCell>Assigned</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAssets.map((asset) => {
                    const statusConfig = STATUS_CONFIG[asset.agent_current_status] || STATUS_CONFIG.never_installed;
                    return (
                      <TableRow key={asset.asset_id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{asset.full_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{asset.employee_code} • {asset.work_email}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{asset.asset_name}</Typography>
                          {asset.model && <Typography variant="caption" color="text.secondary">{asset.model}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{asset.asset_tag || '—'}</Typography>
                          {asset.serial_number && <Typography variant="caption" color="text.secondary">S/N: {asset.serial_number}</Typography>}
                        </TableCell>
                        <TableCell>{asset.asset_type}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={statusConfig.label}
                            color={statusConfig.color}
                            icon={statusConfig.icon}
                            variant={asset.agent_current_status === 'never_installed' ? 'outlined' : 'filled'}
                          />
                        </TableCell>
                        <TableCell>
                          {asset.agent_last_heartbeat ? new Date(asset.agent_last_heartbeat).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="figure">{asset.assigned_at?.slice(0, 10) || '—'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => openDetail(asset)}><VisibilityIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Status History">
                            <IconButton size="small" onClick={() => openHistory(asset)}><FilterListIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!filteredAssets.length && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        No assets found matching filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
            <TablePagination
              component="div"
              count={data.pagination?.total || 0}
              page={filters.page - 1}
              onPageChange={(_, page) => handleFilterChange('page', page + 1)}
              onRowsPerPageChange={(e) => handleFilterChange('limit', Number(e.target.value))}
              rowsPerPage={filters.limit}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </MobilePaper>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onClose={() => setDetailDialog({ open: false, asset: null })} maxWidth="md" fullWidth>
        <DialogTitle>Asset Details - {detailDialog.asset?.asset_name}</DialogTitle>
        <DialogContent>
          {detailDialog.asset && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, p: 1 }}>
              <Box><Typography variant="caption" color="text.secondary">Asset Tag</Typography><Typography>{detailDialog.asset.asset_tag}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Serial Number</Typography><Typography>{detailDialog.asset.serial_number || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Model</Typography><Typography>{detailDialog.asset.model || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Manufacturer</Typography><Typography>{detailDialog.asset.manufacturer || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Asset Type</Typography><Typography>{detailDialog.asset.asset_type}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Status</Typography><Chip size="small" label={STATUS_CONFIG[detailDialog.asset.agent_current_status]?.label} color={STATUS_CONFIG[detailDialog.asset.agent_current_status]?.color} /></Box>
              <Box><Typography variant="caption" color="text.secondary">Agent Device ID</Typography><Typography>{detailDialog.asset.agent_device_id || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Last Heartbeat</Typography><Typography>{detailDialog.asset.agent_last_heartbeat ? new Date(detailDialog.asset.agent_last_heartbeat).toLocaleString() : 'Never'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Last Known IP</Typography><Typography>{detailDialog.asset.agent_last_seen_ip || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Work Mode</Typography><Typography>{detailDialog.asset.is_office_network ? 'Office' : 'WFH'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Location</Typography><Typography>{detailDialog.asset.location || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Agent Version</Typography><Typography>{detailDialog.asset.agent_version || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Assigned Date</Typography><Typography>{detailDialog.asset.assigned_at?.slice(0, 10) || '—'}</Typography></Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog({ open: false, asset: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialog.open} onClose={() => setHistoryDialog({ open: false, history: [], asset: null })} maxWidth="lg" fullWidth>
        <DialogTitle>Status History - {historyDialog.asset?.asset_name} ({historyDialog.asset?.asset_tag})</DialogTitle>
        <DialogContent>
          {historyDialog.history.length === 0 ? (
            <Typography color="text.secondary">No status history available.</Typography>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell>Changed By</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historyDialog.history.map((h, i) => (
                    <TableRow key={h.id || i}>
                      <TableCell>{new Date(h.changed_at).toLocaleString()}</TableCell>
                      <TableCell>{h.old_status ? h.old_status.replace('_', ' ') : '—'}</TableCell>
                      <TableCell><Chip size="small" label={h.new_status.replace('_', ' ')} color={STATUS_CONFIG[h.new_status]?.color || 'default'} /></TableCell>
                      <TableCell>{h.changed_by_email || 'System'}</TableCell>
                      <TableCell><pre style={{ fontSize: '0.7rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(h.details, null, 2)}</pre></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog({ open: false, history: [], asset: null })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}