/**
 * @fileoverview Authentication Context & Provider
 * @description React context that manages global authentication state.
 *              On mount, rehydrates user/token from localStorage.
 *              Exposes:
 *              - `user`            — the current authenticated user object (or null)
 *              - `isAuthenticated` — boolean shorthand
 *              - `isLoading`       — true while initial auth check runs
 *              - `login(user, token)` — persist credentials & update state
 *              - `logout()`        — clear credentials & redirect to /login
 *
 * Usage: wrap the app in <AuthProvider>, then call `useAuth()` in any component.
 *
 * @module context/authContext
 */
import React, { useEffect, useState, useCallback } from "react";
import { AuthContext } from './authState';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");

      if (token && userData) {
        setUser(JSON.parse(userData));
      }
    } catch {
      console.error("Invalid stored auth data");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback((userdata, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userdata));
    setUser(userdata);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = { user, login, logout, isLoading, isAuthenticated: !!user };

  return React.createElement(AuthContext.Provider, { value }, children);
};
