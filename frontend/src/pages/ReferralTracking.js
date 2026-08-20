import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  Tabs, Tab, Grid, IconButton, Divider, Tooltip, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EditIcon from '@mui/icons-material/Edit';
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

const STAGE_ORDER = ['submitted', 'qualified', 'demo_scheduled', 'proposal_sent', 'won', 'lost'];
const STAGE_LABEL = {
  submitted: 'Submitted',
  qualified: 'Qualified',
  demo_scheduled: 'Demo Scheduled',
  proposal_sent: 'Proposal Sent',
  won: 'Won',
  lost: 'Lost',
};
const STAGE_COLOR = {
  submitted: 'info',
  qualified: 'primary',
  demo_scheduled: 'warning',
  proposal_sent: 'warning',
  won: 'success',
  lost: 'error',
};
const COMMISSION_COLOR = {
  pending: 'warning',
  approved: 'info',
  paid: 'success',
  cancelled: 'default',
};
const REFERRER_TYPE_LABEL = {
  ca_firm: 'CA Firm',
  audit_firm: 'Audit Firm',
  esg_consultancy: 'ESG Consultancy',
  law_firm: 'Law Firm',
  channel_partner: 'Channel Partner',
  employee: 'Employee',
  other: 'Other',
};

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function ReferralTracking() {
  const isMobile = useMobile();
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState({});
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    referrer_type: 'ca_firm', referrer_name: '', referrer_email: '',
    lead_name: '', lead_company: '', lead_email: '', lead_phone: '',
    lead_source: 'referral', estimated_value: '', notes: '',
  });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [stageChangeReferral, setStageChangeReferral] = useState(null);
  const [stageChangeStage, setStageChangeStage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [referralsRes, statsRes, commissionsRes] = await Promise.all([
        client.get('/referrals'),
        client.get('/referrals/dashboard'),
        client.get('/referrals/commissions'),
      ]);
      setReferrals(referralsRes.data.referrals);
      setStats(statsRes.data);
      setCommissions(commissionsRes.data.commissions);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreateSaving(true);
    setCreateError('');
    try {
      await client.post('/referrals', { ...createForm, createdBy: 'current_user' });
      setCreateOpen(false);
      setCreateForm({ referrer_type: 'ca_firm', referrer_name: '', referrer_email: '', lead_name: '', lead_company: '', lead_email: '', lead_phone: '', lead_source: 'referral', estimated_value: '', notes: '' });
      load();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create referral');
    } finally {
      setCreateSaving(false);
    }
  };

  const updateStage = async (referralId, stage) => {
    try {
      await client.patch(`/referrals/${referralId}/stage`, { stage });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update stage');
    }
  };

  const approveCommission = async (commissionId) => {
    try {
      await client.patch(`/referrals/commissions/${commissionId}/approve`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve commission');
    }
  };

  const payCommission = async (commissionId) => {
    const ref = prompt('Enter payment reference:');
    if (!ref) return;
    try {
      await client.patch(`/referrals/commissions/${commissionId}/pay`, { paymentReference: ref });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to mark as paid');
    }
  };

  const openStageChange = (referral) => {
    setStageChangeReferral(referral);
    setStageChangeStage(referral.stage);
  };

  const TABS = ['All', 'Submitted', 'Qualified', 'Demo', 'Proposal', 'Won', 'Lost'];

  if (loading) return <MobileStack gap={2}><Typography>Loading referrals…</Typography></MobileStack>;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Referral Tracking</Typography>
        <MobileButton variant="contained" onClick={() => setCreateOpen(true)} startIcon={<AddIcon />}>New Referral</MobileButton>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats Cards */}
      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total Referrals</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total_referrals || 0}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Won</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'success.main' }}>{stats.won || 0}</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Conv: {(stats.total_referrals && stats.won) ? ((stats.won / stats.total_referrals * 100).toFixed(1) + '%') : '—'}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Pipeline Value</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'primary.main' }}>
            {formatINR(stats.total_pipeline_value || 0)}
          </Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Won Value</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'success.main' }}>
            {formatINR(stats.total_won_value || 0)}
          </Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Pending Commissions</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'warning.main' }}>
            {formatINR(stats.pendingCommissions || 0)}
          </Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Paid Commissions</Typography>
          <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'success.main' }}>
            {formatINR(stats.paidCommissions || 0)}
          </Typography>
        </MobilePaper>
      </MobileCardGrid>

      {/* Referrer Type Breakdown */}
      {stats.byType && Object.keys(stats.byType).length > 0 && (
        <MobilePaper sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1.5 }}>By Referrer Type</Typography>
          <MobileStack direction="row" gap={1.5} flexWrap="wrap">
            {stats.byType.map((b) => (
              <Chip key={b.referrer_type} label={`${REFERRER_TYPE_LABEL[b.referrer_type] || b.referrer_type}: ${b.count} (Won: ${formatINR(b.won_value)})`} variant="outlined" size="small" />
            ))}
          </MobileStack>
        </MobilePaper>
      )}

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        {['All', 'Submitted', 'Qualified', 'Demo', 'Proposal', 'Won', 'Lost'].map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      {/* REFERRALS TABLE */}
      {tab <= 6 && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Lead</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Referrer</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Est. Value</TableCell>
                  <TableCell align="center">Stage</TableCell>
                  <TableCell align="right">Commission</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {referrals
                  .filter(r => tab === 0 || r.stage === STAGE_ORDER[tab - 1])
                  .map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.lead_name}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{r.lead_email}</Typography>
                      </TableCell>
                      <TableCell>{r.lead_company}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{r.referrer_name}</Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{r.referrer_email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={REFERRER_TYPE_LABEL[r.referrer_type] || r.referrer_type} variant="outlined" />
                      </TableCell>
                      <TableCell align="right" className="figure">{formatINR(r.estimated_value)}</TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={STAGE_LABEL[r.stage] || r.stage} color={STAGE_COLOR[r.stage] || 'default'} />
                      </TableCell>
                      <TableCell align="right" className="figure">
                        {formatINR(r.estimated_value * (r.commission_rate || 0))}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Change Stage">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openStageChange(r); }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                {(!referrals.length || !referrals.filter(r => tab === 0 || r.stage === STAGE_ORDER[tab - 1]).length) && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      No referrals in this stage.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* COMMISSIONS TABLE */}
      {tab === 1 && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Referral</TableCell>
                  <TableCell>Referrer</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Base</TableCell>
                  <TableCell align="right">Tier Bonus</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.lead_name}</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{c.lead_company}</Typography>
                    </TableCell>
                    <TableCell>{c.referrer_name}</TableCell>
                    <TableCell><Chip size="small" label={REFERRER_TYPE_LABEL[c.referrer_type] || c.referrer_type} variant="outlined" /></TableCell>
                    <TableCell align="right" className="figure">{formatINR(c.base_amount)}</TableCell>
                    <TableCell align="right" className="figure">{formatINR(c.tier_bonus)}</TableCell>
                    <TableCell align="right" className="figure" sx={{ fontWeight: 600 }}>{formatINR(c.total_amount)}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={c.status} color={COMMISSION_COLOR[c.status]} />
                    </TableCell>
                    <TableCell align="right">
                      {c.status === 'pending' && (
                        <MobileButton size="small" variant="contained" onClick={() => approveCommission(c.id)}>Approve</MobileButton>
                      )}
                      {c.status === 'approved' && (
                        <MobileButton size="small" variant="outlined" onClick={() => payCommission(c.id)}>Mark Paid</MobileButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* CREATE REFERRAL DIALOG */}
      <MobileDialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Referral</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 1 }}>
            <MobileTextField
              fullWidth select label="Referrer Type" value={createForm.referrer_type}
              onChange={(e) => setCreateForm({ ...createForm, referrer_type: e.target.value })}
              options={Object.entries(REFERRER_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
            />
            <MobileTextField fullWidth label="Referrer Name" value={createForm.referrer_name} onChange={(e) => setCreateForm({ ...createForm, referrer_name: e.target.value })} />
            <MobileTextField fullWidth label="Referrer Email" value={createForm.referrer_email} onChange={(e) => setCreateForm({ ...createForm, referrer_email: e.target.value })} />
            <MobileTextField fullWidth label="Lead Name" value={createForm.lead_name} onChange={(e) => setCreateForm({ ...createForm, lead_name: e.target.value })} required />
            <MobileTextField fullWidth label="Lead Company" value={createForm.lead_company} onChange={(e) => setCreateForm({ ...createForm, lead_company: e.target.value })} />
            <MobileTextField fullWidth label="Lead Email" value={createForm.lead_email} onChange={(e) => setCreateForm({ ...createForm, lead_email: e.target.value })} />
            <MobileTextField fullWidth label="Lead Phone" value={createForm.lead_phone} onChange={(e) => setCreateForm({ ...createForm, lead_phone: e.target.value })} />
            <MobileTextField
              fullWidth select label="Lead Source" value={createForm.lead_source}
              onChange={(e) => setCreateForm({ ...createForm, lead_source: e.target.value })}
              options={['referral', 'partner', 'event', 'webinar', 'other'].map(v => ({ value: v, label: v }))}
            />
            <MobileTextField fullWidth type="number" label="Estimated Value (₹)" value={createForm.estimated_value} onChange={(e) => setCreateForm({ ...createForm, estimated_value: e.target.value })} required />
            <MobileTextField fullWidth multiline rows={3} label="Notes" value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
          </MobileFormGrid>
          {createError && <Alert severity="error" sx={{ mt: 1 }}>{createError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setCreateOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleCreate} disabled={createSaving}>
            {createSaving ? 'Creating…' : 'Create Referral'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* STAGE CHANGE DIALOG */}
      <MobileDialog open={!!stageChangeReferral} onClose={() => setStageChangeReferral(null)} maxWidth="md" fullWidth>
        <DialogTitle>Change Stage: {stageChangeReferral?.lead_name}</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 1 }}>
            <MobileTextField
              fullWidth select label="New Stage" value={stageChangeStage}
              onChange={(e) => setStageChangeStage(e.target.value)}
              options={Object.entries(STAGE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
            />
          </MobileFormGrid>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setStageChangeReferral(null)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={() => { updateStage(stageChangeReferral.id, stageChangeStage); setStageChangeReferral(null); }}>
            Update
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}