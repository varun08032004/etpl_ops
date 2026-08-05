import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Alert, Chip } from '@mui/material';
import client from '../api/client';

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function MarketingCouponPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    client.get('/marketing/coupon-performance')
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load coupon performance'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5">Coupon Performance</Typography>
      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5, mb: 2 }}>
        Real revenue attributed to each coupon code — pulled straight from ethertrack.in checkouts,
        not just a redemption count.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Coupon</TableCell>
              <TableCell>Discount</TableCell>
              <TableCell align="right">Redemptions</TableCell>
              <TableCell align="right">Discount Given</TableCell>
              <TableCell align="right">Revenue Collected</TableCell>
              <TableCell align="right">Gross Value (no discount)</TableCell>
              <TableCell>Plans Used On</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>Loading…</TableCell></TableRow>
            )}
            {!loading && !data?.coupons?.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No redemptions in this window</TableCell></TableRow>
            )}
            {data?.coupons?.map((c) => (
              <TableRow key={c.couponCode} hover>
                <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.couponCode}</TableCell>
                <TableCell>{c.discountType === 'percent' ? `${c.discountValue}% off` : `₹${c.discountValue} off`}</TableCell>
                <TableCell align="right" className="figure">{c.redemptionCount}</TableCell>
                <TableCell align="right" className="figure">{fmtINR(c.totalDiscountINR)}</TableCell>
                <TableCell align="right" className="figure" style={{ fontWeight: 600 }}>{fmtINR(c.totalRevenueINR)}</TableCell>
                <TableCell align="right" className="figure" sx={{ color: 'text.secondary' }}>{fmtINR(c.grossValueINR)}</TableCell>
                <TableCell>
                  {Object.entries(c.byPlan).map(([plan, count]) => (
                    <Chip key={plan} size="small" label={`${plan}: ${count}`} sx={{ mr: 0.5, mb: 0.5, textTransform: 'capitalize' }} />
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {data && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1.5 }}>
          {data.totalRedemptions} total redemption{data.totalRedemptions !== 1 ? 's' : ''} in the last {data.windowDays} days.
        </Typography>
      )}
    </Box>
  );
}