export const formatCurrency = (amount, options = {}) => {
  const n = Number(amount || 0);
  const { currency = 'INR', locale = 'en-IN', maximumFractionDigits = 2 } = options;
  return new Intl.NumberFormat(locale, { 
    style: 'currency', 
    currency, 
    maximumFractionDigits 
  }).format(n);
};

export const formatNumber = (amount, options = {}) => {
  const n = Number(amount || 0);
  const { locale = 'en-IN', maximumFractionDigits = 2 } = options;
  return new Intl.NumberFormat(locale, { 
    maximumFractionDigits 
  }).format(n);
};