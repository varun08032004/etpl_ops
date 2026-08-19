import { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip, Tabs, Tab, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileFormGrid,
  MobileDialog,
  MobileActionButtons,
  MobileStack,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const DECISION_COLOR = { archived: 'info', deleted: 'error', retained: 'success', dismissed: 'default' };

const emptyPolicyForm = { entity_type: 'compliance_items', retention_period_days: 2555, action_on_expiry: 'flag', date_column: 'created_at', notes: '' };

export default function DataGovernance() {
  const { staff } = useAuth();
  const isAdminOrOwner = ['owner', 'admin'].includes(staff?.role);
  const isMobile = useMobile();

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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Data Governance</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Retention policies flag old records for review — nothing is ever archived or deleted automatically.
          </Typography>
        </Box>
        <MobileButton variant="contained" onClick={runScan} disabled={scanning}>{scanning ? 'Scanning…' : 'Run retention scan'}</MobileButton>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider' }} variant="scrollable" scrollButtons="auto">
          <Tab label="Flags to review" value="flags" />
          <Tab label="Retention policies" value="policies" />
        </Tabs>
      </MobilePaper>

      {tab === 'flags' && (
        <MobilePaper>
          <FormControlLabel
            control={<Switch checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} />}
            label="Show reviewed flags"
            sx={{ mb: 1 }}
          />
          <ResponsiveTableContainer>
            <Table size="small">
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
                    <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{flag.entity_type}</TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontFamily: 'monospace' }}>{flag.entity_id}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{flag.entity_age_days}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{flag.flagged_at?.slice(0, 10)}</TableCell>
                    <TableCell>
                      {flag.review_decision
                        ? <Chip size="small" label={flag.review_decision} color={DECISION_COLOR[flag.review_decision]} />
                        : <Chip size="small" label="Unreviewed" variant="outlined" />}
                    </TableCell>
                    <TableCell align="right">
                      {!flag.reviewed_by && <MobileButton size="small" onClick={() => { setReviewTarget(flag); setReviewDecision('retained'); setReviewNotes(''); }}>Review</MobileButton>}
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
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {tab === 'policies' && (
        <>
          <MobilePaper sx={{ mb: 1 }}>
            <MobilePageHeader>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>Retention policies</Typography>
              <MobileButton startIcon={<AddIcon />} onClick={() => setPolicyOpen(true)}>Add policy</MobileButton>
            </MobilePageHeader>
          </MobilePaper>
          <MobilePaper>
            <ResponsiveTableContainer>
              <Table size="small">
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
                      <TableCell sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{p.entity_type}</TableCell>
                      <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{Math.round(p.retention_period_days / 365 * 10) / 10} yrs ({p.retention_period_days}d)</TableCell>
                      <TableCell><Chip size="small" label={p.action_on_expiry} variant="outlined" /></TableCell>
                      <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', fontFamily: 'monospace' }}>{p.date_column}</TableCell>
                      <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{p.last_scanned_at?.slice(0, 10) || 'Never'}</TableCell>
                      <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary', maxWidth: isMobile ? '100%' : 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </>
      )}

      {/* Add policy dialog */}
      <MobileDialog open={policyOpen} onClose={() => setPolicyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add retention policy</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 1 }}>
            <MobileTextField
              fullWidth
              select
              label="Entity type"
              value={policyForm.entity_type}
              onChange={(e) => setPolicyForm({ ...policyForm, entity_type: e.target.value })}
              options={['audit_log', 'compliance_items', 'employee_documents', 'documents', 'one_time_registrations', 'certifications', 'ip_assets', 'invoices'].map((t) => ({ value: t, label: t }))}
            />
            <MobileTextField fullWidth type="number" label="Retention period (days)" value={policyForm.retention_period_days} onChange={(e) => setPolicyForm({ ...policyForm, retention_period_days: e.target.value })} margin="normal" />
            <MobileTextField
              fullWidth
              select
              label="Action on expiry"
              value={policyForm.action_on_expiry}
              onChange={(e) => setPolicyForm({ ...policyForm, action_on_expiry: e.target.value })}
              options={[{ value: 'flag', label: 'Flag for review' }, { value: 'archive', label: 'Archive' }, { value: 'delete', label: 'Delete' }]}
              margin="normal"
            />
            <MobileTextField fullWidth label="Date column" value={policyForm.date_column} onChange={(e) => setPolicyForm({ ...policyForm, date_column: e.target.value })} helperText="Which column on that table to measure age from" margin="normal" />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={policyForm.notes} onChange={(e) => setPolicyForm({ ...policyForm, notes: e.target.value })} margin="normal" />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setPolicyOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={savePolicy}>Save</MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* Review flag dialog */}
      <MobileDialog open={Boolean(reviewTarget)} onClose={() => setReviewTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Review flagged record</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {reviewTarget?.entity_type} record ({reviewTarget?.entity_id}) is {reviewTarget?.entity_age_days} days old.
          </Alert>
          <MobileFormGrid>
            <MobileTextField
              fullWidth
              select
              label="Decision"
              value={reviewDecision}
              onChange={(e) => setReviewDecision(e.target.value)}
              options={[
                { value: 'retained', label: 'Retain — keep as is' },
                { value: 'archived', label: 'Mark archived' },
                { value: 'deleted', label: 'Mark for deletion' },
                { value: 'dismissed', label: 'Dismiss — false positive' },
              ]}
              margin="normal"
            />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} margin="normal" />
          </MobileFormGrid>
          <Alert severity="warning" sx={{ mt: 1 }}>
            This records your decision only — it does not automatically archive or delete the underlying record. Execute that separately if needed.
          </Alert>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setReviewTarget(null)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={submitReview}>Submit review</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}