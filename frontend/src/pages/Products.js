import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Chip, Grid, IconButton, Link as MuiLink,
  Divider, Avatar, CircularProgress, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SyncIcon from '@mui/icons-material/Sync';
import DashboardIcon from '@mui/icons-material/Dashboard';
import WebIcon from '@mui/icons-material/Web';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import GroupIcon from '@mui/icons-material/Group';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileDialog,
  MobileFormGrid,
  MobileActionButtons,
  MobileStack,
  useMobile,
} from '../components/MobileResponsive';

const PRODUCT_TYPES = ['saas', 'marketing', 'internal_tool', 'other'];
const STAGES = ['idea', 'building', 'beta', 'live', 'maintenance', 'sunset'];

const emptyProductForm = { name: '', slug: '', domain: '', description: '', product_type: 'saas', stage: 'live', target_mrr_inr: '' };

const formatINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const stageColor = (stage) => ({ idea: 'default', building: 'info', beta: 'warning', live: 'success', maintenance: 'info', sunset: 'default' }[stage] || 'default');
const typeIcon = (type) => ({ saas: DashboardIcon, marketing: WebIcon, internal_tool: SettingsIcon }[type] || DashboardIcon);

export default function ProductsPage() {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const canEdit = ['owner', 'admin'].includes(staff?.role);

  const [products, setProducts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [productDepts, setProductDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(null);
  const [expandedProduct, setExpandedProduct] = useState(null);

  // Product dialog
  const [prodDialogOpen, setProdDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodForm, setProdForm] = useState(emptyProductForm);
  const [prodSaving, setProdSaving] = useState(false);
  const [prodError, setProdError] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: prodData }, { data: deptData }, { data: teamData }, { data: pdData }] = await Promise.all([
        client.get('/products'),
        client.get('/departments'),
        client.get('/teams'),
        client.get('/product-departments'),  // New endpoint for product-department mapping
      ]);
      setProducts(prodData.products);
      setDepartments(deptData.departments || []);
      setTeams(teamData.teams || []);
      setProductDepts(pdData.mappings || []);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openNewProduct = () => {
    setEditingProduct(null);
    setProdForm(emptyProductForm);
    setProdError('');
    setProdDialogOpen(true);
  };
  const openEditProduct = (p) => {
    setEditingProduct(p);
    setProdForm({
      name: p.name, slug: p.slug, domain: p.domain || '', description: p.description || '',
      product_type: p.product_type, stage: p.stage, target_mrr_inr: p.target_mrr_inr || ''
    });
    setProdError('');
    setProdDialogOpen(true);
  };

  const saveProduct = async () => {
    setProdSaving(true);
    setProdError('');
    try {
      const payload = {
        name: prodForm.name, slug: prodForm.slug.toLowerCase(), domain: prodForm.domain || null,
        description: prodForm.description || null, product_type: prodForm.product_type,
        stage: prodForm.stage, target_mrr_inr: prodForm.target_mrr_inr ? parseFloat(prodForm.target_mrr_inr) : 0
      };
      if (editingProduct) {
        await client.put(`/products/${editingProduct.id}`, payload);
      } else {
        await client.post('/products', payload);
      }
      setProdDialogOpen(false);
      loadAll();
    } catch (err) {
      setProdError(err.response?.data?.error || 'Failed to save product');
    } finally {
      setProdSaving(false);
    }
  };

  const deleteProduct = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      await client.delete(`/products/${p.id}`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete product');
    }
  };

  const refreshMetrics = async (productId) => {
    setRefreshing(productId);
    try {
      const { data } = await client.get(`/products/${productId}`);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...data.product } : p));
    } catch (err) {
      setError('Failed to refresh metrics');
    } finally {
      setRefreshing(null);
    }
  };

  const openDomain = (domain) => {
    if (domain) window.open(`https://${domain}`, '_blank', 'noopener,noreferrer');
  };

  const getDeptsForProduct = (productId) => {
    const mappings = productDepts.filter(pd => pd.product_id === productId);
    return mappings.map(m => departments.find(d => d.id === m.department_id)).filter(Boolean);
  };

  const getTeamsForDept = (deptId) => teams.filter(t => t.department_id === deptId);

  const getPrimaryDepts = (productId) => getDeptsForProduct(productId).filter(d => {
    const mapping = productDepts.find(pd => pd.product_id === productId && pd.department_id === d.id);
    return mapping?.is_primary;
  });

  const getSupportDepts = (productId) => getDeptsForProduct(productId).filter(d => {
    const mapping = productDepts.find(pd => pd.product_id === productId && pd.department_id === d.id);
    return !mapping?.is_primary;
  });

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Products & Teams</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Manage 3 products sharing company-wide departments. Click domain to open, expand to see teams.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openNewProduct}>Add Product</MobileButton>}
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <MobilePaper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>Loading...</Typography>
        </MobilePaper>
      ) : (
        <MobileStack gap={2} direction="column">
          {products.map((p) => {
            const primaryDepts = getPrimaryDepts(p.id);
            const supportDepts = getSupportDepts(p.id);
            const allDepts = getDeptsForProduct(p.id);
            const totalTeams = allDepts.reduce((sum, d) => sum + getTeamsForDept(d.id).length, 0);
            
            return (
              <MobilePaper key={p.id} sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}>
                    <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.light' }}>
                      {React.createElement(typeIcon(p.product_type), { sx: { fontSize: 24 } })}
                    </Avatar>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 700 }}>{p.name}</Typography>
                        <Chip size="small" label={p.slug} variant="outlined" />
                        <Chip size="small" label={p.stage} color={stageColor(p.stage)} />
                        <Chip size="small" label={p.product_type} variant="outlined" />
                      </Box>
                      {p.domain && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{p.domain}</Typography>
                          <Button size="small" startIcon={<OpenInNewIcon />} onClick={(e) => { e.stopPropagation(); openDomain(p.domain); }}>Open</Button>
                        </Box>
                      )}
                      {p.description && <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>{p.description}</Typography>}
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                        {primaryDepts.length} primary depts · {supportDepts.length} support depts · {totalTeams} teams · Click to expand
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {p.slug === 'ethertrack' && (
                      <>
                        <Button size="small" variant="outlined" startIcon={<SyncIcon />} onClick={() => refreshMetrics(p.id)} disabled={refreshing === p.id}>
                          {refreshing === p.id ? <CircularProgress size={18} /> : 'Refresh'}
                        </Button>
                        <MuiLink href="/platform-sync" underline="hover" sx={{ fontWeight: 500, mx: 1 }}>Platform Sync</MuiLink>
                        <MuiLink href="/product/roadmap" underline="hover" sx={{ fontWeight: 500, mx: 1 }}>Roadmap</MuiLink>
                        <MuiLink href="/product/releases" underline="hover" sx={{ fontWeight: 500, mx: 1 }}>Releases</MuiLink>
                      </>
                    )}
                    {canEdit && (
                      <>
                        <Button size="small" onClick={(e) => { e.stopPropagation(); openEditProduct(p); }}>Edit</Button>
                        <Button size="small" color="error" onClick={(e) => { e.stopPropagation(); deleteProduct(p); }}>Delete</Button>
                      </>
                    )}
                  </Box>
                </Box>

                {/* Live Metrics for EtherTrack Core */}
                {p.slug === 'ethertrack' && p.platformMetrics && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>MRR</Typography>
                          <Typography variant="h5" className="figure">{formatINR(p.platformMetrics.mrr)}/mo</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>ARR</Typography>
                          <Typography variant="h5" className="figure">{formatINR(p.platformMetrics.arr)}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Active Subscribers</Typography>
                          <Typography variant="h5" className="figure">{p.platformMetrics.activeSubscribers}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase' }}>Total Customers</Typography>
                          <Typography variant="h5" className="figure">{p.platformMetrics.totalCustomers}</Typography>
                        </Box>
                      </Grid>
                      {p.platformMetrics.byPlan && Object.keys(p.platformMetrics.byPlan).length > 0 && (
                        <Grid item xs={12}>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 0.5 }}>
                            MRR by Plan
                          </Typography>
                          <MobileStack gap={1} direction="row" flexWrap="wrap">
                            {Object.entries(p.platformMetrics.byPlan).map(([plan, value]) => (
                              <Chip key={plan} size="small" label={`${plan}: ${formatINR(value)}`} variant="outlined" />
                            ))}
                          </MobileStack>
                        </Grid>
                      )}
                    </Grid>
                  </>
                )}

                {/* Expandable Departments & Teams */}
                {expandedProduct === p.id && allDepts.length > 0 && (
                  <Box sx={{ mt: 1.5, borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>
                      Departments & Teams for {p.name}
                    </Typography>
                    
                    {/* Primary Departments */}
                    {primaryDepts.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', mb: 1 }}>
                          Primary Departments
                        </Typography>
                        <MobileStack gap={1} direction="column">
                          {primaryDepts.map((dept) => (
                            <Accordion key={dept.id} defaultExpanded>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                  <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.light' }}>
                                    <PeopleIcon sx={{ fontSize: 18 }} />
                                  </Avatar>
                                  <Box>
                                    <Typography sx={{ fontWeight: 600 }}>{dept.name}</Typography>
                                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{dept.description}</Typography>
                                  </Box>
                                  <Chip size="small" label="Primary" color="primary" variant="outlined" sx={{ ml: 'auto' }} />
                                </Box>
                              </AccordionSummary>
                              <AccordionDetails>
                                {renderDeptTeams(dept.id)}
                              </AccordionDetails>
                            </Accordion>
                          ))}
                        </MobileStack>
                      </Box>
                    )}
                    
                    {/* Support Departments */}
                    {supportDepts.length > 0 && (
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>
                          Support Departments
                        </Typography>
                        <MobileStack gap={1} direction="column">
                          {supportDepts.map((dept) => (
                            <Accordion key={dept.id} defaultExpanded>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                  <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.light' }}>
                                    <PeopleIcon sx={{ fontSize: 18 }} />
                                  </Avatar>
                                  <Box>
                                    <Typography sx={{ fontWeight: 600 }}>{dept.name}</Typography>
                                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{dept.description}</Typography>
                                  </Box>
                                  <Chip size="small" label="Support" color="secondary" variant="outlined" sx={{ ml: 'auto' }} />
                                </Box>
                              </AccordionSummary>
                              <AccordionDetails>
                                {renderDeptTeams(dept.id)}
                              </AccordionDetails>
                            </Accordion>
                          ))}
                        </MobileStack>
                      </Box>
                    )}
                  </Box>
                )}
              </MobilePaper>
            );
          })}
          {!products.length && (
            <MobilePaper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No products yet. Click "Add Product" to create your first one.</Typography>
            </MobilePaper>
          )}
        </MobileStack>
      )}

      {/* Product Dialog */}
      <MobileDialog open={prodDialogOpen} onClose={() => setProdDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProduct ? 'Edit Product' : 'New Product'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Name" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} required />
            <MobileTextField fullWidth label="Slug (URL-friendly)" value={prodForm.slug} onChange={(e) => setProdForm({ ...prodForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} helperText="e.g. ethertrack, landing, ops" required />
            <MobileTextField fullWidth label="Domain" value={prodForm.domain} onChange={(e) => setProdForm({ ...prodForm, domain: e.target.value })} placeholder="app.ethertrack.in" />
            <MobileTextField fullWidth label="Description" multiline rows={2} value={prodForm.description} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })} />
            <MobileTextField
              fullWidth select label="Product Type" value={prodForm.product_type}
              onChange={(e) => setProdForm({ ...prodForm, product_type: e.target.value })}
              options={PRODUCT_TYPES.map(t => ({ value: t, label: t }))}
            />
            <MobileTextField
              fullWidth select label="Stage" value={prodForm.stage}
              onChange={(e) => setProdForm({ ...prodForm, stage: e.target.value })}
              options={STAGES.map(s => ({ value: s, label: s }))}
            />
            <MobileTextField fullWidth type="number" label="Target MRR (₹/month)" value={prodForm.target_mrr_inr} onChange={(e) => setProdForm({ ...prodForm, target_mrr_inr: e.target.value })} placeholder="5000000" />
          </MobileFormGrid>
          {prodError && <Alert severity="error" sx={{ mt: 2 }}>{prodError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setProdDialogOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={saveProduct} disabled={prodSaving || !prodForm.name || !prodForm.slug}>
            {prodSaving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );

  function renderDeptTeams(deptId) {
    const deptTeams = getTeamsForDept(deptId);
    return (
      <MobileStack gap={0.5} direction="column">
        {deptTeams.length > 0 ? (
          deptTeams.map((team) => (
            <Box key={team.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <GroupIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 500, flex: 1 }}>{team.name}</Typography>
              {team.team_head_id && (
                <Chip size="small" label="Has Lead" color="success" variant="outlined" />
              )}
              {!team.team_head_id && canEdit && (
                <Chip size="small" label="No Lead" color="warning" variant="outlined" />
              )}
            </Box>
          ))
        ) : (
          <Box sx={{ p: 1, textAlign: 'center', color: 'text.secondary' }}>
            No teams yet
          </Box>
        )}
      </MobileStack>
    );
  }
}