import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, Alert, TextField, Grid, Dialog,
  DialogTitle, DialogContent, IconButton, Tabs, Tab, MenuItem, Button, Switch,
} from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import client from '../api/client';

function fmtDuration(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtTime(t) {
  if (!t) return '—';
  return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── per-employee drilldown dialog — apps, sites, idle periods, screenshots ──
function DayDrilldown({ employeeId, employeeName, date, onClose }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [shotUrls, setShotUrls] = useState({});

  useEffect(() => {
    client.get(`/monitoring/employee/${employeeId}/day`, { params: { date } })
      .then(({ data }) => setReport(data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load activity'));
  }, [employeeId, date]);

  const openScreenshot = async (id) => {
    if (shotUrls[id]) return;
    try {
      const { data } = await client.get(`/monitoring/screenshots/${id}/url`);
      setShotUrls((prev) => ({ ...prev, [id]: data.url }));
    } catch {
      // best-effort — leave unset, thumbnail just won't render
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {employeeName} — {date}
        <IconButton onClick={onClose} size="small"><CloseOutlinedIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        {!report && !error && <CircularProgress size={22} />}
        {report && (
          <>
            <Box sx={{ display: 'flex', gap: 3, mb: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Box>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Productivity score</Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.4rem' }}>{report.score.score}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{report.score.label}</Typography>
                </Box>
              </Box>
              <Box><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Productive</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>{report.productivity.productivePct}%</Typography></Box>
              {report.sessions.map((s) => (
                <Box key={s.id}><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Session</Typography>
                  <Typography sx={{ fontSize: '0.85rem' }}>
                    {fmtTime(s.clock_in)} → {fmtTime(s.clock_out) || 'ongoing'}
                    {s.end_reason === 'timeout' && (
                      <Chip size="small" color="warning" label="stopped reporting" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
                    )}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 2.5, mb: 2.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                Focus <b style={{ color: 'inherit' }}>{report.score.breakdown.focus}</b> · Engagement <b>{report.score.breakdown.engagement}</b> · Attendance <b>{report.score.breakdown.attendance}</b>
              </Typography>
            </Box>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1.5, minHeight: 32 }}>
              <Tab label="Apps" sx={{ minHeight: 32 }} />
              <Tab label="Websites" sx={{ minHeight: 32 }} />
              <Tab label="Idle" sx={{ minHeight: 32 }} />
              <Tab label={`Screenshots (${report.screenshots.length})`} sx={{ minHeight: 32 }} />
            </Tabs>

            {tab === 0 && (
              <Table size="small">
                <TableBody>
                  {report.apps.map((a) => (
                    <TableRow key={a.app_name}>
                      <TableCell sx={{ fontSize: '0.85rem' }}>{a.app_name}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem' }}>{fmtDuration(a.duration_seconds)}</TableCell>
                    </TableRow>
                  ))}
                  {report.apps.length === 0 && <TableRow><TableCell sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>No app activity recorded.</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
            {tab === 1 && (
              <Table size="small">
                <TableBody>
                  {report.websites.map((w) => (
                    <TableRow key={w.domain}>
                      <TableCell sx={{ fontSize: '0.85rem' }}>{w.domain}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem' }}>{fmtDuration(w.duration_seconds)}</TableCell>
                    </TableRow>
                  ))}
                  {report.websites.length === 0 && <TableRow><TableCell sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>No browser activity recorded.</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
            {tab === 2 && (
              <Table size="small">
                <TableBody>
                  {report.idle_periods.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ fontSize: '0.85rem' }}>{fmtTime(p.started_at)} → {fmtTime(p.ended_at)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem' }}>{fmtDuration(p.duration_seconds)}</TableCell>
                    </TableRow>
                  ))}
                  {report.idle_periods.length === 0 && <TableRow><TableCell sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>No idle periods.</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
            {tab === 3 && (
              <Grid container spacing={1.5}>
                {report.screenshots.map((s) => (
                  <Grid item xs={4} key={s.id}>
                    <Box
                      onClick={() => openScreenshot(s.id)}
                      sx={{ cursor: 'pointer', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
                    >
                      {shotUrls[s.id] ? (
                        <img src={shotUrls[s.id]} alt="" style={{ width: '100%', display: 'block' }} />
                      ) : (
                        <Box sx={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Click to load</Typography>
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.5 }}>{fmtTime(s.captured_at)}</Typography>
                  </Grid>
                ))}
                {report.screenshots.length === 0 && <Grid item xs={12}><Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>No screenshots — either disabled company-wide, or this employee wasn't active.</Typography></Grid>}
              </Grid>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const CATEGORY_OPTIONS = ['productive', 'unproductive', 'neutral', 'blocked'];
const CATEGORY_COLOR = { productive: 'success', unproductive: 'error', blocked: 'error', neutral: 'default' };

// ── productivity rules manager — app/domain → category, drives the % ──────
// figure shown everywhere else on this page and on My Activity. Read is
// open to any logged-in staff (matches the backend), add/delete requires
// the 'hr' role server-side — a non-HR viewer will just get a 403 toast if
// they somehow try, but the page doesn't bother hiding the form since
// Monitoring itself already sits behind the HR nav group.
function ProductivityRules() {
  const [rules, setRules] = useState(null);
  const [error, setError] = useState('');
  const [matchType, setMatchType] = useState('app');
  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState('productive');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = adding a new rule; set = editing an existing one

  const load = () => {
    client.get('/monitoring/productivity-rules')
      .then(({ data }) => setRules(data.rules))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load productivity rules'));
  };
  useEffect(load, []);

  const resetForm = () => {
    setEditingId(null);
    setMatchType('app');
    setPattern('');
    setCategory('productive');
  };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setMatchType(rule.match_type);
    setPattern(rule.pattern);
    setCategory(rule.category);
  };

  const saveRule = async () => {
    if (!pattern.trim()) return;
    setSaving(true);
    setError('');
    try {
      // POST upserts on (match_type, pattern) — editing and adding are the
      // same call server-side; only the local "which row am I editing" UI
      // state differs.
      await client.post('/monitoring/productivity-rules', { match_type: matchType, pattern: pattern.trim(), category });
      resetForm();
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id) => {
    try {
      await client.delete(`/monitoring/productivity-rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) resetForm();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete rule');
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>Productivity rules</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2 }}>
        App names match exactly (e.g. "Code.exe"); domains match as a substring (e.g. "youtube.com" also catches "music.youtube.com").
        Anything with no matching rule counts as neutral and doesn't affect the productive %. Only founder, admin, HR, or a department head can add, edit, or delete rules.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" select label="Type" value={matchType} onChange={(e) => setMatchType(e.target.value)} disabled={!!editingId} sx={{ width: 120 }}>
          <MenuItem value="app">App</MenuItem>
          <MenuItem value="domain">Domain</MenuItem>
        </TextField>
        <TextField
          size="small" label={matchType === 'app' ? 'App name (e.g. Code.exe)' : 'Domain (e.g. github.com)'}
          value={pattern} onChange={(e) => setPattern(e.target.value)} disabled={!!editingId} sx={{ minWidth: 240 }}
        />
        <TextField size="small" select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ width: 150 }}>
          {CATEGORY_OPTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <Button variant="contained" size="small" onClick={saveRule} disabled={saving || !pattern.trim()}>
          {editingId ? 'Update rule' : 'Add rule'}
        </Button>
        {editingId && <Button size="small" onClick={resetForm}>Cancel</Button>}
      </Box>
      {editingId && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1.5 }}>
          Editing an existing rule — type and pattern are locked to the original match; change the category and save, or Cancel.
        </Typography>
      )}

      {!rules && !error && <CircularProgress size={20} />}
      {rules && (
        <Paper sx={{ maxWidth: 640, mt: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Pattern</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id} selected={editingId === r.id}>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{r.match_type}</TableCell>
                  <TableCell sx={{ fontSize: '0.85rem' }}>{r.pattern}</TableCell>
                  <TableCell><Chip size="small" color={CATEGORY_COLOR[r.category]} label={r.category} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => startEdit(r)}><EditOutlinedIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => deleteRule(r.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', color: 'text.secondary', py: 3 }}>
                  No rules yet — everything counts as neutral until you add some.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}


// ── company-wide monitoring settings — screenshots, idle threshold, etc. ──
// This is the panel that explains most of "why isn't X showing up": idle
// periods need idle_threshold_seconds of continuous inactivity before they
// count at all (default 5 min), and screenshots are OFF by default
// company-wide until someone explicitly turns them on here.
function MonitoringSettings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    client.get('/monitoring/settings')
      .then(({ data }) => setSettings(data.settings))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load settings'));
  }, []);

  const save = async (patch) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await client.put('/monitoring/settings', patch);
      setSettings(data.settings);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!settings && !error) return <Box sx={{ mt: 4 }}><CircularProgress size={20} /></Box>;
  if (!settings) return <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>Monitoring settings</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2 }}>
        Company-wide — applies to every agent. Only founder, admin, HR, or a department head can change these.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ maxWidth: 640 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Screenshots</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                Off by default — this is why no screenshots have shown up yet. Employees see the consent notice before starting work either way.
              </Typography>
            </Box>
            <Switch
              checked={settings.screenshots_enabled}
              disabled={saving}
              onChange={(e) => save({ screenshots_enabled: e.target.checked })}
            />
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Restrict Incognito / InPrivate mode</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                Applies a machine-wide Windows registry policy the next time the agent starts on each laptop — requires the employee (or IT) to approve one UAC prompt locally on that PC. Not retroactive to laptops that already have the agent running until it next restarts.
              </Typography>
            </Box>
            <Switch
              checked={settings.restrict_incognito}
              disabled={saving}
              onChange={(e) => save({ restrict_incognito: e.target.checked })}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" type="number" label="Expected workday (hours)"
            value={settings.expected_daily_hours}
            onBlur={(e) => save({ expected_daily_hours: Number(e.target.value) })}
            onChange={(e) => setSettings((s) => ({ ...s, expected_daily_hours: e.target.value }))}
            helperText="Used by the productivity score's attendance component."
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" type="number" label="Screenshot interval (seconds)"
            value={settings.screenshot_interval_seconds}
            onBlur={(e) => save({ screenshot_interval_seconds: Number(e.target.value) })}
            onChange={(e) => setSettings((s) => ({ ...s, screenshot_interval_seconds: e.target.value }))}
            disabled={!settings.screenshots_enabled}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" type="number" label="Idle threshold (seconds)"
            value={settings.idle_threshold_seconds}
            onBlur={(e) => save({ idle_threshold_seconds: Number(e.target.value) })}
            onChange={(e) => setSettings((s) => ({ ...s, idle_threshold_seconds: e.target.value }))}
            helperText="Default 300 (5 min) — no mouse/keyboard activity for this long before it counts as idle."
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" type="number" label="Heartbeat interval (seconds)"
            value={settings.heartbeat_interval_seconds}
            onBlur={(e) => save({ heartbeat_interval_seconds: Number(e.target.value) })}
            onChange={(e) => setSettings((s) => ({ ...s, heartbeat_interval_seconds: e.target.value }))}
            helperText="How often each agent syncs. Lower = more real-time, more requests."
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth size="small" multiline minRows={2} label="Consent notice (shown in the agent before every Start Work)"
            value={settings.consent_notice}
            onBlur={(e) => save({ consent_notice: e.target.value })}
            onChange={(e) => setSettings((s) => ({ ...s, consent_notice: e.target.value }))}
          />
        </Grid>
      </Grid>
      {savedAt && <Typography sx={{ fontSize: '0.75rem', color: 'success.main', mt: 1.5 }}>Saved.</Typography>}
    </Box>
  );
}

export default function Monitoring() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(today());

  const load = () => {
    client.get('/monitoring/live')
      .then(({ data }) => setRows(data.employees || []))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load monitoring data'));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // matches the agent's default heartbeat cadence
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(
    () => (rows || []).filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const onlineCount = (rows || []).filter((r) => r.is_online).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">Monitoring</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mt: 0.5 }}>
            Live desktop-agent status. Employees see this in their own "My Activity" view too —
            monitoring is disclosed, not covert. Refreshes every 30s.
          </Typography>
        </Box>
        <Chip icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />} color="success" variant="outlined" label={`${onlineCount} online`} />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
        <TextField size="small" label="Search employee" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 240 }} />
        <TextField size="small" type="date" label="Drilldown date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
      </Box>

      {!rows && !error && <CircularProgress size={22} />}

      {rows && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Current app</TableCell>
                <TableCell>Current site</TableCell>
                <TableCell align="right">Worked</TableCell>
                <TableCell align="right">Idle</TableCell>
                <TableCell align="right">Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.employee_id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setSelected(r)}
                >
                  <TableCell sx={{ fontSize: '0.85rem' }}>{r.full_name}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{r.department || '—'}</TableCell>
                  <TableCell>
                    {r.is_online
                      ? <Chip size="small" color="success" label="Online" />
                      : r.session_status === 'closed'
                        ? r.end_reason === 'timeout'
                          // The agent stopped sending heartbeats without a
                          // clean Stop Work click — crash, force-killed
                          // process, network cut, laptop closed mid-shift.
                          // Distinct from a normal logout on purpose: this
                          // is the signal that something needs a look, not
                          // routine end-of-day activity.
                          ? <Chip size="small" color="warning" label="Stopped reporting" />
                          : r.end_reason === 'force_logout'
                            ? <Chip size="small" variant="outlined" label="Shutdown" />
                            : <Chip size="small" variant="outlined" label="Logged out" />
                        : <Chip size="small" variant="outlined" color="default" label="Offline" />}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{r.current_app || '—'}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{r.current_domain || '—'}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                    {fmtDuration(r.active_seconds)}
                    {r.session_count > 1 && (
                      <Typography component="span" sx={{ fontSize: '0.68rem', color: 'text.secondary', ml: 0.75 }}>
                        ({r.session_count} sessions)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{fmtDuration(r.idle_seconds)}</TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      label={r.score}
                      color={r.score >= 85 ? 'success' : r.score >= 70 ? 'primary' : r.score >= 50 ? 'warning' : 'error'}
                      variant={r.score === 0 ? 'outlined' : 'filled'}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                  No employees found{search ? ' matching your search' : ' — no agent activity yet today'}.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {selected && (
        <DayDrilldown
          employeeId={selected.employee_id}
          employeeName={selected.full_name}
          date={date}
          onClose={() => setSelected(null)}
        />
      )}

      <ProductivityRules />
      <MonitoringSettings />
    </Box>
  );
}