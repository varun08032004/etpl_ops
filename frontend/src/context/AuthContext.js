import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      // Call /auth/refresh which returns new access token in body + sets HttpOnly cookies
      const { data: refreshData } = await client.post('/auth/refresh');
      const accessToken = refreshData.accessToken;
      // Fetch user profile using the new access token immediately (before cookie propagates)
      const { data } = await client.get('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setStaff(data);
    } catch {
      // Refresh failed (refresh token expired/revoked) — clear staff
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password, twoFactorCode) => {
    const body = { email, password };
    if (twoFactorCode) {
      if (/^\d{6}$/.test(twoFactorCode)) body.totpToken = twoFactorCode;
      else body.backupCode = twoFactorCode;
    }
    const { data, status } = await client.post('/auth/login', body, { validateStatus: (s) => s === 200 || s === 202 });
    if (status === 202) {
      return { deviceApprovalRequired: !!data.deviceApprovalRequired, twoFactorRequired: !!data.twoFactorRequired, message: data.message };
    }
    // Access token in HttpOnly cookie, refresh token in HttpOnly cookie
    // data.staff returned in body
    setStaff(data.staff);
    return { staff: data.staff };
  };

  const verifyDevice = async (email, otp, label) => {
    const { data } = await client.post('/auth/verify-device', { email, otp, label });
    setStaff(data.staff);
    return data.staff;
  };

  const logout = async () => {
    await client.post('/auth/logout').catch(() => {});
    setStaff(null);
  };

  return (
    <AuthContext.Provider value={{ staff, loading, login, verifyDevice, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);