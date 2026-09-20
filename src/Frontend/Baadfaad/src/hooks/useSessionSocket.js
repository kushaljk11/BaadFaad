/**
 * @fileoverview Real-Time Session Socket Hook & Helpers
 * @description Custom React hook and utility functions for managing real-time
 *              Socket.IO communication within a bill-splitting session.
 *
 *              The `useSessionSocket` hook joins a session room on mount and
 *              subscribes to three event channels:
 *              - `participant-joined` — a new user entered the session
 *              - `host-navigate`     — host redirects all participants to a new page
 *              - `items-update`      — host updated the bill items list
 *
 *              Helper functions:
 *              - `emitHostNavigate(sessionId, path)` — broadcast a page redirect
 *              - `emitItemsUpdate(sessionId, scannedData, manualItems)` — broadcast item changes
 *
 * @module hooks/useSessionSocket
 */
import { useEffect, useRef } from "react";
import socket from "../config/socket";
import toast from 'react-hot-toast';

/**
 * Hook to subscribe to real-time session updates via Socket.IO.
 *
 * @param {string|null} sessionId  - the session room to join
 * @param {(data: object) => void} onParticipantJoined - called when a new participant joins
 * @param {(data: { path: string }) => void} [onHostNavigate] - called when the host redirects everyone
 * @param {(data: object) => void} [onItemsUpdate] - called when the host updates bill items
 */
export default function useSessionSocket(sessionId, onParticipantJoined, onHostNavigate, onItemsUpdate) {
  const handlersRef = useRef({ onParticipantJoined, onHostNavigate, onItemsUpdate });

  useEffect(() => {
    handlersRef.current = { onParticipantJoined, onHostNavigate, onItemsUpdate };
  }, [onParticipantJoined, onHostNavigate, onItemsUpdate]);

  useEffect(() => {
    if (!sessionId) return;

    if (!socket.connected) {
      socket.auth = { token: localStorage.getItem('token') };
      socket.connect();
    }

    socket.emit("join-session-room", sessionId);

    const joinHandler = (data) => {
      handlersRef.current.onParticipantJoined?.(data);
    };
    socket.on("participant-joined", joinHandler);

    const navHandler = (data) => {
      handlersRef.current.onHostNavigate?.(data);
    };
    socket.on("host-navigate", navHandler);

    const itemsHandler = (data) => {
      handlersRef.current.onItemsUpdate?.(data);
    };
    socket.on("items-update", itemsHandler);

    // Rejoin room automatically when connection is (re)established
    const onConnect = () => {
      try {
        socket.emit("join-session-room", sessionId);
        console.debug("socket connected/reconnected and rejoined room", sessionId);
        toast.dismiss('socket-reconnect');
        // brief success toast
        toast.success('Connected to session', { duration: 1500 });
      } catch (e) {
        console.debug('Failed to rejoin session on connect', e);
      }
    };
    socket.on('connect', onConnect);

    const onReconnectAttempt = (attempt) => {
      // show a persistent reconnecting indicator while attempts continue
      toast.loading('Reconnecting...', { id: 'socket-reconnect' });
      console.debug('socket reconnect attempt', attempt);
    };
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    const onDisconnect = (reason) => {
      console.debug('socket disconnected', reason);
      toast.error('Disconnected from session — trying to reconnect', { duration: 3000 });
    };
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off("participant-joined", joinHandler);
      socket.off("host-navigate", navHandler);
      socket.off("items-update", itemsHandler);
      socket.emit("leave-session-room", sessionId);
      socket.off('connect', onConnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('disconnect', onDisconnect);
    };
  }, [sessionId]);
}

/**
 * Emit a host-navigate event to move all participants to a new page.
 */
export function emitHostNavigate(sessionId, path) {
  if (!socket.connected) {
    socket.auth = { token: localStorage.getItem('token') };
    socket.connect();
  }
  socket.emit("host-navigate", { sessionId, path });
}

/**
 * Emit bill items update so participants see live changes.
 */
export function emitItemsUpdate(sessionId, scannedData, manualItems) {
  if (!socket.connected) {
    socket.auth = { token: localStorage.getItem('token') };
    socket.connect();
  }
  socket.emit("items-update", { sessionId, scannedData, manualItems });
}
