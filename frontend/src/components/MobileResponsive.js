import { useMediaQuery, useTheme } from '@mui/material';
import { Box, Paper, TableContainer, Dialog, styled, Typography, IconButton, Chip, Avatar, FormControl, InputLabel, Select, Button, TextField, MenuItem, List } from '@mui/material';

export function useMobile() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

export function useTablet() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.between('sm', 'md'));
}

export function useDesktop() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.up('md'));
}

export function useBreakpoint() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}

export const MobilePaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5),
  margin: theme.spacing(0.5, 0),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(2),
    margin: theme.spacing(1, 0),
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(2.5),
    margin: theme.spacing(0),
  },
}));

export const MobileCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5),
  margin: theme.spacing(0.5, 0),
  borderRadius: theme.shape.borderRadius,
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(2),
    margin: theme.spacing(1, 0),
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(2.5),
    margin: theme.spacing(0),
  },
}));

export const ResponsiveTableContainer = styled(TableContainer)(({ theme }) => ({
  overflowX: 'auto',
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  margin: theme.spacing(-1.5, -1.5, -1.5, -1.5),
  padding: theme.spacing(1.5, 0, 1.5, 0),
  [theme.breakpoints.up('sm')]: {
    margin: theme.spacing(-2, -2, -2, -2),
    padding: theme.spacing(2, 0, 2, 0),
  },
  [theme.breakpoints.up('md')]: {
    margin: 0,
    padding: 0,
    overflowX: 'visible',
  },
}));

export const MobileTableCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    display: 'none',
  },
}));

export const MobileTableCardItem = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
}));

export const MobileDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    margin: theme.spacing(1),
    maxWidth: 'calc(100vw - 16px)',
    width: 'calc(100vw - 16px)',
    maxHeight: 'calc(100vh - 16px)',
    boxSizing: 'border-box',
    [theme.breakpoints.up('sm')]: {
      margin: theme.spacing(2),
      maxWidth: 'calc(100vw - 32px)',
      width: 'auto',
      maxHeight: 'calc(100vh - 64px)',
    },
    [theme.breakpoints.up('md')]: {
      margin: 'auto',
      maxWidth: '600px',
      width: 'auto',
      maxHeight: 'auto',
    },
  },
}));

export const MobileFullScreenDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    margin: 0,
    maxWidth: '100vw',
    width: '100vw',
    maxHeight: '100vh',
    height: '100vh',
    borderRadius: 0,
    boxSizing: 'border-box',
    [theme.breakpoints.up('sm')]: {
      margin: theme.spacing(2),
      maxWidth: 'calc(100vw - 32px)',
      width: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 64px)',
      height: 'auto',
      borderRadius: theme.shape.borderRadius,
    },
    [theme.breakpoints.up('md')]: {
      margin: 'auto',
      maxWidth: '800px',
      width: 'auto',
      maxHeight: '90vh',
      height: 'auto',
    },
  },
}));

export const MobileGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(1.5),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(2),
  },
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(2.5),
  },
}));

export const MobileTwoColumnGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(1.5),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(2),
  },
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(2.5),
  },
}));

export const MobileThreeColumnGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(1.5),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(2),
  },
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing(2.5),
  },
}));

export const MobileStack = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    '& > *': { flex: '1 1 200px', minWidth: 0, maxWidth: '100%' },
  },
  [theme.breakpoints.up('md')]: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(2.5),
    '& > *': { flex: '1 1 250px', minWidth: 0, maxWidth: '100%' },
  },
}));

export const MobileCardGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(1),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(1.5),
  },
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(2),
  },
}));

export const MobileFormGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(1.5),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(2),
  },
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing(2),
  },
}));

export const MobileActionButtons = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column-reverse',
  gap: theme.spacing(1),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: 'auto',
    '& > *': { minWidth: 80, flexShrink: 0 },
  },
}));

export const MobileToolbar = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5),
  },
}));

export const MobilePageHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(2),
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  flexWrap: 'wrap',
  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(3),
    flexWrap: 'wrap',
  },
}));

export const MobileChartContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  overflowX: 'auto',
  [theme.breakpoints.up('sm')]: {
    overflowX: 'visible',
  },
}));

export const MobileList = styled(List)(({ theme }) => ({
  [theme.breakpoints.up('md')]: {
    display: 'none',
  },
}));

export const MobileOnly = styled(Box)(({ theme }) => ({
  [theme.breakpoints.up('sm')]: {
    display: 'none',
  },
}));

export const DesktopOnly = styled(Box)(({ theme }) => ({
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

export const TabletAndUp = styled(Box)(({ theme }) => ({
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

export function MobileListItem({ primary, secondary, action, icon, onClick, ...props }) {
  const isMobile = useMobile();
  const theme = useTheme();

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1.5),
        p: isMobile ? 1.5 : 1,
        borderBottom: 1,
        borderColor: 'divider',
        cursor: onClick ? 'pointer' : 'default',
        ...props,
      }}
    >
      {icon && <Box sx={{ color: 'text.secondary', minWidth: 40 }}>{icon}</Box>}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant={isMobile ? 'body2' : 'body1'} noWrap {...props}>{primary}</Typography>
        {secondary && <Typography variant="caption" color="text.secondary" noWrap>{secondary}</Typography>}
      </Box>
      {action}
    </Box>
  );
}

export function MobileStatCard({ label, value, hint, trend, icon, color = 'text.primary', onClick }) {
  const isMobile = useMobile();

  return (
    <MobilePaper onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default' }}>
      {icon && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Box sx={{ color: color, fontSize: isMobile ? 20 : 24 }}>{icon}</Box>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </Typography>
        </Box>
      )}
      {!icon && (
        <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </Typography>
      )}
      <Typography className="figure" sx={{ fontSize: isMobile ? '1.25rem' : '1.6rem', fontWeight: 600, mt: 0.5, color }}>
        {value}
      </Typography>
      {hint && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', mt: 0.5 }}>{hint}</Typography>}
      {trend && (
        <Chip
          size="small"
          label={trend.label}
          color={trend.color}
          icon={trend.icon}
          sx={{ mt: 1, fontSize: isMobile ? '0.6rem' : '0.7rem', height: isMobile ? 22 : 24 }}
        />
      )}
    </MobilePaper>
  );
}

export function MobileDataCard({ title, subtitle, children, action, avatar, variant = 'default' }) {
  const isMobile = useMobile();
  const theme = useTheme();

  const variants = {
    default: {},
    elevated: { boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
    outlined: { border: `1px solid ${theme.palette.divider}` },
  };

  return (
    <MobilePaper sx={variants[variant]}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1, minWidth: 0 }}>
          {avatar && (
            <Avatar sx={{ width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, fontSize: isMobile ? '0.875rem' : '1rem', flexShrink: 0 }}>
              {avatar}
            </Avatar>
          )}
          <Box sx={{ minWidth: 0 }}>
            {title && <Typography variant={isMobile ? 'h6' : 'h5'} noWrap sx={{ fontWeight: 600 }}>{title}</Typography>}
            {subtitle && <Typography variant="body2" color="text.secondary" noWrap>{subtitle}</Typography>}
          </Box>
        </Box>
        {action}
      </Box>
      {children}
    </MobilePaper>
  );
}

export function MobileTableRow({ cells, onClick, selected, keyField }) {
  const isMobile = useMobile();
  const theme = useTheme();

  if (!isMobile) return null;

  return (
    <MobileTableCardItem onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default', backgroundColor: selected ? 'rgba(47,191,113,0.08)' : 'transparent' }}>
      {cells.map((cell, index) => (
        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: index < cells.length - 1 ? `1px solid ${theme.palette.divider}` : 'none' }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6rem' }}>
            {cell.label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: cell.bold ? 600 : 400, textAlign: 'right', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cell.value}
          </Typography>
        </Box>
      ))}
    </MobileTableCardItem>
  );
}

export function MobileSelectField({ label, value, onChange, options, placeholder, fullWidth = true, ...props }) {
  const isMobile = useMobile();
  const theme = useTheme();

  return (
    <FormControl fullWidth={fullWidth} sx={{ minWidth: 0 }}>
      <InputLabel sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{label}</InputLabel>
      <Select
        value={value}
        onChange={onChange}
        label={label}
        sx={{
          '& .MuiSelect-select': {
            padding: theme.spacing(1, 1.5),
            fontSize: isMobile ? '0.875rem' : '0.875rem',
            minHeight: isMobile ? 44 : 'auto',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.divider,
          },
        }}
        {...props}
      >
        {placeholder && <MenuItem value="" disabled>{placeholder}</MenuItem>}
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: isMobile ? '0.875rem' : '0.875rem', minHeight: isMobile ? 44 : 'auto' }}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function MobileTextField({ label, type = 'text', value, onChange, placeholder, fullWidth = true, multiline, rows = 2, select, options, ...props }) {
  const isMobile = useMobile();
  const theme = useTheme();

  if (select && options) {
    return (
      <TextField
        fullWidth={fullWidth}
        label={label}
        select
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        size="small"
        sx={{
          '& .MuiInputBase-input': {
            padding: theme.spacing(1, 1.5),
            fontSize: isMobile ? '0.875rem' : '0.875rem',
            minHeight: isMobile ? 44 : 'auto',
          },
          '& .MuiInputLabel-root': {
            fontSize: isMobile ? '0.75rem' : '0.875rem',
          },
          '& .MuiOutlinedInput-root': {
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.primary.main,
            },
          },
        }}
        InputLabelProps={{ shrink: true }}
        {...props}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>
    );
  }

  return (
    <TextField
      fullWidth={fullWidth}
      label={label}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      multiline={multiline}
      rows={rows}
      size="small"
      sx={{
        '& .MuiInputBase-input': {
          padding: theme.spacing(1, 1.5),
          fontSize: isMobile ? '0.875rem' : '0.875rem',
          minHeight: isMobile ? 44 : 'auto',
        },
        '& .MuiInputLabel-root': {
          fontSize: isMobile ? '0.75rem' : '0.875rem',
        },
        '& .MuiOutlinedInput-root': {
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.primary.main,
          },
        },
      }}
      InputLabelProps={{ shrink: true }}
      {...props}
    />
  );
}

export function MobileButton({ children, variant = 'contained', size = 'small', fullWidth = false, onClick, disabled, startIcon, endIcon, color = 'primary', ...props }) {
  const isMobile = useMobile();
  const theme = useTheme();

  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth || isMobile}
      onClick={onClick}
      disabled={disabled}
      startIcon={startIcon}
      endIcon={endIcon}
      color={color}
      sx={{
        minHeight: isMobile ? 48 : 'auto',
        fontSize: isMobile ? '0.875rem' : '0.875rem',
        fontWeight: 600,
        textTransform: 'none',
        borderRadius: theme.shape.borderRadius,
        px: isMobile ? 2 : 1.5,
        py: isMobile ? 1.5 : 1,
        ...props,
      }}
    >
      {children}
    </Button>
  );
}

export function MobileIconButton({ children, onClick, size = 'small', disabled, 'aria-label': ariaLabel, ...props }) {
  const isMobile = useMobile();

  return (
    <IconButton
      onClick={onClick}
      size={size}
      disabled={disabled}
      aria-label={ariaLabel}
      sx={{
        minWidth: isMobile ? 48 : 'auto',
        minHeight: isMobile ? 48 : 'auto',
        ...props,
      }}
    >
      {children}
    </IconButton>
  );
}

export function MobileChip({ label, color = 'default', variant = 'outlined', size = 'small', icon, onClick, onDelete, ...props }) {
  const isMobile = useMobile();
  const theme = useTheme();

  return (
    <Chip
      label={label}
      color={color}
      variant={variant}
      size={size}
      icon={icon}
      onClick={onClick}
      onDelete={onDelete}
      sx={{
        fontSize: isMobile ? '0.7rem' : '0.75rem',
        height: isMobile ? 28 : 'auto',
        fontWeight: 600,
        borderRadius: theme.shape.borderRadius,
        ...props,
      }}
    />
  );
}

export function MobileAvatar({ src, alt, children, size = 'medium', ...props }) {
  const isMobile = useMobile();

  const sizes = {
    small: isMobile ? 32 : 36,
    medium: isMobile ? 40 : 48,
    large: isMobile ? 56 : 64,
  };

  return (
    <Avatar
      src={src}
      alt={alt}
      sx={{
        width: sizes[size],
        height: sizes[size],
        fontSize: size === 'small' ? '0.75rem' : size === 'medium' ? '0.875rem' : '1rem',
        ...props,
      }}
    >
      {children}
    </Avatar>
  );
}

export function MobileTypography({ variant = 'body1', component, children, ...props }) {
  const isMobile = useMobile();

  const mobileVariants = {
    h1: 'h2',
    h2: 'h3',
    h3: 'h4',
    h4: 'h5',
    h5: 'h6',
    h6: 'subtitle1',
    body1: 'body2',
    body2: 'caption',
  };

  return (
    <Typography
      component={component || (isMobile && mobileVariants[variant] ? mobileVariants[variant] : undefined)}
      variant={isMobile && mobileVariants[variant] ? mobileVariants[variant] : variant}
      {...props}
    >
      {children}
    </Typography>
  );
}

export function MobileDialogContent({ children, maxHeight = '70vh', ...props }) {
  const isMobile = useMobile();

  return (
    <Box
      sx={{
        overflowY: 'auto',
        maxHeight,
        padding: isMobile ? 1.5 : 2,
        ...props,
      }}
    >
      {children}
    </Box>
  );
}

export function MobileDialogActions({ children, ...props }) {
  const isMobile = useMobile();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column-reverse' : 'row',
        justifyContent: isMobile ? 'stretch' : 'flex-end',
        gap: 1,
        padding: isMobile ? 1.5 : 2,
        px: isMobile ? 1.5 : 2,
        pb: isMobile ? 1.5 : 2,
        borderTop: `1px solid ${props.theme?.palette?.divider || 'rgba(35,44,38,1)'}`,
        ...props,
      }}
    >
      {children}
    </Box>
  );
}