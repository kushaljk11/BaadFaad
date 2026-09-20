/**
 * @fileoverview Real-Time Session Socket Hook & Helpers
 * @description Manages Socket.IO room lifecycle, subscriptions, and connection state.
 *
 * Guaranteed Behaviors:
 * - Exposes connectionStatus: 'connected' | 'reconnecting' | 'disconnected'
 * - Auto-rejoins session room on reconnect
 * - Triggers onReconnect callback for clean database state reconciliation
 * - Symmetrical event listener cleanup (socket.off) preventing memory leaks and duplicate updates
 *
 * @module hooks/useSessionSocket
 */

import { useEffect, useRef, useState } from "react";
import socket from "../config/socket";

/**
 * Hook to subscribe to real-time session updates via Socket.IO.
 *
 * @param {string|null} sessionId - the session room to join
 * @param {(data: object) => void} [onParticipantJoined] - called when a new participant joins
 * @param {(data: { path: string }) => void} [onHostNavigate] - called when the host redirects everyone
 * @param {(data: object) => void} [onItemsUpdate] - called when the host updates bill items
 * @param {() => void} [onReconnect] - called when socket reconnects to fetch authoritative server state
 * @returns {{ connectionStatus: 'connected' | 'reconnecting' | 'disconnected' }}
 */
export default function useSessionSocket(
  sessionId,
  onParticipantJoined,
  onHostNavigate,
  onItemsUpdate,
  onReconnect
) {
  const [connectionStatus, setConnectionStatus] = useState(
    socket.connected ? 'connected' : 'disconnected'
  );

  const handlersRef = useRef({
    onParticipantJoined,
    onHostNavigate,
    onItemsUpdate,
    onReconnect,
  });

  useEffect(() => {
    handlersRef.current = {
      onParticipantJoined,
      onHostNavigate,
      onItemsUpdate,
      onReconnect,
    };
  }, [onParticipantJoined, onHostNavigate, onItemsUpdate, onReconnect]);

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

    const onConnect = () => {
      setConnectionStatus('connected');
      try {
        socket.emit("join-session-room", sessionId);
        // Refresh authoritative database state on reconnect
        handlersRef.current.onReconnect?.();
      } catch (e) {
        console.debug('Failed to rejoin session on connect', e);
      }
    };
    socket.on('connect', onConnect);

    const onReconnectAttempt = () => {
      setConnectionStatus('reconnecting');
    };
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    const onDisconnect = () => {
      setConnectionStatus('disconnected');
    };
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off("participant-joined", joinHandler);
      socket.off("host-navigate", navHandler);
      socket.off("items-update", itemsHandler);
      socket.off('connect', onConnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('disconnect', onDisconnect);
      socket.emit("leave-session-room", sessionId);
    };
  }, [sessionId]);

  return { connectionStatus };
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
