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
    emptyText: { type: String, default: 'No hay registros.' }
  },
  setup(props, { slots }) {
    const q = ref('');
    const sortKey = ref(''); const sortDir = ref(1); // 1 asc, -1 desc
    const page = ref(1);
    const filters = reactive({});

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

    const totalPages = computed(() => Math.max(1, Math.ceil(sorted.value.length / props.pageSize)));
    const paged = computed(() => {
      const start = (page.value - 1) * props.pageSize;
      return sorted.value.slice(start, start + props.pageSize);
    });

    // Reinicia a la página 1 al filtrar/buscar/ordenar o si cambian los datos.
    watch([q, sortKey, sortDir, () => JSON.stringify(filters), () => props.rows.length], () => { page.value = 1; });
    watch(totalPages, (tp) => { if (page.value > tp) page.value = tp; });

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
      if (!n) return '0';
      const start = (page.value - 1) * props.pageSize + 1;
      const end = Math.min(page.value * props.pageSize, n);
      return `${start}–${end} de ${n}`;
    });

    return { q, sortKey, sortDir, page, filters, filterCols, optionsFor, sorted, paged, totalPages,
      toggleSort, arrow, prev, next, rangeText, slots };
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
          <tr v-if="!paged.length"><td :colspan="columns.length + (slots.actions ? 1 : 0)" class="muted center">{{ emptyText }}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="dt__foot">
      <span class="muted">{{ rangeText }}</span>
      <div class="dt__pager" v-if="totalPages > 1">
        <button class="dt__pg" @click="prev" :disabled="page === 1">‹</button>
        <span class="dt__page">{{ page }} / {{ totalPages }}</span>
        <button class="dt__pg" @click="next" :disabled="page === totalPages">›</button>
      </div>
    </div>
  </div>`
};
