import { RouterLink } from 'vue-router';

export default {
  components: { RouterLink },
  template: `
  <div class="page">
    <section class="page__hero" style="text-align:center;min-height:50vh;display:grid;place-content:center">
      <div class="container">
        <p class="kicker" style="text-align:center">Error 404</p>
        <h1 class="section__title">Esta página se salió de órbita.</h1>
        <p class="page__lead" style="margin-inline:auto">La página que buscas no existe o cambió de lugar. Volvamos al centro.</p>
        <div class="hero__actions" style="justify-content:center;margin-top:24px">
          <router-link to="/" class="btn btn--primary">Volver al inicio</router-link>
          <router-link to="/contacto" class="btn btn--ghost">Hablar con Tonny</router-link>
        </div>
      </div>
    </section>
  </div>`
};
