import { reactive } from 'vue';

export const auth = reactive({
  token: localStorage.getItem('ngx_token') || '',
  user: JSON.parse(localStorage.getItem('ngx_user') || 'null'),
  permissions: JSON.parse(localStorage.getItem('ngx_perms') || 'null'),
  isAuthed() { return !!this.token; },
  isAdmin() { return this.user && this.user.role === 'admin'; },
  // ¿Puede acceder a una opción/funcionalidad? (admin o sin permisos cargados = todo).
  can(perm) {
    if (!perm) return true;
    if (this.isAdmin()) return true;
    if (!Array.isArray(this.permissions)) return true; // aún no cargados: no bloquea
    return this.permissions.includes(perm);
  },
  set(token, user) {
    this.token = token; this.user = user;
    this.permissions = (user && user.permissions) || null;
    localStorage.setItem('ngx_token', token);
    localStorage.setItem('ngx_user', JSON.stringify(user));
    if (this.permissions) localStorage.setItem('ngx_perms', JSON.stringify(this.permissions));
  },
  setPermissions(perms) {
    this.permissions = Array.isArray(perms) ? perms : null;
    if (this.permissions) localStorage.setItem('ngx_perms', JSON.stringify(this.permissions));
  },
  clear() {
    this.token = ''; this.user = null; this.permissions = null;
    localStorage.removeItem('ngx_token');
    localStorage.removeItem('ngx_user');
    localStorage.removeItem('ngx_perms');
  }
});

// Etiquetas legibles de etapas / estados.
export const STATUS_BADGE = {
  confirmed: 'green', payment_confirmed: 'green', completed: 'green', approved: 'green',
  pending_payment: 'amber', payment_pending: 'amber', payment_started: 'amber', draft: 'amber',
  cancelled: 'red', no_show: 'red', failed: 'red',
  rescheduled: 'amber'
};
