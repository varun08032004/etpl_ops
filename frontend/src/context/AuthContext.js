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

  const login = async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
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
    <AuthContext.Provider value={{ staff, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
