import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Button, Alert,
} from '@mui/material';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileStack,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const PLANS  = ['starter', 'growth'];
const CYCLES = ['monthly', 'annual'];
const PLAN_LABEL = { starter: 'Starter', growth: 'Growth' };

export default function ProductPricing() {
  const isMobile = useMobile();
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saveMsg, setSaveMsg] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    client.get('/product/pricing')
      .then(({ data }) => setOverrides(data.overrides || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load pricing'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const overrideFor = (plan, cycle) =>
    overrides.find((o) => o.plan === plan && o.cycle === cycle);

  const handleSave = async (plan, cycle) => {
    const key = `${plan}:${cycle}`;
    const val = drafts[key];
    if (val == null || val === '' || isNaN(val) || Number(val) < 0) return;
    setSaving(key);
    setSaveMsg('');
    try {
      await client.patch(`/product/pricing/${plan}/${cycle}`, { priceINR: Number(val) });
      setSaveMsg(`${PLAN_LABEL[plan]} (${cycle}) price updated to ₹${val}. Live on the platform within 60 seconds.`);
      setDrafts((d) => ({ ...d, [key]: '' }));
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update price');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Pricing</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5, mb: 2 }}>
          Starter and Growth self-serve prices, pushed live to ethertrack.in. Corporate is never priced
          here — it's always a per-deal negotiation, set up via Corporate Deals.
        </Typography>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saveMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveMsg('')}>{saveMsg}</Alert>}

      <MobilePaper variant="outlined">
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Plan</TableCell>
                <TableCell>Cycle</TableCell>
                <TableCell>Current price (live)</TableCell>
                <TableCell>Last updated</TableCell>
                <TableCell>New price (₹)</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>Loading…</TableCell></TableRow>
              )}
              {!loading && PLANS.flatMap((plan) => CYCLES.map((cycle) => {
                const key = `${plan}:${cycle}`;
                const existing = overrides.find((o) => o.plan === plan && o.cycle === cycle);
                return (
                  <TableRow key={key} hover>
                    <TableCell sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{PLAN_LABEL[plan]}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{cycle}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
                      {existing ? `₹${(existing.price_paise / 100).toLocaleString('en-IN')}` : 'Platform default (not overridden yet)'}
                    </TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>
                      {existing ? `${new Date(existing.updated_at).toLocaleDateString('en-IN')} by ${existing.updated_by || '—'}` : '—'}
                    </TableCell>
                    <TableCell>
                      <MobileTextField
                        size="small"
                        type="number"
                        placeholder="e.g. 1000"
                        value={drafts[key] || ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <MobileButton
                        size="small"
                        variant="outlined"
                        disabled={saving === key || !drafts[key]}
                        onClick={() => handleSave(plan, cycle)}
                      >
                        {saving === key ? 'Saving…' : 'Update'}
                      </MobileButton>
                    </TableCell>
                  </TableRow>
                );
              }))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saveMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveMsg('')}>{saveMsg}</Alert>}
    </Box>
  );
}