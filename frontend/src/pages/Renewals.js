import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  Tabs, Tab, Grid, IconButton, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileDialog,
  MobileFormGrid,
  MobileActionButtons,
  MobileStack,
  ResponsiveTableContainer,
  MobileCardGrid,
  useMobile,
} from '../components/MobileResponsive';

const STAGE_COLOR = {
  'Early Alert': 'info',
  'Proposal Prep': 'warning',
  'Customer Outreach': 'primary',
  'Final Push': 'error',
  'No Stage': 'default',
};

const STATUS_COLOR = {
  draft: 'default',
  pending_approval: 'warning',
  approved: 'success',
  rejected: 'error',
  executed: 'info',
};

export default function Renewals() {
  const isMobile = useMobile();
  const [renewals, setRenewals] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [selectedRenewal, setSelectedRenewal] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Proposal dialog
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalRenewal, setProposalRenewal] = useState(null);
  const [proposalForm, setProposalForm] = useState({
    seats: '', priceInr: '', discountPercent: '', termMonths: '',
    billingFrequency: 'annual', notes: '',
  });
  const [proposalSaving, setProposalSaving] = useState(false);
  const [proposalError, setProposalError] = useState('');

  // Approval dialog
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalProposal, setApprovalProposal] = useState(null);
  const [approvalDecision, setApprovalDecision] = useState(true);
  const [approvalNotes, setApprovalNotes] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [renewalsRes, statsRes] = await Promise.all([
        client.get('/renewals?days=180'),
        client.get('/renewals/dashboard'),
      ]);
      setRenewals(renewalsRes.data.renewals);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load renewals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = (r) => {
    setSelectedRenewal(r);
    setDetailOpen(true);
  };

  const openProposal = (r) => {
    setProposalRenewal(r);
    setProposalForm({
      seats: r.seats || '',
      priceInr: r.net_value_paise ? (r.net_value_paise / 100).toFixed(0) : '',
      discountPercent: r.discount_percent || 0,
      termMonths: r.term_months || 12,
      billingFrequency: r.billing_frequency || 'annual',
      notes: '',
    });
    setProposalError('');
    setProposalOpen(true);
  };

  const handleProposalSubmit = async () => {
    setProposalSaving(true);
    setProposalError('');
    try {
      const payload = {
        seats: proposalForm.seats ? parseInt(proposalForm.seats) : null,
        priceInr: proposalForm.priceInr ? parseFloat(proposalForm.priceInr) : null,
        discountPercent: proposalForm.discountPercent ? parseFloat(proposalForm.discountPercent) : null,
        termMonths: proposalForm.termMonths ? parseInt(proposalForm.termMonths) : null,
        billingFrequency: proposalForm.billingFrequency,
        notes: proposalForm.notes,
      };
      await client.post(`/renewals/${proposalRenewal.id}/proposals`, payload);
      setProposalOpen(false);
      setProposalForm({ seats: '', priceInr: '', discountPercent: '', termMonths: '', billingFrequency: 'annual', notes: '' });
      load();
    } catch (err) {
      setProposalError(err.response?.data?.error || 'Failed to create proposal');
    } finally {
      setProposalSaving(false);
    }
  };

  const openApproval = (proposal) => {
    setApprovalProposal(proposal);
    setApprovalDecision(true);
    setApprovalNotes('');
    setApprovalOpen(true);
  };

  const handleApproval = async () => {
    try {
      await client.patch(`/renewals/proposals/${approvalProposal.id}/approve`, {
        approved: approvalDecision,
        notes: approvalNotes,
      });
      setApprovalOpen(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update approval');
    }
  };

  const runCheck = async () => {
    try {
      await client.post('/renewals/run-check');
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to run check');
    }
  };

  const TABS = ['All Renewals', 'Overdue', 'Urgent (≤30d)', 'This Week', 'This Month'];

  const filtered = renewals.filter(r => {
    if (tab === 0) return true;
    if (tab === 1) return r.isOverdue;
    if (tab === 2) return r.isUrgent;
    if (tab === 3) return r.daysUntilRenewal > 0 && r.daysUntilRenewal <= 7;
    if (tab === 4) return r.daysUntilRenewal > 7 && r.daysUntilRenewal <= 30;
    return true;
  });

  if (loading) return <MobileStack gap={2}><Typography>Loading renewals…</Typography></MobileStack>;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Renewal Workflow</Typography>
        <MobileButton variant="outlined" onClick={runCheck} startIcon={<EditIcon />}>Run Check Now</MobileButton>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats Cards */}
      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total Upcoming</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Overdue</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>{stats.overdue || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Urgent (≤30d)</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'warning.main' }}>{stats.urgent || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Value at Risk</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>
            {stats.totalValueAtRisk ? `₹${Math.round(stats.totalValueAtRisk / 1e5 * 10) / 10}L` : '—'}
          </Typography>
        </MobilePaper>
      </MobileCardGrid>

      {/* Stage Breakdown */}
      {Object.keys(stats.byStage || {}).length > 0 && (
        <MobilePaper sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1.5 }}>By Stage</Typography>
          <MobileStack direction="row" gap={2} flexWrap="wrap">
            {Object.entries(stats.byStage).map(([stage, count]) => (
              <Chip key={stage} label={`${stage}: ${count}`} color={STAGE_COLOR[stage] || 'default'} variant="outlined" size="small" />
            ))}
          </MobileStack>
        </MobilePaper>
      )}

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        {TABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Platform ID</TableCell>
                <TableCell>Renewal Date</TableCell>
                <TableCell>Days Left</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Seats</TableCell>
                <TableCell>Value</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id || r.platformUserId} hover onClick={() => openDetail(r)}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {r.party_name || r.companyName || r.fullName || r.platform_email || r.email}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                      {r.platform_email || r.email}
                    </Typography>
                  </TableCell>
                  <TableCell className="figure" sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {r.platformUserId || r.id}
                  </TableCell>
                  <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{r.renewal_date}</TableCell>
                  <TableCell className="figure" sx={{ fontSize: '0.8rem', fontWeight: r.isOverdue ? 700 : 400, color: r.isOverdue ? 'error.main' : r.isUrgent ? 'warning.main' : 'inherit' }}>
                    {r.isOverdue ? `${Math.abs(r.daysUntilRenewal)}d overdue` : r.daysUntilRenewal === 0 ? 'Today' : `${r.daysUntilRenewal}d`}
                  </TableCell>
                  <TableCell>
                    {r.currentStage ? (
                      <Chip size="small" label={r.currentStage.label} color={STAGE_COLOR[r.currentStage.label] || 'default'} />
                    ) : (
                      <Chip size="small" label="No Stage" color="default" />
                    )}
                  </TableCell>
                  <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{r.seats || '—'}</TableCell>
                  <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>
                    {(r.net_value_paise || r.totalValuePaise || 0) / 100 > 1e5
                      ? `₹${((r.net_value_paise || r.totalValuePaise || 0) / 100 / 1e5).toFixed(1)}L`
                      : `₹${((r.net_value_paise || r.totalValuePaise || 0) / 100).toLocaleString()}`}
                  </TableCell>
                  <TableCell align="right">
                    <MobileButton size="small" onClick={(e) => { e.stopPropagation(); openProposal(r); }}>Propose</MobileButton>
                    <MobileButton size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); openDetail(r); }}>View</MobileButton>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No renewals in this timeframe.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      {/* Detail Dialog */}
      <MobileDialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRenewal?.party_name || selectedRenewal?.companyName || 'Renewal Details'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 1 }}>
            <MobileTextField fullWidth label="Renewal Date" value={selectedRenewal?.renewal_date || ''} disabled />
            <MobileTextField fullWidth label="Days Until" value={selectedRenewal?.daysUntilRenewal !== undefined ? `${selectedRenewal.daysUntilRenewal}d` : '—'} disabled />
            <MobileTextField fullWidth label="Current Stage" value={selectedRenewal?.currentStage?.label || 'No Stage'} disabled />
            <MobileTextField fullWidth label="Seats" value={selectedRenewal?.seats || '—'} disabled />
            <MobileTextField fullWidth label="Current Value" value={(selectedRenewal?.net_value_paise || selectedRenewal?.totalValuePaise || 0) / 100 > 1e5 ? `₹${((selectedRenewal.net_value_paise || selectedRenewal.totalValuePaise || 0) / 100 / 1e5).toFixed(1)}L` : `₹${((selectedRenewal.net_value_paise || selectedRenewal.totalValuePaise || 0) / 100).toLocaleString()}`} disabled />
            <MobileTextField fullWidth label="Billing Frequency" value={selectedRenewal?.billing_frequency || '—'} disabled />
            <MobileTextField fullWidth label="Term (months)" value={selectedRenewal?.term_months || '—'} disabled />
          </MobileFormGrid>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setDetailOpen(false)}>Close</MobileButton>
          <MobileButton variant="contained" onClick={() => { openProposal(selectedRenewal); setDetailOpen(false); }}>Create Proposal</MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* Create Proposal Dialog */}
      <MobileDialog open={proposalOpen} onClose={() => setProposalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Renewal Proposal</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 1 }}>
            <MobileTextField fullWidth type="number" label="Seats" value={proposalForm.seats} onChange={(e) => setProposalForm({ ...proposalForm, seats: e.target.value })} />
            <MobileTextField fullWidth type="number" label="Price (INR/period)" value={proposalForm.priceInr} onChange={(e) => setProposalForm({ ...proposalForm, priceInr: e.target.value })} />
            <MobileTextField fullWidth type="number" label="Discount %" value={proposalForm.discountPercent} onChange={(e) => setProposalForm({ ...proposalForm, discountPercent: e.target.value })} />
            <MobileTextField fullWidth type="number" label="Term (months)" value={proposalForm.termMonths} onChange={(e) => setProposalForm({ ...proposalForm, termMonths: e.target.value })} />
            <MobileTextField
              fullWidth select label="Billing Frequency" value={proposalForm.billingFrequency}
              onChange={(e) => setProposalForm({ ...proposalForm, billingFrequency: e.target.value })}
              options={['monthly', 'annual', 'one_time'].map((v) => ({ value: v, label: v }))}
            />
            <MobileTextField fullWidth multiline rows={3} label="Notes" value={proposalForm.notes} onChange={(e) => setProposalForm({ ...proposalForm, notes: e.target.value })} />
          </MobileFormGrid>
          {proposalError && <Alert severity="error" sx={{ mt: 1 }}>{proposalError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setProposalOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleProposalSubmit} disabled={proposalSaving}>
            {proposalSaving ? 'Creating…' : 'Create Proposal'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* Approval Dialog */}
      <MobileDialog open={approvalOpen} onClose={() => setApprovalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{approvalDecision ? 'Approve' : 'Reject'} Renewal Proposal</DialogTitle>
        <DialogContent>
          <MobileTextField fullWidth multiline rows={3} label="Notes (required for rejection)" value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} />
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setApprovalOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" color={approvalDecision ? 'success' : 'error'} onClick={handleApproval}>
            {approvalDecision ? 'Approve' : 'Reject'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}