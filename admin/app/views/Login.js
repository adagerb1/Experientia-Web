import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';
import { auth } from '../store.js';

export default {
  setup() {
    const router = useRouter();
    const email = ref(''); const password = ref(''); const error = ref(''); const loading = ref(false); const show = ref(false);
    async function submit() {
      error.value = ''; loading.value = true;
      try {
        const res = await api.login(email.value, password.value);
        auth.set(res.data.token, res.data.user);
        router.push('/dashboard');
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    return { email, password, error, loading, show, submit };
  },
  template: `
  <div class="login">
    <div class="login__aura" aria-hidden="true"></div>
    <form class="login__card" @submit.prevent="submit">
      <div class="login__brand"><span></span> <b>Tonny Dager</b> <small>Admin</small></div>
      <h1 class="login__title">Bienvenido de nuevo</h1>
      <p class="login__sub">Accede al panel de crecimiento y diagnóstico.</p>
      <div class="field">
        <label>Email</label>
        <input v-model="email" type="email" required autocomplete="username" placeholder="admin@tonnydager.com" />
      </div>
      <div class="field">
        <label>Contraseña</label>
        <div class="input-group">
          <input v-model="password" :type="show ? 'text' : 'password'" required autocomplete="current-password" placeholder="••••••••" />
          <button type="button" class="input-group__btn" @click="show = !show" :aria-label="show ? 'Ocultar' : 'Mostrar'">{{ show ? '🙈' : '👁' }}</button>
        </div>
      </div>
      <button class="btn btn--block" :disabled="loading">{{ loading ? 'Ingresando…' : 'Ingresar' }}</button>
      <transition name="fade"><p v-if="error" class="error">{{ error }}</p></transition>
      <p class="login__foot">Panel privado · acceso autorizado</p>
    </form>
  </div>`
};
