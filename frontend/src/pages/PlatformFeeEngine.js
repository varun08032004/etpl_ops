import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  Tabs, Tab, Grid, IconButton, Divider, Tooltip, LinearProgress, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
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

const FEE_TYPE_LABEL = {
  percentage: 'Percentage',
  flat: 'Flat Fee',
  tiered: 'Tiered',
  volume_discount: 'Volume Discount',
  coupon: 'Coupon',
  mixed: 'Mixed (Pct + Flat)',
};

const FEE_TYPE_COLOR = {
  percentage: 'primary',
  flat: 'info',
  tiered: 'secondary',
  volume_discount: 'warning',
  coupon: 'success',
  mixed: 'default',
};

const APPLY_TO_LABEL = {
  seller: 'Seller',
  buyer: 'Buyer',
  both: 'Both',
};

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function PlatformFeeEngine() {
  const isMobile = useMobile();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [selectedRule, setSelectedRule] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', plan_id: '',
    fee_type: 'percentage', calculation_base: 'gross', apply_to: 'seller',
    percentage_rate: '', flat_amount: '', flat_currency: 'INR',
    tiers: [], volume_thresholds: [],
    coupon_code: '', coupon_type: 'percentage', coupon_value: '', coupon_max_uses: '',
    coupon_valid_from: '', coupon_valid_to: '',
    min_transaction_amount: '', max_transaction_amount: '',
    applicable_categories: [], excluded_categories: [],
    priority: 0, is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calcForm, setCalcForm] = useState({
    amount: '', plan_id: '', category_id: '', coupon_code: '',
    seller_id: '', buyer_id: '',
  });
  const [calcResult, setCalcResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/fee-rules/rules');
      setRules(res.data.rules);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load fee rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        percentage_rate: form.percentage_rate ? parseFloat(form.percentage_rate) : null,
        flat_amount: form.flat_amount ? parseFloat(form.flat_amount) : null,
        coupon_value: form.coupon_value ? parseFloat(form.coupon_value) : null,
        coupon_max_uses: form.coupon_max_uses ? parseInt(form.coupon_max_uses) : null,
        min_transaction_amount: form.min_transaction_amount ? parseInt(form.min_transaction_amount) : null,
        max_transaction_amount: form.max_transaction_amount ? parseInt(form.max_transaction_amount) : null,
        priority: form.priority ? parseInt(form.priority) : 0,
        tiers: form.tiers,
        volume_thresholds: form.volume_thresholds,
        applicable_categories: form.applicable_categories,
        excluded_categories: form.excluded_categories,
      };
      if (editOpen) {
        await client.patch(`/fee-rules/rules/${selectedRule.id}`, payload);
      } else {
        await client.post('/fee-rules/rules', payload);
      }
      setCreateOpen(false);
      setEditOpen(false);
      setForm(initialForm());
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm('Delete this fee rule?')) return;
    try {
      await client.delete(`/fee-rules/rules/${ruleId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete rule');
    }
  };

  const runCalculator = async () => {
    setCalculating(true);
    try {
      const res = await client.post('/fee-rules/calculate', calcForm);
      setCalcResult(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to calculate');
    } finally {
      setCalculating(false);
    }
  };

  const openEdit = (rule) => {
    setSelectedRule(rule);
    setForm({
      name: rule.name, description: rule.description, plan_id: rule.plan_id || '',
      fee_type: rule.fee_type, calculation_base: rule.calculation_base, apply_to: rule.apply_to,
      percentage_rate: rule.percentage_rate || '', flat_amount: rule.flat_amount ? (rule.flat_amount / 100).toFixed(2) : '',
      flat_currency: rule.flat_currency, tiers: rule.tiers || [], volume_thresholds: rule.volume_thresholds || [],
      coupon_code: rule.coupon_code || '', coupon_type: rule.coupon_type || 'percentage',
      coupon_value: rule.coupon_value ? (rule.coupon_value / 100).toFixed(2) : '',
      coupon_max_uses: rule.coupon_max_uses || '', coupon_valid_from: rule.coupon_valid_from?.slice(0, 10) || '',
      coupon_valid_to: rule.coupon_valid_to?.slice(0, 10) || '',
      min_transaction_amount: rule.min_transaction_amount ? (rule.min_transaction_amount / 100).toFixed(2) : '',
      max_transaction_amount: rule.max_transaction_amount ? (rule.max_transaction_amount / 100).toFixed(2) : '',
      applicable_categories: rule.applicable_categories || [], excluded_categories: rule.excluded_categories || [],
      priority: rule.priority || 0, is_active: rule.is_active,
    });
    setEditOpen(true);
    setSelectedRule(rule);
  };

  const openDetail = (rule) => {
    setSelectedRule(rule);
    setDetailOpen(true);
  };

  const initialForm = () => ({
    name: '', description: '', plan_id: '',
    fee_type: 'percentage', calculation_base: 'gross', apply_to: 'seller',
    percentage_rate: '', flat_amount: '', flat_currency: 'INR',
    tiers: [], volume_thresholds: [],
    coupon_code: '', coupon_type: 'percentage', coupon_value: '', coupon_max_uses: '',
    coupon_valid_from: '', coupon_valid_to: '',
    min_transaction_amount: '', max_transaction_amount: '',
    applicable_categories: [], excluded_categories: [],
    priority: 0, is_active: true,
  });

  if (loading) return <MobileStack gap={2}><Typography>Loading fee rules…</Typography></MobileStack>;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Platform Fee/Commission Engine</Typography>
        <MobileButton variant="contained" onClick={() => { setForm(initialForm()); setCreateOpen(true); setEditOpen(false); }} startIcon={<AddIcon />}>New Fee Rule</MobileButton>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Calculator */}
      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>Fee Calculator</Typography>
        <MobileFormGrid sx={{ mb: 2 }}>
          <MobileTextField fullWidth type="number" label="Transaction Amount (₹)" value={calcForm.amount} onChange={(e) => setCalcForm({ ...calcForm, amount: e.target.value })} required />
          <MobileTextField fullWidth label="Plan ID (optional)" value={calcForm.plan_id} onChange={(e) => setCalcForm({ ...calcForm, plan_id: e.target.value })} />
          <MobileTextField fullWidth label="Category ID (optional)" value={calcForm.category_id} onChange={(e) => setCalcForm({ ...calcForm, category_id: e.target.value })} />
          <MobileTextField fullWidth label="Coupon Code (optional)" value={calcForm.coupon_code} onChange={(e) => setCalcForm({ ...calcForm, coupon_code: e.target.value })} />
        </MobileFormGrid>
        <MobileStack direction="row" gap={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <MobileButton variant="contained" onClick={runCalculator} startIcon={<VisibilityIcon />} disabled={calculating}>
            {calculating ? 'Calculating…' : 'Calculate Fees'}
          </MobileButton>
          {calcResult && (
            <MobileButton variant="outlined" onClick={() => setCalcResult(null)}>Clear</MobileButton>
          )}
        </MobileStack>
        {calcResult && (
          <MobilePaper sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Seller Fees</Typography>
                <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'error.main' }}>
                  {formatINR(calcResult.total_seller_fee)}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Net Payout: {formatINR(calcResult.net_seller_payout)}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Buyer Fees</Typography>
                <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'info.main' }}>
                  {formatINR(calcResult.total_buyer_fee)}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Total: {formatINR(calcResult.net_buyer_total)}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>Applied Rules</Typography>
                {calcResult.seller_fees.map((f, i) => (
                  <Chip key={i} label={`${f.rule_name}: ${formatINR(f.amount)} (${f.fee_type})`} size="small" color={FEE_TYPE_COLOR[f.fee_type] || 'default'} variant="outlined" sx={{ mr: 1, mb: 1 }} />
                )}
                {calcResult.buyer_fees.map((f, i) => (
                  <Chip key={`b-${i}`} label={`${f.rule_name}: ${formatINR(f.amount)} (${f.fee_type})`} size="small" color={FEE_TYPE_COLOR[f.fee_type] || 'default'} variant="outlined" sx={{ mr: 1, mb: 1 }} />
                )}
                {calcResult.coupon_applied && (
                  <Chip label={`Coupon: ${calcResult.coupon_applied.code} (-${formatINR(calcResult.coupon_applied.discount)})`} color="success" variant="outlined" sx={{ mr: 1, mb: 1 }} />
                )}
              </Grid>
            </Grid>
          </MobilePaper>
        )}
      </MobilePaper>

      {/* Rules Table */}
      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rule Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Apply To</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id} hover onClick={() => openDetail(r)}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{r.description || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={FEE_TYPE_LABEL[r.fee_type] || r.fee_type} color={FEE_TYPE_COLOR[r.fee_type] || 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell><Chip size="small" label={APPLY_TO_LABEL[r.apply_to] || r.apply_to} variant="outlined" /></TableCell>
                  <TableCell className="figure">{r.plan_id || 'Global'}</TableCell>
                  <TableCell className="figure">{r.priority}</TableCell>
                  <TableCell>
                    <FormControlLabel
                      control={<Switch checked={r.is_active} onChange={() => {}} disabled />}
                      label={r.is_active ? 'Active' : 'Inactive'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(r); }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!rules.length && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No fee rules configured. Click "New Fee Rule" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      {/* Detail Dialog */}
      <MobileDialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{selectedRule?.name}</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 1 }}>
            <MobileTextField fullWidth label="Type" value={FEE_TYPE_LABEL[selectedRule?.fee_type]} disabled />
            <MobileTextField fullWidth label="Apply To" value={APPLY_TO_LABEL[selectedRule?.apply_to]} disabled />
            <MobileTextField fullWidth label="Plan" value={selectedRule?.plan_id || 'Global'} disabled />
            <MobileTextField fullWidth label="Priority" value={selectedRule?.priority} disabled />
            <MobileTextField fullWidth label="Percentage Rate" value={selectedRule?.percentage_rate ? `${selectedRule.percentage_rate}%` : '—'} disabled />
            <MobileTextField fullWidth label="Flat Amount" value={selectedRule?.flat_amount ? formatINR(selectedRule.flat_amount / 100) : '—'} disabled />
            <MobileTextField fullWidth label="Calculation Base" value={selectedRule?.calculation_base} disabled />
            <MobileTextField fullWidth label="Coupon Code" value={selectedRule?.coupon_code || '—'} disabled />
            <MobileTextField fullWidth label="Min Amount" value={selectedRule?.min_transaction_amount ? formatINR(selectedRule.min_transaction_amount / 100) : '—'} disabled />
            <MobileTextField fullWidth label="Max Amount" value={selectedRule?.max_transaction_amount ? formatINR(selectedRule.max_transaction_amount / 100) : '—'} disabled />
          </MobileFormGrid>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setDetailOpen(false)}>Close</MobileButton>
          <MobileButton variant="outlined" onClick={() => { openEdit(selectedRule); setDetailOpen(false); }}>Edit</MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* Create/Edit Dialog */}
      <MobileDialog open={createOpen || editOpen} onClose={() => { setCreateOpen(false); setEditOpen(false); }} maxWidth="xl" fullWidth>
        <DialogTitle>{editOpen ? 'Edit' : 'Create'} Fee Rule</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 1 }}>
            <MobileTextField fullWidth label="Rule Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <MobileTextField fullWidth multiline rows={2} label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <MobileTextField fullWidth label="Plan ID (optional)" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })} />
            <MobileTextField
              fullWidth select label="Fee Type" value={form.fee_type}
              onChange={(e) => setForm({ ...form, fee_type: e.target.value })}
              options={Object.entries(FEE_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
            />
            <MobileTextField
              fullWidth select label="Apply To" value={form.apply_to}
              onChange={(e) => setForm({ ...form, apply_to: e.target.value })}
              options={Object.entries(APPLY_TO_LABEL).map(([k, v]) => ({ value: k, label: v }))}
            />
            <MobileTextField
              fullWidth select label="Calculation Base" value={form.calculation_base}
              onChange={(e) => setForm({ ...form, calculation_base: e.target.value })}
              options={['gross', 'net', 'subtotal'].map(v => ({ value: v, label: v }))}
            />
            <MobileTextField fullWidth type="number" label="Percentage Rate (%)" value={form.percentage_rate} onChange={(e) => setForm({ ...form, percentage_rate: e.target.value })} />
            <MobileTextField fullWidth type="number" label="Flat Amount (₹)" value={form.flat_amount} onChange={(e) => setForm({ ...form, flat_amount: e.target.value })} />
            <MobileTextField fullWidth label="Currency" value={form.flat_currency} onChange={(e) => setForm({ ...form, flat_currency: e.target.value })} />
            <MobileTextField fullWidth type="number" label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            <FormControlLabel control={<Switch checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />} label="Active" />
          </MobileFormGrid>
          {formError && <Alert severity="error" sx={{ mt: 1 }}>{formError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => { setCreateOpen(false); setEditOpen(false); setForm(initialForm()); }}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : (editOpen ? 'Update' : 'Create')}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}

const FEE_TYPE_LABEL = { percentage: 'Percentage', flat: 'Flat Fee', tiered: 'Tiered', volume_discount: 'Volume Discount', coupon: 'Coupon', mixed: 'Mixed (Pct + Flat)' };
const FEE_TYPE_COLOR = { percentage: 'primary', flat: 'info', tiered: 'secondary', volume_discount: 'warning', coupon: 'success', mixed: 'default' };
const APPLY_TO_LABEL = { seller: 'Seller', buyer: 'Buyer', both: 'Both' };

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}