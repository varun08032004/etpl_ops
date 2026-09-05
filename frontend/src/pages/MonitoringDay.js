import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Alert, Chip, CircularProgress, Tabs, Tab,
  Accordion, AccordionSummary, AccordionDetails, Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  ResponsiveTableContainer,
  MobileCardGrid,
  MobileButton,
  MobileTextField,
  useMobile,
} from '../components/MobileResponsive';
import client from '../api/client';
import StatusChip from '../components/StatusChip';


function fmtDuration(seconds) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtTime(t) {
  if (!t) return '—';
  return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function categoryColor(cat) {
  switch (cat) {
    case 'productive': return 'success';
    case 'unproductive': return 'warning';
    case 'distracting': return 'error';
    case 'blocked': return 'error';
    default: return 'default';
  }
}

export default function MonitoringDay() {
  const isMobile = useMobile();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [employeeId, setEmployeeId] = useState('');
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    client.get('/employees').then(({ data }) => setEmployees(data.employees || [])).catch(() => setEmployees([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { date };
      if (employeeId) params.employee_id = employeeId;
      const { data: res } = await client.get('/monitoring/day', { params });
      setData(res);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load day data');
    } finally {
      setLoading(false);
    }
  }, [date, employeeId]);

  useEffect(() => { load(); }, [load]);

  const days = data?.days || [];
  const summary = data?.summary;

  return (
    <Box>
      <MobilePageHeader>
        <MobileButton variant="outlined" size="small" startIcon={<ArrowBackIcon />} onClick={() => window.history.back()}>
          Back
        </MobileButton>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ flex: 1, textAlign: 'center' }}>
          Day Drilldown — {new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </Typography>
        <Box />
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
      {loading && <CircularProgress size={22} />}

      {!loading && days && days.length && (
        <>
          {summary && (
            <MobileCardGrid sx={{ mb: 3 }}>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Total Active</Typography>
                <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600 }}>{fmtDuration(summary.totalActiveSeconds)}</Typography>
              </MobilePaper>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Total Idle</Typography>
                <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'text.secondary' }}>{fmtDuration(summary.totalIdleSeconds)}</Typography>
              </MobilePaper>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Sessions</Typography>
                <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600 }}>{summary.sessionCount}</Typography>
              </MobilePaper>
              <MobilePaper>
                <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Productivity</Typography>
                <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: categoryColor(summary.productivePct >= 70 ? 'productive' : summary.productivePct >= 40 ? 'unproductive' : 'distracting') }}>
                  {summary.productivePct}%
                </Typography>
              </MobilePaper>
            </MobileCardGrid>
          )}

          <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
            <Tab label="Sessions" />
            <Tab label="Apps" />
            <Tab label="Websites" />
            <Tab label="Idle Periods" />
            <Tab label="Screenshots" />
          </Tabs>

          {tab === 0 && (
            <MobilePaper>
              <ResponsiveTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Session</TableCell>
                      <TableCell>Clock In</TableCell>
                      <TableCell>Clock Out</TableCell>
                      <TableCell>Active</TableCell>
                      <TableCell>Idle</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>End Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {days.flatMap((d) => (d.sessions || []).map((s) => ({
                      ...s,
                      employee_name: d.full_name,
                    }))).map((s) => (
                      <TableRow key={s.id} hover>
                        <TableCell>{s.employee_name}</TableCell>
                        <TableCell>
                          <Tooltip title={s.id}>
                            <Chip size="small" label={s.id.slice(0, 8)} variant="outlined" />
                          </Tooltip>
                        </TableCell>
                        <TableCell>{fmtTime(s.clock_in)}</TableCell>
                        <TableCell>{fmtTime(s.clock_out)}</TableCell>
                        <TableCell className="figure">{fmtDuration(s.active_seconds)}</TableCell>
                        <TableCell className="figure">{fmtDuration(s.idle_seconds)}</TableCell>
                        <TableCell><StatusChip status={s.status} /></TableCell>
                        <TableCell>{s.end_reason || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            </MobilePaper>
          )}

          {tab === 1 && (
            <MobilePaper>
              {days.map((d) => d.appUsage?.length && (
                <Accordion key={d.employee_id} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 600 }}>{d.full_name}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 1 }}>
                      {d.appUsage.reduce((a, b) => a + (b.duration_seconds || 0), 0)}s total
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>App</TableCell>
                          <TableCell>Window Title</TableCell>
                          <TableCell>Duration</TableCell>
                          <TableCell>Category</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {d.appUsage.sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0)).map((a, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>{a.app_name}</TableCell>
                            <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.window_title || '—'}</TableCell>
                            <TableCell className="figure">{fmtDuration(a.duration_seconds)}</TableCell>
                            <TableCell><Chip size="small" label={a.category} color={categoryColor(a.category)} variant="outlined" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionDetails>
                </Accordion>
              ))}
              {!days.some((d) => d.appUsage?.length) && (
                <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No app usage recorded for this day.</Typography>
              )}
            </MobilePaper>
          )}

          {tab === 2 && (
            <MobilePaper>
              {days.map((d) => d.siteUsage?.length && (
                <Accordion key={d.employee_id} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 600 }}>{d.full_name}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 1 }}>
                      {d.siteUsage.reduce((a, b) => a + (b.duration_seconds || 0), 0)}s total
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Domain</TableCell>
                          <TableCell>Duration</TableCell>
                          <TableCell>Category</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {d.siteUsage.sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0)).map((s, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>{s.domain}</TableCell>
                            <TableCell className="figure">{fmtDuration(s.duration_seconds)}</TableCell>
                            <TableCell><Chip size="small" label={s.category} color={categoryColor(s.category)} variant="outlined" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionDetails>
                </Accordion>
              ))}
              {!days.some((d) => d.siteUsage?.length) && (
                <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No website usage recorded for this day.</Typography>
              )}
            </MobilePaper>
          )}

          {tab === 3 && (
            <MobilePaper>
              {days.map((d) => d.idlePeriods?.length && (
                <Accordion key={d.employee_id} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 600 }}>{d.full_name}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 1 }}>
                      {d.idlePeriods.length} periods · {fmtDuration(d.idlePeriods.reduce((a, b) => a + (b.duration_seconds || 0), 0))} total
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Started</TableCell>
                          <TableCell>Ended</TableCell>
                          <TableCell>Duration</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {d.idlePeriods.map((p, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>{fmtTime(p.started_at)}</TableCell>
                            <TableCell>{fmtTime(p.ended_at)}</TableCell>
                            <TableCell className="figure">{fmtDuration(p.duration_seconds)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionDetails>
                </Accordion>
              ))}
              {!days.some((d) => d.idlePeriods?.length) && (
                <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No idle periods recorded for this day.</Typography>
              )}
            </MobilePaper>
          )}

          {tab === 4 && (
            <MobilePaper>
              {days.map((d) => d.screenshots?.length && (
                <Accordion key={d.employee_id} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 600 }}>{d.full_name}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 1 }}>
                      {d.screenshots.length} screenshots
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {d.screenshots.map((s) => (
                        <Box key={s.id} sx={{ position: 'relative', width: isMobile ? '45%' : 200 }}>
                          <Paper sx={{ p: 1 }}>
                            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                              {fmtTime(s.captured_at)}
                            </Typography>
                            <Box
                              component="img"
                              src={`/api/monitoring/screenshots/${s.id}/url`}
                              alt={`Screenshot at ${fmtTime(s.captured_at)}`}
                              sx={{
                                width: '100%',
                                aspectRatio: '16/10',
                                objectFit: 'cover',
                                borderRadius: 1,
                                cursor: 'pointer',
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                              onClick={() => window.open(`/api/monitoring/screenshots/${s.id}/url`, '_blank')}
                            />
                          </Paper>
                        </Box>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
              {!days.some((d) => d.screenshots?.length) && (
                <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No screenshots for this day.</Typography>
              )}
            </MobilePaper>
          )}
        </>
      )}

      {!loading && days && !days.length && (
        <MobilePaper>
          <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
            No monitoring data for {new Date(date).toLocaleDateString('en-IN')}.
          </Typography>
        </MobilePaper>
      )}
    </Box>
  );
}