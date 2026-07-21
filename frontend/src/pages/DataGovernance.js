import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip, Tabs, Tab, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const DECISION_COLOR = { archived: 'info', deleted: 'error', retained: 'success', dismissed: 'default' };

const emptyPolicyForm = { entity_type: 'compliance_items', retention_period_days: 2555, action_on_expiry: 'flag', date_column: 'created_at', notes: '' };

export default function DataGovernance() {
  const { staff } = useAuth();
  const isAdminOrOwner = ['owner', 'admin'].includes(staff?.role);

  const [tab, setTab] = useState('flags');
  const [policies, setPolicies] = useState([]);
  const [flags, setFlags] = useState([]);
  const [showReviewed, setShowReviewed] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState(emptyPolicyForm);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('retained');
  const [reviewNotes, setReviewNotes] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const loadPolicies = () => client.get('/data-governance/policies').then(({ data }) => setPolicies(data.policies)).catch(() => setPolicies([]));
  const loadFlags = () => client.get(`/data-governance/flags?reviewed=${showReviewed}`).then(({ data }) => setFlags(data.flags)).catch(() => setFlags([]));

  useEffect(() => { loadPolicies(); }, []);
  useEffect(() => { loadFlags(); }, [showReviewed]);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data } = await client.post('/data-governance/scan');
      window.alert(`Scanned ${data.policiesScanned} polic${data.policiesScanned === 1 ? 'y' : 'ies'} — ${data.totalNewlyFlagged} new item(s) flagged for review.`);
      loadFlags();
      loadPolicies();
    } catch (err) {
      window.alert(err.response?.data?.error || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const savePolicy = async () => {
    setError('');
    try {
      await client.post('/data-governance/policies', policyForm);
      setPolicyOpen(false);
      setPolicyForm(emptyPolicyForm);
      loadPolicies();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save policy');
    }
  };

  const submitReview = async () => {
    try {
      await client.post(`/data-governance/flags/${reviewTarget.id}/review`, { review_decision: reviewDecision, review_notes: reviewNotes });
      setReviewTarget(null);
      setReviewNotes('');
      loadFlags();
    } catch (err) {
      window.alert(err.response?.data?.error || 'Failed to submit review');
    }
  };

  if (!isAdminOrOwner) {
    return <Alert severity="warning">Data governance is restricted to Owner and Admin.</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Data Governance</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Retention policies flag old records for review — nothing is ever archived or deleted automatically.
          </Typography>
        </Box>
        <Button variant="contained" onClick={runScan} disabled={scanning}>{scanning ? 'Scanning…' : 'Run retention scan'}</Button>
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Flags to review" value="flags" />
        <Tab label="Retention policies" value="policies" />
      </Tabs>

      {tab === 'flags' && (
        <>
          <FormControlLabel
            control={<Switch checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} />}
            label="Show reviewed flags"
            sx={{ mb: 1 }}
          />
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Entity</TableCell>
                  <TableCell>Record ID</TableCell>
                  <TableCell>Age (days)</TableCell>
                  <TableCell>Flagged</TableCell>
                  <TableCell>Decision</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {flags.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell sx={{ fontSize: '0.85rem' }}>{flag.entity_type}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{flag.entity_id}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: '0.85rem' }}>{flag.entity_age_days}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: '0.85rem' }}>{flag.flagged_at?.slice(0, 10)}</TableCell>
                    <TableCell>
                      {flag.review_decision
                        ? <Chip size="small" label={flag.review_decision} color={DECISION_COLOR[flag.review_decision]} />
                        : <Chip size="small" label="Unreviewed" variant="outlined" />}
                    </TableCell>
                    <TableCell align="right">
                      {!flag.reviewed_by && <Button size="small" onClick={() => { setReviewTarget(flag); setReviewDecision('retained'); setReviewNotes(''); }}>Review</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {!flags.length && (
                  <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    {showReviewed ? 'No reviewed flags.' : 'No unreviewed flags — nothing needs attention right now.'}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {tab === 'policies' && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <Button startIcon={<AddIcon />} onClick={() => setPolicyOpen(true)}>Add policy</Button>
          </Box>
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Entity type</TableCell>
                  <TableCell>Retention</TableCell>
                  <TableCell>On expiry</TableCell>
                  <TableCell>Date column</TableCell>
                  <TableCell>Last scanned</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.entity_type}</TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>{Math.round(p.retention_period_days / 365 * 10) / 10} yrs ({p.retention_period_days}d)</TableCell>
                    <TableCell><Chip size="small" label={p.action_on_expiry} variant="outlined" /></TableCell>
                    <TableCell sx={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{p.date_column}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: '0.85rem' }}>{p.last_scanned_at?.slice(0, 10) || 'Never'}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', maxWidth: 240 }}>{p.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* Add policy dialog */}
      <Dialog open={policyOpen} onClose={() => setPolicyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add retention policy</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Entity type" margin="normal" value={policyForm.entity_type} onChange={(e) => setPolicyForm({ ...policyForm, entity_type: e.target.value })}>
            {['audit_log', 'compliance_items', 'employee_documents', 'documents', 'one_time_registrations', 'certifications', 'ip_assets', 'invoices'].map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth type="number" label="Retention period (days)" margin="normal" value={policyForm.retention_period_days} onChange={(e) => setPolicyForm({ ...policyForm, retention_period_days: e.target.value })} />
          <TextField fullWidth select label="Action on expiry" margin="normal" value={policyForm.action_on_expiry} onChange={(e) => setPolicyForm({ ...policyForm, action_on_expiry: e.target.value })}>
            <MenuItem value="flag">Flag for review</MenuItem>
            <MenuItem value="archive">Archive</MenuItem>
            <MenuItem value="delete">Delete</MenuItem>
          </TextField>
          <TextField fullWidth label="Date column" margin="normal" value={policyForm.date_column} onChange={(e) => setPolicyForm({ ...policyForm, date_column: e.target.value })} helperText="Which column on that table to measure age from" />
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={policyForm.notes} onChange={(e) => setPolicyForm({ ...policyForm, notes: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPolicyOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={savePolicy}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Review flag dialog */}
      <Dialog open={!!reviewTarget} onClose={() => setReviewTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Review flagged record</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {reviewTarget?.entity_type} record ({reviewTarget?.entity_id}) is {reviewTarget?.entity_age_days} days old.
          </Alert>
          <TextField fullWidth select label="Decision" margin="normal" value={reviewDecision} onChange={(e) => setReviewDecision(e.target.value)}>
            <MenuItem value="retained">Retain — keep as is</MenuItem>
            <MenuItem value="archived">Mark archived</MenuItem>
            <MenuItem value="deleted">Mark for deletion</MenuItem>
            <MenuItem value="dismissed">Dismiss — false positive</MenuItem>
          </TextField>
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
          <Alert severity="warning" sx={{ mt: 1 }}>
            This records your decision only — it does not automatically archive or delete the underlying record. Execute that separately if needed.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={submitReview}>Submit review</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}