import { reactive } from 'vue';

export const auth = reactive({
  token: localStorage.getItem('ngx_token') || '',
  user: JSON.parse(localStorage.getItem('ngx_user') || 'null'),
  isAuthed() { return !!this.token; },
  set(token, user) {
    this.token = token; this.user = user;
    localStorage.setItem('ngx_token', token);
    localStorage.setItem('ngx_user', JSON.stringify(user));
  },
  clear() {
    this.token = ''; this.user = null;
    localStorage.removeItem('ngx_token');
    localStorage.removeItem('ngx_user');
  }
});

// Etiquetas legibles de etapas / estados.
export const STATUS_BADGE = {
  confirmed: 'green', payment_confirmed: 'green', completed: 'green', approved: 'green',
  pending_payment: 'amber', payment_pending: 'amber', payment_started: 'amber', draft: 'amber',
  cancelled: 'red', no_show: 'red', failed: 'red',
  rescheduled: 'amber'
};
