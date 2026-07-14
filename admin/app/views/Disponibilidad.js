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
    // wd -> {active, split, am_start, am_end, pm_start, pm_end}
    const days = reactive({});
    const exceptions = ref([]);     // fechas bloqueadas
    const newDate = ref('');

    const blankDay = () => ({ active: false, split: false, am_start: '09:00', am_end: '17:00', pm_start: '14:00', pm_end: '18:00' });
    DAYS.forEach((d) => { days[d.wd] = blankDay(); });

    async function load() {
      loading.value = true;
      try {
        const data = (await api.availability()).data || {};
        DAYS.forEach((d) => { days[d.wd] = blankDay(); });
        // Agrupa las reglas por día (una o dos franjas).
        const byDay = {};
        (data.rules || []).forEach((r) => { (byDay[r.weekday] = byDay[r.weekday] || []).push(r); });
        Object.entries(byDay).forEach(([wd, list]) => {
          list.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
          const d = blankDay(); d.active = true;
          d.am_start = (list[0].start_time || '09:00:00').slice(0, 5);
          d.am_end = (list[0].end_time || '17:00:00').slice(0, 5);
          if (list.length > 1) {
            d.split = true;
            d.pm_start = (list[1].start_time || '14:00:00').slice(0, 5);
            d.pm_end = (list[1].end_time || '18:00:00').slice(0, 5);
          }
          days[wd] = d;
        });
        exceptions.value = data.exceptions || [];
      } catch (e) { error.value = 'No fue posible cargar la disponibilidad: ' + e.message; }
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
      const s = days[wd];
      DAYS.forEach((d) => {
        if (days[d.wd].active) Object.assign(days[d.wd], { split: s.split, am_start: s.am_start, am_end: s.am_end, pm_start: s.pm_start, pm_end: s.pm_end });
      });
    }

    // Construye las franjas de un día para el backend.
    function rangesOf(d) {
      if (!d.split) return [{ start: d.am_start, end: d.am_end }];
      return [{ start: d.am_start, end: d.am_end }, { start: d.pm_start, end: d.pm_end }];
    }

    async function save() {
      saving.value = true; error.value = ''; saved.value = false;
      try {
        const payload = { days: DAYS.map((d) => ({ weekday: d.wd, active: days[d.wd].active, ranges: rangesOf(days[d.wd]) })), exceptions: exceptions.value };
        await api.saveAvailability(payload);
        saved.value = true; setTimeout(() => (saved.value = false), 2600);
      } catch (e) { error.value = 'No fue posible guardar la disponibilidad: ' + e.message; } finally { saving.value = false; }
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
            <div class="avail-day">
              <div class="avail-times">
                <span class="avail-lbl" v-if="days[d.wd].split">Mañana</span>
                <input type="time" v-model="days[d.wd].am_start" />
                <span class="muted">a</span>
                <input type="time" v-model="days[d.wd].am_end" />
              </div>
              <div class="avail-times" v-if="days[d.wd].split">
                <span class="avail-lbl">Tarde</span>
                <input type="time" v-model="days[d.wd].pm_start" />
                <span class="muted">a</span>
                <input type="time" v-model="days[d.wd].pm_end" />
              </div>
              <div class="avail-actions">
                <label class="avail-split"><input type="checkbox" v-model="days[d.wd].split" /> Partir mañana/tarde (almuerzo)</label>
                <button class="btn btn--ghost btn--sm" @click="copyToAll(d.wd)" title="Aplicar este horario a los días activos">Aplicar a todos</button>
              </div>
            </div>
          </template>
          <span v-else class="muted">No disponible</span>
        </div>
        <p class="hint">Activa "Partir mañana/tarde" para respetar una franja intermedia (ej. almuerzo 12:00–14:00): la mañana termina a las 12:00 y la tarde empieza a las 14:00. La duración de cada cita la define el tipo de consulta; los espacios reservados se ocultan solos.</p>
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
        <transition name="fade"><span v-if="saved" class="pill pill--green">Disponibilidad guardada ✓</span></transition>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar disponibilidad' }}</button>
      </div>
    </template>
  </div>`
};
