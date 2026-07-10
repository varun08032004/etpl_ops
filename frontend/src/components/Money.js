import { Box } from '@mui/material';

export default function Money({ amount, size = 'inherit', color, negativeIsRed = true }) {
  const n = Number(amount || 0);
  const formatted = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
  const resolvedColor = color || (negativeIsRed && n < 0 ? 'error.main' : 'inherit');
  return (
    <Box component="span" className="figure" sx={{ fontSize: size, color: resolvedColor }}>
      {formatted}
    </Box>
  );
}
