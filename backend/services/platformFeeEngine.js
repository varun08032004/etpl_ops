'use strict';
// services/platformFeeEngine.js
//
// Dynamic Platform Fee/Commission Engine
// Per-plan seller/buyer fees, coupon discounts, no-code configuration

const { safeQuery: query } = require('../db/pool');
const { logAction } = require('./auditLog');

// ──────────────────────────────────────────────────────────────────────────
// Fee Rule Engine
// Supports: percentage, flat, tiered, volume-based, coupon-based fees
// ──────────────────────────────────────────────────────────────────────────

const FEE_TYPES = {
  percentage: 'Percentage of transaction',
  flat: 'Flat fee per transaction',
  tiered: 'Tiered based on volume',
  volume_discount: 'Volume discount (reduces fee)',
  coupon: 'Coupon discount',
  mixed: 'Mixed (percentage + flat)',
};

const APPLY_TO = {
  seller: 'Seller (deducted from payout)',
  buyer: 'Buyer (added to total)',
  both: 'Split between both',
};

const CALCULATION_BASE = {
  gross: 'Gross transaction amount',
  net: 'Net after other fees',
  subtotal: 'Subtotal before tax',
};

// ──────────────────────────────────────────────────────────────────────────
// Fee Rule CRUD
// ──────────────────────────────────────────────────────────────────────────

async function createFeeRule(data, createdBy) {
  const {
    name, description, plan_id, // null = global
    fee_type, calculation_base,
    apply_to, // seller, buyer, both
    // Percentage fee
    percentage_rate,
    // Flat fee
    flat_amount,
    flat_currency = 'INR',
    // Tiered fee
    tiers = [], // [{ min_volume, max_volume, rate_type, rate_value }]
    // Volume discount
    volume_thresholds = [], // [{ min_amount, discount_percent }]
    // Coupon
    coupon_code, coupon_type, coupon_value, coupon_max_uses, coupon_valid_from, coupon_valid_to,
    // Conditions
    min_transaction_amount, max_transaction_amount,
    applicable_categories = [], // category IDs
    excluded_categories = [],
    priority = 0, // higher = applied first
    is_active = true,
  } = data;

  const { rows: [rule] } = await query(
    `INSERT INTO fee_rules
       (name, description, plan_id, fee_type, calculation_base, apply_to,
        percentage_rate, flat_amount, flat_currency, tiers, volume_thresholds,
        coupon_code, coupon_type, coupon_value, coupon_max_uses, coupon_valid_from, coupon_valid_to,
        min_transaction_amount, max_transaction_amount,
        applicable_categories, excluded_categories, priority, is_active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     RETURNING *`,
    [
      name, description, plan_id, fee_type, calculation_base, apply_to,
      percentage_rate, flat_amount, flat_currency,
      JSON.stringify(tiers), JSON.stringify(volume_thresholds),
      coupon_code, coupon_type, coupon_value, coupon_max_uses, coupon_valid_from, coupon_valid_to,
      min_transaction_amount, max_transaction_amount,
      applicable_categories, excluded_categories, priority, is_active, createdBy,
    ]
  );

  await logAction({
    staffId: createdBy,
    action: 'fee_rule.created',
    entity: 'fee_rule',
    entityId: rule.id,
    newValue: { name, fee_type, plan_id },
  }).catch(() => {});

  return rule;
}

async function updateFeeRule(ruleId, data, updatedBy) {
  const allowedFields = [
    'name', 'description', 'plan_id', 'fee_type', 'calculation_base', 'apply_to',
    'percentage_rate', 'flat_amount', 'flat_currency', 'tiers', 'volume_thresholds',
    'coupon_code', 'coupon_type', 'coupon_value', 'coupon_max_uses', 'coupon_valid_from', 'coupon_valid_to',
    'min_transaction_amount', 'max_transaction_amount',
    'applicable_categories', 'excluded_categories', 'priority', 'is_active',
  ];

  const updates = [];
  const params = [ruleId];
  let paramIdx = 2;

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      params.push(typeof value === 'object' ? JSON.stringify(value) : value);
      updates.push(`${key} = $${paramIdx++}`);
    }
  }

  if (updates.length === 0) throw new Error('No valid fields to update');

  params.push(updatedBy);
  updates.push(`updated_by = $${paramIdx++}`);
  updates.push(`updated_at = NOW()`);

  const { rows: [rule] } = await query(
    `UPDATE fee_rules SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );

  await logAction({
    staffId: updatedBy,
    action: 'fee_rule.updated',
    entity: 'fee_rule',
    entityId: ruleId,
    newValue: data,
  }).catch(() => {});

  return rule;
}

async function deleteFeeRule(ruleId, deletedBy) {
  const { rows: [rule] } = await query(
    `UPDATE fee_rules SET is_active = false, deleted_by = $1, deleted_at = NOW()
     WHERE id = $2 RETURNING *`,
    [deletedBy, ruleId]
  );

  await logAction({
    staffId: deletedBy,
    action: 'fee_rule.deleted',
    entity: 'fee_rule',
    entityId: ruleId,
  }).catch(() => {});

  return rule;
}

async function getFeeRules(filters = {}) {
  let sql = `SELECT * FROM fee_rules WHERE is_active = true`;
  const params = [];
  let paramIdx = 1;

  if (filters.planId) {
    params.push(filters.planId);
    sql += ` AND (plan_id = $${paramIdx++} OR plan_id IS NULL)`;
  } else {
    sql += ` AND plan_id IS NULL`; // global rules by default
  }

  if (filters.feeType) {
    params.push(filters.feeType);
    sql += ` AND fee_type = $${paramIdx++}`;
  }

  sql += ` ORDER BY priority DESC, created_at DESC`;

  const { rows } = await query(sql, params);
  return rows;
}

async function getFeeRuleById(ruleId) {
  const { rows: [rule] } = await query(`SELECT * FROM fee_rules WHERE id = $1`, [ruleId]);
  return rule;
}

// ──────────────────────────────────────────────────────────────────────────
// Fee Calculation Engine
// ──────────────────────────────────────────────────────────────────────────

async function calculateFees(transaction) {
  const {
    amount, // transaction amount in paise
    currency = 'INR',
    plan_id,
    category_id,
    seller_id,
    buyer_id,
    coupon_code,
  } = transaction;

  // Get applicable rules (global + plan-specific)
  const globalRules = await getFeeRules({ planId: null });
  const planRules = plan_id ? await getFeeRules({ planId: plan_id }) : [];
  const allRules = [...planRules, ...globalRules].sort((a, b) => b.priority - a.priority);

  let results = {
    seller_fees: [],
    buyer_fees: [],
    total_seller_fee: 0,
    total_buyer_fee: 0,
    discounts: [],
    coupon_applied: null,
  };

  let currentAmount = amount; // in paise

  for (const rule of allRules) {
    // Check conditions
    if (!checkConditions(rule, transaction)) continue;

    const fee = calculateRuleFee(rule, currentAmount, transaction);
    if (fee <= 0) continue;

    // Apply to seller/buyer/both
    if (rule.apply_to === 'seller' || rule.apply_to === 'both') {
      results.seller_fees.push({
        rule_id: rule.id,
        rule_name: rule.name,
        fee_type: rule.fee_type,
        amount: fee,
        description: rule.description,
      });
      results.total_seller_fee += fee;
      if (rule.apply_to === 'both') currentAmount -= fee; // For subsequent rules
    }

    if (rule.apply_to === 'buyer' || rule.apply_to === 'both') {
      results.buyer_fees.push({
        rule_id: rule.id,
        rule_name: rule.name,
        fee_type: rule.fee_type,
        amount: fee,
        description: rule.description,
      });
      results.total_buyer_fee += fee;
    }

    // Track coupon
    if (rule.coupon_code && coupon_code === rule.coupon_code) {
      results.coupon_applied = {
        code: rule.coupon_code,
        discount: fee,
        type: rule.coupon_type,
      };
    }

    if (rule.fee_type === 'coupon' || rule.fee_type === 'volume_discount') {
      results.discounts.push({
        rule_id: rule.id,
        rule_name: rule.name,
        amount: fee,
      });
    }
  }

  // Calculate net amounts
  results.net_seller_payout = amount - results.total_seller_fee;
  results.net_buyer_total = amount + results.total_buyer_fee;

  return results;
}

function checkConditions(rule, transaction) {
  const { amount, category_id } = transaction;

  // Amount range
  if (rule.min_transaction_amount && amount < rule.min_transaction_amount) return false;
  if (rule.max_transaction_amount && amount > rule.max_transaction_amount) return false;

  // Category inclusion
  if (rule.applicable_categories?.length && category_id) {
    if (!rule.applicable_categories.includes(category_id)) return false;
  }

  // Category exclusion
  if (rule.excluded_categories?.length && category_id) {
    if (rule.excluded_categories.includes(category_id)) return false;
  }

  // Coupon validation
  if (rule.coupon_code) {
    if (!transaction.coupon_code) return false;
    if (transaction.coupon_code !== rule.coupon_code) return false;
    if (rule.coupon_valid_from && new Date() < new Date(rule.coupon_valid_from)) return false;
    if (rule.coupon_valid_to && new Date() > new Date(rule.coupon_valid_to)) return false;
    if (rule.coupon_max_uses) {
      // Would need to check usage count - simplified here
    }
  }

  return true;
}

function calculateRuleFee(rule, amount, transaction) {
  const { fee_type, calculation_base } = rule;
  const baseAmount = getBaseAmount(calculation_base, amount, transaction);

  switch (fee_type) {
    case 'percentage':
      return Math.round(baseAmount * (rule.percentage_rate / 100));

    case 'flat':
      return Math.round(rule.flat_amount * 100); // Convert to paise

    case 'mixed':
      return Math.round(baseAmount * (rule.percentage_rate / 100) + rule.flat_amount * 100);

    case 'tiered':
      return calculateTieredFee(rule.tiers, baseAmount);

    case 'volume_discount':
      return calculateVolumeDiscount(rule.volume_thresholds, baseAmount);

    case 'coupon':
      if (rule.coupon_type === 'percentage') {
        return Math.round(baseAmount * (rule.coupon_value / 100));
      } else if (rule.coupon_type === 'flat') {
        return Math.round(rule.coupon_value * 100);
      }
      return 0;

    default:
      return 0;
  }
}

function getBaseAmount(calculationBase, amount, transaction) {
  // For now, use gross amount. Could be extended for net/subtotal
  return amount;
}

function calculateTieredFee(tiers, baseAmount) {
  if (!tiers?.length) return 0;

  let totalFee = 0;
  let remainingAmount = baseAmount;

  for (const tier of tiers.sort((a, b) => a.min_volume - b.min_volume)) {
    const tierMax = tier.max_volume || Infinity;
    const tierAmount = Math.min(remainingAmount, tierMax - (tier.min_volume || 0));

    if (tierAmount <= 0) break;

    let tierFee = 0;
    if (tier.rate_type === 'percentage') {
      tierFee = tierAmount * (tier.rate_value / 100);
    } else if (tier.rate_type === 'flat') {
      tierFee = tier.rate_value * 100; // paise per transaction in tier
    }

    totalFee += tierFee;
    remainingAmount -= tierAmount;
  }

  return Math.round(totalFee);
}

function calculateVolumeDiscount(thresholds, baseAmount) {
  if (!thresholds?.length) return 0;

  // Find highest applicable threshold
  const applicable = thresholds
    .filter(t => baseAmount >= t.min_amount)
    .sort((a, b) => b.min_amount - a.min_amount)[0];

  if (!applicable) return 0;

  return Math.round(baseAmount * (applicable.discount_percent / 100));
}

// ──────────────────────────────────────────────────────────────────────────
// Coupon Management
// ──────────────────────────────────────────────────────────────────────────

async function createCoupon(data, createdBy) {
  const {
    code, name, description,
    discount_type, discount_value,
    max_uses, max_uses_per_user,
    valid_from, valid_to,
    min_order_amount, max_discount_amount,
    applicable_categories, excluded_categories,
    applicable_plans, // plan IDs
    is_active = true,
  } = data;

  const { rows: [coupon] } = await query(
    `INSERT INTO coupons
       (code, name, description, discount_type, discount_value,
        max_uses, max_uses_per_user, valid_from, valid_to,
        min_order_amount, max_discount_amount,
        applicable_categories, excluded_categories, applicable_plans, is_active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      code.toUpperCase(), name, description, discount_type, discount_value,
      max_uses, max_uses_per_user, valid_from, valid_to,
      min_order_amount, max_discount_amount,
      applicable_categories, excluded_categories, applicable_plans, is_active, createdBy,
    ]
  );

  return coupon;
}

async function validateCoupon(code, transaction) {
  const { rows: [coupon] } = await query(
    `SELECT * FROM coupons WHERE code = $1 AND is_active = true`,
    [code.toUpperCase()]
  );

  if (!coupon) return { valid: false, reason: 'Invalid coupon code' };

  const now = new Date();
  if (coupon.valid_from && now < new Date(coupon.valid_from)) {
    return { valid: false, reason: 'Coupon not yet valid' };
  }
  if (coupon.valid_to && now > new Date(coupon.valid_to)) {
    return { valid: false, reason: 'Coupon has expired' };
  }

  if (coupon.max_uses) {
    const { rows: [usage] } = await query(
      `SELECT COUNT(*) as count FROM coupon_uses WHERE coupon_id = $1`,
      [coupon.id]
    );
    if (parseInt(usage.count) >= coupon.max_uses) {
      return { valid: false, reason: 'Coupon usage limit reached' };
    }
  }

  if (coupon.min_order_amount && transaction.amount < coupon.min_order_amount * 100) {
    return { valid: false, reason: `Minimum order amount ${formatINR(coupon.min_order_amount)} not met` };
  }

  if (coupon.applicable_categories?.length && transaction.category_id) {
    if (!coupon.applicable_categories.includes(transaction.category_id)) {
      return { valid: false, reason: 'Coupon not applicable to this category' };
    }
  }

  if (coupon.excluded_categories?.length && transaction.category_id) {
    if (coupon.excluded_categories.includes(transaction.category_id)) {
      return { valid: false, reason: 'Coupon not applicable to this category' };
    }
  }

  // Calculate discount
  let discount = 0;
  if (coupon.discount_type === 'percentage') {
    discount = Math.round(transaction.amount * (coupon.discount_value / 100));
    if (coupon.max_discount_amount) {
      discount = Math.min(discount, coupon.max_discount_amount * 100);
    }
  } else if (coupon.discount_type === 'flat') {
    discount = Math.min(coupon.discount_value * 100, transaction.amount);
  }

  return { valid: true, coupon, discount };
}

async function recordCouponUse(couponId, transactionId, userId, discount) {
  const { rows: [use] } = await query(
    `INSERT INTO coupon_uses (coupon_id, transaction_id, user_id, discount_amount)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [couponId, transactionId, userId, discount]
  );
  return use;
}

// ──────────────────────────────────────────────────────────────────────────
// Fee Analytics
// ──────────────────────────────────────────────────────────────────────────

async function getFeeAnalytics(fromDate, toDate) {
  const { rows } = await query(
    `SELECT 
      fr.name, fr.fee_type, fr.apply_to,
      COUNT(ft.id) as transactions,
      SUM(ft.fee_amount) as total_fees,
      AVG(ft.fee_amount) as avg_fee
     FROM fee_transactions ft
     JOIN fee_rules fr ON fr.id = ft.rule_id
     WHERE ft.created_at BETWEEN $1 AND $2
     GROUP BY fr.id, fr.name, fr.fee_type, fr.apply_to
     ORDER BY total_fees DESC`,
    [fromDate, toDate]
  );

  const { rows: summary } = await query(
    `SELECT 
      SUM(fee_amount) FILTER (WHERE apply_to = 'seller') as total_seller_fees,
      SUM(fee_amount) FILTER (WHERE apply_to = 'buyer') as total_buyer_fees,
      SUM(fee_amount) FILTER (WHERE fee_type = 'coupon') as total_coupon_discounts,
      COUNT(DISTINCT rule_id) as active_rules,
      COUNT(*) as total_transactions
     FROM fee_transactions
     WHERE created_at BETWEEN $1 AND $2`,
    [fromDate, toDate]
  );

  return { byRule: rows, summary: summary[0] };
}

// ──────────────────────────────────────────────────────────────────────────
// Record Fee Transaction
// ──────────────────────────────────────────────────────────────────────────

async function recordFeeTransaction(data) {
  const {
    transaction_id, rule_id, fee_type, apply_to,
    fee_amount, base_amount, transaction_amount,
    seller_id, buyer_id, plan_id,
  } = data;

  const { rows: [ft] } = await query(
    `INSERT INTO fee_transactions
       (transaction_id, rule_id, fee_type, apply_to, fee_amount, base_amount, transaction_amount,
        seller_id, buyer_id, plan_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [transaction_id, rule_id, fee_type, apply_to, fee_amount, base_amount, transaction_amount,
     seller_id, buyer_id, plan_id]
  );

  return ft;
}

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

module.exports = {
  createFeeRule,
  updateFeeRule,
  deleteFeeRule,
  getFeeRules,
  getFeeRuleById,
  calculateFees,
  checkConditions,
  calculateRuleFee,
  createCoupon,
  validateCoupon,
  recordCouponUse,
  recordFeeTransaction,
  getFeeAnalytics,
  formatINR,
  FEE_TYPES,
  APPLY_TO,
  CALCULATION_BASE,
};