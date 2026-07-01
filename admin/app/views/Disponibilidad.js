import { ref, reactive, onMounted } from 'vue';
import { api } from '../api.js';

// Días en orden Lun→Dom con su weekday real (0=domingo … 6=sábado).
const DAYS = [
  { wd: 1, name: 'Lunes' }, { wd: 2, name: 'Martes' }, { wd: 3, name: 'Miércoles' },
  { wd: 4, name: 'Jueves' }, { wd: 5, name: 'Viernes' }, { wd: 6, name: 'Sábado' }, { wd: 0, name: 'Domingo' }
];

export default {
  setup() {
    const loading = ref(true); const saving = ref(false); const error = ref(''); const saved = ref(false);
    const days = reactive({});      // wd -> {active, start_time, end_time}
    const exceptions = ref([]);     // fechas bloqueadas
    const newDate = ref('');

    DAYS.forEach((d) => { days[d.wd] = { active: false, start_time: '09:00', end_time: '17:00' }; });

    async function load() {
      loading.value = true;
      try {
        const data = (await api.availability()).data || {};
        DAYS.forEach((d) => { days[d.wd] = { active: false, start_time: '09:00', end_time: '17:00' }; });
        (data.rules || []).forEach((r) => {
          days[r.weekday] = { active: true, start_time: (r.start_time || '09:00:00').slice(0, 5), end_time: (r.end_time || '17:00:00').slice(0, 5) };
        });
        exceptions.value = data.exceptions || [];
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    function addDate() {
      const d = newDate.value;
      if (d && !exceptions.value.includes(d)) exceptions.value.push(d);
      newDate.value = '';
    }
    function removeDate(d) { exceptions.value = exceptions.value.filter((x) => x !== d); }
    function copyToAll(wd) {
      const src = days[wd];
      DAYS.forEach((d) => { if (days[d.wd].active) { days[d.wd].start_time = src.start_time; days[d.wd].end_time = src.end_time; } });
    }

    async function save() {
      saving.value = true; error.value = ''; saved.value = false;
      try {
        const payload = { days: DAYS.map((d) => ({ weekday: d.wd, ...days[d.wd] })), exceptions: exceptions.value };
        await api.saveAvailability(payload);
        saved.value = true; setTimeout(() => (saved.value = false), 2600);
      } catch (e) { error.value = e.message; } finally { saving.value = false; }
    }

    return { DAYS, days, exceptions, newDate, loading, saving, error, saved, addDate, removeDate, copyToAll, save };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar"><div><h1>Disponibilidad</h1><p class="topbar__sub">Define tus horarios por día. Se reflejan al instante en la agenda del sitio.</p></div></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 5" :key="i" style="height:52px"></div></div>

    <template v-else>
      <div class="panel">
        <h2>Horario semanal</h2>
        <div class="avail-row" v-for="d in DAYS" :key="d.wd" :class="{ 'avail-row--off': !days[d.wd].active }">
          <label class="switch"><input type="checkbox" v-model="days[d.wd].active" /><span>{{ d.name }}</span></label>
          <template v-if="days[d.wd].active">
            <div class="avail-times">
              <input type="time" v-model="days[d.wd].start_time" />
              <span class="muted">a</span>
              <input type="time" v-model="days[d.wd].end_time" />
              <button class="btn btn--ghost btn--sm" @click="copyToAll(d.wd)" title="Aplicar este horario a los días activos">Aplicar a todos</button>
            </div>
          </template>
          <span v-else class="muted">No disponible</span>
        </div>
        <p class="hint">La duración de cada cita la define el tipo de consulta. Los espacios ya reservados se ocultan automáticamente.</p>
      </div>

      <div class="panel">
        <h2>Fechas bloqueadas</h2>
        <p class="muted" style="margin-bottom:10px;font-size:.88rem">Vacaciones, festivos o días sin atención.</p>
        <div class="flex" style="margin-bottom:12px"><input type="date" v-model="newDate" /><button class="btn btn--sm" @click="addDate">Agregar</button></div>
        <div class="chips-x">
          <span class="chip-x" v-for="d in exceptions" :key="d">{{ d }} <button @click="removeDate(d)" aria-label="Quitar">✕</button></span>
          <span v-if="!exceptions.length" class="muted">Sin fechas bloqueadas.</span>
        </div>
      </div>

      <div class="save-bar">
        <transition name="fade"><span v-if="saved" class="pill pill--green">Guardado ✓</span></transition>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar disponibilidad' }}</button>
      </div>
    </template>
  </div>`
};
