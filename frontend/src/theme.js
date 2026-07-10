import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0a0f0d', paper: '#121815' },
    primary: { main: '#2fbf71', dark: '#1e8f53', contrastText: '#0a0f0d' },
    error: { main: '#e5484d' },
    warning: { main: '#e5a54b' },
    text: { primary: '#eaf2ec', secondary: '#8fa398' },
    divider: '#232c26',
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', border: '1px solid #232c26' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: '#232c26' },
        head: { color: '#8fa398', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: '0.7rem' },
      },
    },
  },
});

export default theme;
