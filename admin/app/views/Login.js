import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';
import { auth } from '../store.js';

export default {
  setup() {
    const router = useRouter();
    const email = ref(''); const password = ref(''); const error = ref(''); const loading = ref(false);
    async function submit() {
      error.value = ''; loading.value = true;
      try {
        const res = await api.login(email.value, password.value);
        auth.set(res.data.token, res.data.user);
        router.push('/dashboard');
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    return { email, password, error, loading, submit };
  },
  template: `
  <div class="login">
    <form class="login__card" @submit.prevent="submit">
      <div class="login__brand"><span></span> Nucleus Admin</div>
      <div class="field">
        <label>Email</label>
        <input v-model="email" type="email" required autocomplete="username" placeholder="admin@tonnydager.com" />
      </div>
      <div class="field">
        <label>Contraseña</label>
        <input v-model="password" type="password" required autocomplete="current-password" placeholder="••••••••" />
      </div>
      <button class="btn btn--block" :disabled="loading">{{ loading ? 'Ingresando…' : 'Ingresar' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </div>`
};
