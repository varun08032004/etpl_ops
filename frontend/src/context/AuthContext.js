import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await client.get('/auth/me');
      setStaff(data.staff);
    } catch {
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password, twoFactorCode) => {
    // Device-locked accounts get a 202 when the browser isn't recognized
    // yet, and 2FA-enabled accounts get a 202 when no code was supplied —
    // neither is an error, both mean the caller needs another step before
    // a session is issued.
    const body = { email, password };
    if (twoFactorCode) {
      // A backup code is longer (10 hex chars) than a TOTP code (6 digits) —
      // let the caller pass either without needing to specify which.
      if (/^\d{6}$/.test(twoFactorCode)) body.totpToken = twoFactorCode;
      else body.backupCode = twoFactorCode;
    }
    const { data, status } = await client.post('/auth/login', body, { validateStatus: (s) => s === 200 || s === 202 });
    if (status === 202) {
      return { deviceApprovalRequired: !!data.deviceApprovalRequired, twoFactorRequired: !!data.twoFactorRequired, message: data.message };
    }
    localStorage.setItem('etpl_token', data.token);
    setStaff(data.staff);
    return { staff: data.staff };
  };

  const verifyDevice = async (email, otp, label) => {
    const { data } = await client.post('/auth/verify-device', { email, otp, label });
    localStorage.setItem('etpl_token', data.token);
    setStaff(data.staff);
    return data.staff;
  };

  const logout = async () => {
    await client.post('/auth/logout').catch(() => {});
    localStorage.removeItem('etpl_token');
    setStaff(null);
  };

  return (
    <AuthContext.Provider value={{ staff, loading, login, verifyDevice, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);