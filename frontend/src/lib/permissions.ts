'use client';
import { useState, useEffect } from 'react';

export interface ModulePermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isReadOnly: boolean;
}

export function getModulePermissions(moduleName: string): ModulePermissions {
  if (typeof window === 'undefined') {
    return { canView: true, canCreate: true, canEdit: true, canDelete: true, isReadOnly: false };
  }

  const role = (localStorage.getItem('evegah_role') || '').toLowerCase().trim();
  const roleName = (localStorage.getItem('evegah_user_role_name') || '').toLowerCase().trim();

  // Explicit read-only role checks
  if (role.includes('read_only') || role.includes('readonly') || role.includes('viewer') || role.includes('auditor') ||
      roleName.includes('read only') || roleName.includes('viewer') || roleName.includes('auditor')) {
    return { canView: true, canCreate: false, canEdit: false, canDelete: false, isReadOnly: true };
  }

  // Super Admin and Admin have full write access
  if (role === 'super_admin' || role === 'admin' || roleName.includes('super admin')) {
    return { canView: true, canCreate: true, canEdit: true, canDelete: true, isReadOnly: false };
  }

  try {
    const raw = localStorage.getItem('evegah_user_permissions');
    if (raw) {
      const perms = JSON.parse(raw);
      if (perms && typeof perms === 'object') {
        const modKey = Object.keys(perms).find(k => k.toLowerCase() === moduleName.toLowerCase() || k.toLowerCase().includes(moduleName.toLowerCase()));
        if (modKey && perms[modKey]) {
          const p = perms[modKey];
          const canView = p.view ?? p.access ?? true;
          const canCreate = Boolean(p.create);
          const canEdit = Boolean(p.edit);
          const canDelete = Boolean(p.delete);
          const isReadOnly = !canCreate && !canEdit && !canDelete;
          return { canView, canCreate, canEdit, canDelete, isReadOnly };
        }
      }
    }
  } catch (_) {}

  return { canView: true, canCreate: true, canEdit: true, canDelete: true, isReadOnly: false };
}

export function usePermissions(moduleName: string) {
  const [perms, setPerms] = useState<ModulePermissions>(() => getModulePermissions(moduleName));

  useEffect(() => {
    const update = () => setPerms(getModulePermissions(moduleName));
    window.addEventListener('evegah_role_changed', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('evegah_role_changed', update);
      window.removeEventListener('storage', update);
    };
  }, [moduleName]);

  return perms;
}
