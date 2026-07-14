import { ref, reactive, computed, watch } from 'vue';

// Tabla reutilizable: orden por columna, paginación, búsqueda y filtros.
// Uso:
//   <data-table :rows="items" :columns="cols" :page-size="15" searchable>
//     <template #cell-estado="{ row }"> ... </template>
//     <template #actions="{ row }"> ... </template>
//   </data-table>
// columns: [{ key, label, sortable?, align?, width?, filter?: true|['A','B'], sortValue?: fn, class?: string }]
export default {
  props: {
    rows: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    pageSize: { type: Number, default: 15 },
    searchable: { type: Boolean, default: true },
    searchKeys: { type: Array, default: null },
    rowKey: { type: String, default: 'id' },
    dense: { type: Boolean, default: false },
    emptyText: { type: String, default: 'No hay registros.' },
    emptyIcon: { type: String, default: '📄' }
  },
  setup(props, { slots }) {
    const q = ref('');
    const sortKey = ref(''); const sortDir = ref(1); // 1 asc, -1 desc
    const page = ref(1);
    const filters = reactive({});
    // Tamaño de página ajustable (Lexis 4.2: 5, 10, 20, 50 o 100 con contador).
    const size = ref(props.pageSize);
    const sizeOptions = computed(() => [...new Set([props.pageSize, 10, 20, 50, 100])].sort((a, b) => a - b));

    const val = (row, col) => {
      if (col.sortValue) return col.sortValue(row);
      return row[col.key];
    };
    const num = (v) => {
      if (typeof v === 'number') return v;
      const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
      return isNaN(n) ? null : n;
    };

    // Columnas con filtro tipo "select": opciones fijas o derivadas de los datos.
    const filterCols = computed(() => props.columns.filter((c) => c.filter));
    const optionsFor = (col) => {
      if (Array.isArray(col.filter)) return col.filter;
      const set = new Set();
      props.rows.forEach((r) => { const v = r[col.key]; if (v !== null && v !== undefined && v !== '') set.add(String(v)); });
      return [...set].sort();
    };

    const searchable = computed(() => {
      const keys = props.searchKeys || props.columns.map((c) => c.key);
      return keys;
    });

    const filtered = computed(() => {
      let out = props.rows.slice();
      // Filtros por columna.
      filterCols.value.forEach((col) => {
        const f = filters[col.key];
        if (f) out = out.filter((r) => String(r[col.key] ?? '') === f);
      });
      // Búsqueda global.
      const term = q.value.trim().toLowerCase();
      if (term) {
        out = out.filter((r) => searchable.value.some((k) => String(r[k] ?? '').toLowerCase().includes(term)));
      }
      return out;
    });

    const sorted = computed(() => {
      if (!sortKey.value) return filtered.value;
      const col = props.columns.find((c) => c.key === sortKey.value) || { key: sortKey.value };
      const arr = filtered.value.slice();
      arr.sort((a, b) => {
        const va = val(a, col), vb = val(b, col);
        const na = num(va), nb = num(vb);
        let cmp;
        if (na !== null && nb !== null) cmp = na - nb;
        else cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'es', { numeric: true });
        return cmp * sortDir.value;
      });
      return arr;
    });

    const totalPages = computed(() => Math.max(1, Math.ceil(sorted.value.length / size.value)));
    const paged = computed(() => {
      const start = (page.value - 1) * size.value;
      return sorted.value.slice(start, start + size.value);
    });

    // Reinicia a la página 1 al filtrar/buscar/ordenar, cambiar tamaño o datos.
    watch([q, sortKey, sortDir, size, () => JSON.stringify(filters), () => props.rows.length], () => { page.value = 1; });
    watch(totalPages, (tp) => { if (page.value > tp) page.value = tp; });

    // ¿Hay búsqueda o filtros activos? (para el estado vacío con acción)
    const hasActiveFilter = computed(() => !!q.value.trim() || filterCols.value.some((c) => filters[c.key]));
    function clearFilters() { q.value = ''; filterCols.value.forEach((c) => { filters[c.key] = ''; }); }

    function toggleSort(col) {
      if (col.sortable === false) return;
      if (sortKey.value !== col.key) { sortKey.value = col.key; sortDir.value = 1; }
      else if (sortDir.value === 1) sortDir.value = -1;
      else { sortKey.value = ''; sortDir.value = 1; } // tercer clic: sin orden
    }
    const arrow = (col) => sortKey.value !== col.key ? '' : (sortDir.value === 1 ? '▲' : '▼');
    const prev = () => { if (page.value > 1) page.value--; };
    const next = () => { if (page.value < totalPages.value) page.value++; };

    const rangeText = computed(() => {
      const n = sorted.value.length;
      if (!n) return '0 resultados';
      const start = (page.value - 1) * size.value + 1;
      const end = Math.min(page.value * size.value, n);
      return `${start}–${end} de ${n}`;
    });

    return { q, sortKey, sortDir, page, size, sizeOptions, filters, filterCols, optionsFor, sorted, paged, totalPages,
      toggleSort, arrow, prev, next, rangeText, hasActiveFilter, clearFilters, slots };
  },
  template: `
  <div class="dt">
    <div class="dt__toolbar">
      <div class="dt__search" v-if="searchable">
        <span aria-hidden="true">⌕</span>
        <input v-model="q" type="search" placeholder="Buscar…" />
      </div>
      <div class="dt__filters">
        <select v-for="col in filterCols" :key="col.key" v-model="filters[col.key]" class="dt__filter">
          <option value="">{{ col.label }}: todos</option>
          <option v-for="o in optionsFor(col)" :key="o" :value="o">{{ o }}</option>
        </select>
        <slot name="toolbar" />
      </div>
    </div>

    <div class="dt__scroll">
      <table class="table--rich" :class="{ 'table--dense': dense }">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" :style="col.width ? { width: col.width } : null"
              :class="[col.align ? 'ta-' + col.align : '', col.sortable === false ? '' : 'dt__th']" @click="toggleSort(col)">
              {{ col.label }}<span class="dt__arrow" v-if="arrow(col)">{{ arrow(col) }}</span>
            </th>
            <th v-if="slots.actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in paged" :key="row[rowKey]">
            <td v-for="col in columns" :key="col.key" :class="col.align ? 'ta-' + col.align : ''">
              <slot :name="'cell-' + col.key" :row="row" :value="row[col.key]">{{ row[col.key] }}</slot>
            </td>
            <td v-if="slots.actions" class="ta-right"><slot name="actions" :row="row" /></td>
          </tr>
          <tr v-if="!paged.length"><td :colspan="columns.length + (slots.actions ? 1 : 0)">
            <div class="dt__empty">
              <template v-if="hasActiveFilter">
                <span class="dt__empty-ico">⌕</span>
                <p><b>Sin resultados</b> para tu búsqueda o filtros.</p>
                <button class="btn btn--ghost btn--sm" @click="clearFilters">Limpiar filtros</button>
              </template>
              <template v-else>
                <span class="dt__empty-ico">{{ emptyIcon }}</span>
                <p>{{ emptyText }}</p>
                <slot name="empty-action" />
              </template>
            </div>
          </td></tr>
        </tbody>
      </table>
    </div>

    <div class="dt__foot">
      <div class="dt__foot-left">
        <span class="muted">{{ rangeText }}</span>
        <label class="dt__size">
          <span class="muted">Mostrar</span>
          <select v-model.number="size"><option v-for="s in sizeOptions" :key="s" :value="s">{{ s }}</option></select>
        </label>
      </div>
      <div class="dt__pager" v-if="totalPages > 1">
        <button class="dt__pg" @click="prev" :disabled="page === 1" aria-label="Página anterior">‹</button>
        <span class="dt__page">{{ page }} / {{ totalPages }}</span>
        <button class="dt__pg" @click="next" :disabled="page === totalPages" aria-label="Página siguiente">›</button>
      </div>
    </div>
  </div>`
};
