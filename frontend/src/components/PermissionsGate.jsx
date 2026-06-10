import React from 'react';

/**
 * PermissionsGate acts as a transparent wrapper.
 * By returning children directly, we avoid blocking startup checklist blocks
 * and let permissions be requested on-demand inside specific components.
 */
export const PermissionsGate = ({ children }) => {
  return children;
};
