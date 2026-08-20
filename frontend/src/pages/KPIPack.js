import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  Tabs, Tab, Grid, IconButton, Divider, Tooltip, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
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

const TREND_COLOR = { up: 'success', down: 'error', flat: 'default' };

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1e7) return `${(num / 1e7).toFixed(1)}Cr`;
  if (num >= 1e5) return `${(num / 1e5).toFixed(1)}L`;
  return num.toLocaleString('en-IN');
}

export default function KPIPack() {
  const isMobile = useMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/kpi-pack');
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load KPI pack');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const downloadPDF = async () => {
    setGeneratingPDF(true);
    try {
      const res = await client.get('/kpi-pack/pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `kpi-pack-${data?.period || new Date().toISOString().slice(0,7)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (loading) return <MobileStack gap={2}><Typography>Loading KPI pack…</Typography></MobileStack>;
  if (error) return <Alert severity="error">{error}</Alert>;

  const { kpis, mrr, churn, expansion, headcount, burn, cash, pipeline, period, generatedAt } = data;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Board KPI Pack</Typography>
        <MobileButton variant="outlined" onClick={load} startIcon={<RefreshIcon />}>Refresh</MobileButton>
        <MobileButton variant="contained" onClick={downloadPDF} startIcon={<DownloadIcon />} disabled={generatingPDF}>
          {generatingPDF ? 'Generating PDF…' : 'Download PDF'}
        </MobileButton>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 3 }}>
        Period: {period} • Generated: {new Date(generatedAt).toLocaleString('en-IN')}
      </Typography>

      {/* Revenue Section */}
      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>Revenue Metrics</Typography>
        <MobileCardGrid>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>MRR</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatINR(kpis.mrr)}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: kpis.netNewMRR >= 0 ? 'success.main' : 'error.main' }}>
              Net New: {kpis.netNewMRR >= 0 ? '+' : ''}{formatINR(kpis.netNewMRR)}
            </Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>ARR</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatINR(kpis.arr)}</Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>NRR</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: kpis.nrr >= 100 ? 'success.main' : 'error.main' }}>
              {kpis.nrr}%
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>GRR: {kpis.grr}%</Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Net New MRR</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: kpis.netNewMRR >= 0 ? 'success.main' : 'error.main' }}>
              {kpis.netNewMRR >= 0 ? '+' : ''}{formatINR(kpis.netNewMRR)}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Expansion: {formatINR(expansion?.expansionMrr)} • Churn: {formatINR(expansion?.churnedMrr)}</Typography>
          </MobilePaper>
        </MobileCardGrid>
      </MobilePaper>

      {/* Unit Economics */}
      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>Unit Economics</Typography>
        <MobileCardGrid>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>LTV</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatINR(kpis.ltv)}</Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>CAC</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatINR(kpis.cac)}</Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>LTV:CAC</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: kpis.ltvToCac >= 3 ? 'success.main' : 'warning.main' }}>
              {kpis.ltvToCac}x
            </Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Payback</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{kpis.paybackMonths} mo</Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Monthly Churn</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: kpis.avgMonthlyChurn <= 3 ? 'success.main' : 'error.main' }}>
              {kpis.avgMonthlyChurn}%
            </Typography>
          </MobilePaper>
        </MobileCardGrid>
      </MobilePaper>

      {/* Efficiency & Cash */}
      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>Efficiency & Cash</Typography>
        <MobileCardGrid>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Monthly Burn</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatINR(kpis.monthlyBurn)}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Net: {formatINR(kpis.netBurn)}</Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Runway</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: kpis.runwayMonths > 12 ? 'success.main' : kpis.runwayMonths > 6 ? 'warning.main' : 'error.main' }}>
              {kpis.runwayMonths} months
            </Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total Cash</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatINR(kpis.totalCash)}</Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Burn Multiple</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: kpis.burnMultiple <= 1.5 ? 'success.main' : 'warning.main' }}>
              {kpis.burnMultiple}x
            </Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Rev/Employee</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatINR(kpis.revPerEmployee)}</Typography>
          </MobilePaper>
        </MobileCardGrid>
      </MobilePaper>

      {/* Headcount */}
      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>Headcount</Typography>
        <MobileCardGrid>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{kpis.totalHeadcount}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Net +{kpis.netHired12m} (12m)</Typography>
          </MobilePaper>
          {Object.entries(kpis.headcountByDept || {}).map(([dept, count]) => (
            <MobilePaper key={dept}>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>{dept.charAt(0).toUpperCase() + dept.slice(1)}</Typography>
              <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{count}</Typography>
            </MobilePaper>
          ))}
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Attrition</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700, color: kpis.attritionRate <= 15 ? 'success.main' : 'error.main' }}>
              {kpis.attritionRate}%
            </Typography>
          </MobilePaper>
        </MobileCardGrid>
      </MobilePaper>

      {/* Pipeline */}
      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>Sales Pipeline</Typography>
        <MobileCardGrid>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Open Deals</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{kpis.openDeals}</Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Pipeline Value</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatINR(kpis.pipelineValue)}</Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Won This Month</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{pipeline?.won_this_month || 0}</Typography>
          </MobilePaper>
          <MobilePaper>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Revenue This Month</Typography>
            <Typography className="figure" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatINR(pipeline?.revenue_this_month)}</Typography>
          </MobilePaper>
        </MobileCardGrid>
      </MobilePaper>

      {/* Churn Cohorts Summary */}
      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>Recent Churn Cohorts</Typography>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Cohort</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="center">Retention</TableCell>
                <TableCell align="center">NRR</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {churn?.slice(-6).map((c) => (
                <TableRow key={c.cohortMonth}>
                  <TableCell><Typography sx={{ fontWeight: 600 }}>{c.cohortMonth}</Typography></TableCell>
                  <TableCell className="figure">{c.started}</TableCell>
                  <TableCell className="figure">{c.active}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={`${c.retentionRate}%`} color={c.retentionRate >= 80 ? 'success' : c.retentionRate >= 60 ? 'warning' : 'error'} variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={`${c.netRevenueRetention}%`} color={c.netRevenueRetention >= 100 ? 'success' : 'error'} variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      {/* Action Items */}
      <MobilePaper>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>Key Action Items</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {generateActionItems(kpis).map((item, i) => (
            <MobilePaper key={i} sx={{ px: 2, py: 1.5, borderLeft: '4px solid', borderColor: 'primary.main' }}>
              <Typography sx={{ fontSize: '0.85rem' }}>{item}</Typography>
            </MobilePaper>
          ))}
        </Box>
      </MobilePaper>
    </Box>
  );
}

function generateActionItems(kpis) {
  const items = [];
  if (kpis.nrr < 100) items.push(`NRR at ${kpis.nrr}% — Prioritize expansion & reduce churn`);
  if (kpis.runwayMonths < 12) items.push(`Runway only ${kpis.runwayMonths} months — Extend runway or raise capital`);
  if (kpis.avgMonthlyChurn > 3) items.push(`Monthly churn ${kpis.avgMonthlyChurn}% — Launch retention program`);
  if (kpis.ltvToCac && kpis.ltvToCac < 3) items.push(`LTV:CAC ${kpis.ltvToCac}x — Optimize acquisition or increase LTV`);
  if (kpis.attritionRate > 15) items.push(`Attrition ${kpis.attritionRate}% — Review compensation & culture`);
  if (items.length === 0) items.push('All metrics healthy — Continue execution');
  return items;
}