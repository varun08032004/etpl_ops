import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Alert, Chip } from '@mui/material';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function MarketingCouponPerformance() {
  const isMobile = useMobile();
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
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Coupon Performance</Typography>
      </MobilePageHeader>
      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5, mb: 2 }}>
        Real revenue attributed to each coupon code — pulled straight from ethertrack.in checkouts,
        not just a redemption count.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <MobilePaper variant="outlined">
        <ResponsiveTableContainer>
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
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{c.couponCode}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{c.discountType === 'percent' ? `${c.discountValue}% off` : `₹${c.discountValue} off`}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{c.redemptionCount}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{fmtINR(c.totalDiscountINR)}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600 }}>{fmtINR(c.totalRevenueINR)}</TableCell>
                  <TableCell align="right" className="figure" sx={{ color: 'text.secondary', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{fmtINR(c.grossValueINR)}</TableCell>
                  <TableCell>
                    {Object.entries(c.byPlan).map(([plan, count]) => (
                      <Chip key={plan} size="small" label={`${plan}: ${count}`} sx={{ mr: 0.5, mb: 0.5, textTransform: 'capitalize' }} />
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      {data && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1.5 }}>
          {data.totalRedemptions} total redemption{data.totalRedemptions !== 1 ? 's' : ''} in the last {data.windowDays} days.
        </Typography>
      )}
    </Box>
  );
}