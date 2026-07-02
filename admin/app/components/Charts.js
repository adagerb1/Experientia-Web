// Visualizaciones SVG ligeras (sin librerías externas). Animadas por CSS.
import { computed } from 'vue';

const PALETTE = ['#2563FF', '#22D3EE', '#7C5CFF', '#0EA5E9', '#14B8A6', '#F59E0B', '#EC4899', '#10B981'];

// Anillo tipo "gauge" para un valor sobre un máximo (ej. puntaje /55).
export const GaugeRing = {
  props: { value: { type: Number, default: 0 }, max: { type: Number, default: 55 }, label: { type: String, default: '' }, size: { type: Number, default: 132 } },
  setup(props) {
    const r = 54; const c = 2 * Math.PI * r;
    const pct = computed(() => Math.max(0, Math.min(1, (props.value || 0) / (props.max || 1))));
    const dash = computed(() => `${(c * pct.value).toFixed(1)} ${c.toFixed(1)}`);
    const tone = computed(() => pct.value < 0.45 ? '#F59E0B' : pct.value < 0.73 ? '#2563FF' : '#10B981');
    return { r, c, dash, tone, pct };
  },
  template: `
  <div class="gauge" :style="{ width: size + 'px' }">
    <svg :width="size" :height="size" viewBox="0 0 132 132">
      <circle cx="66" cy="66" :r="r" fill="none" stroke="rgba(11,29,58,.08)" stroke-width="11" />
      <circle cx="66" cy="66" :r="r" fill="none" :stroke="tone" stroke-width="11" stroke-linecap="round"
        :stroke-dasharray="dash" transform="rotate(-90 66 66)" class="gauge__arc" />
      <text x="66" y="62" text-anchor="middle" class="gauge__num">{{ value }}</text>
      <text x="66" y="82" text-anchor="middle" class="gauge__den">/ {{ max }}</text>
    </svg>
    <span class="gauge__label" v-if="label">{{ label }}</span>
  </div>`
};

// Donut con leyenda. items: [{label, value}].
export const DonutChart = {
  props: { items: { type: Array, default: () => [] }, size: { type: Number, default: 168 } },
  setup(props) {
    const r = 56; const c = 2 * Math.PI * r;
    const total = computed(() => props.items.reduce((a, b) => a + (Number(b.value) || 0), 0));
    const segs = computed(() => {
      let acc = 0;
      return props.items.map((it, i) => {
        const frac = total.value ? (Number(it.value) || 0) / total.value : 0;
        const seg = { ...it, color: PALETTE[i % PALETTE.length], dash: `${(c * frac).toFixed(1)} ${c.toFixed(1)}`, offset: (-c * acc).toFixed(1), pct: Math.round(frac * 100) };
        acc += frac; return seg;
      });
    });
    return { r, c, total, segs };
  },
  template: `
  <div class="donut">
    <svg :width="size" :height="size" viewBox="0 0 140 140">
      <circle cx="70" cy="70" :r="r" fill="none" stroke="rgba(11,29,58,.06)" stroke-width="16" />
      <circle v-for="(s,i) in segs" :key="i" cx="70" cy="70" :r="r" fill="none" :stroke="s.color" stroke-width="16"
        :stroke-dasharray="s.dash" :stroke-dashoffset="s.offset" transform="rotate(-90 70 70)" class="donut__seg"
        :style="{ animationDelay: (i*90)+'ms' }" />
      <text x="70" y="66" text-anchor="middle" class="donut__num">{{ total }}</text>
      <text x="70" y="84" text-anchor="middle" class="donut__cap">total</text>
    </svg>
    <ul class="donut__legend">
      <li v-for="(s,i) in segs" :key="i"><span class="dot" :style="{ background: s.color }"></span>{{ s.label }}<b>{{ s.value }}</b></li>
    </ul>
  </div>`
};

// Barras horizontales con animación de ancho. items: [{label, value}].
export const BarList = {
  props: { items: { type: Array, default: () => [] }, suffix: { type: String, default: '' } },
  setup(props) {
    const max = computed(() => Math.max(1, ...props.items.map((i) => Number(i.value) || 0)));
    const rows = computed(() => props.items.map((it, i) => ({ ...it, color: PALETTE[i % PALETTE.length], pct: Math.round(((Number(it.value) || 0) / max.value) * 100) })));
    return { rows };
  },
  template: `
  <ul class="barlist">
    <li v-for="(r,i) in rows" :key="i">
      <div class="barlist__head"><span>{{ r.label }}</span><b>{{ r.value }}{{ suffix }}</b></div>
      <div class="barlist__track"><span class="barlist__fill" :style="{ width: r.pct + '%', background: r.color, animationDelay: (i*70)+'ms' }"></span></div>
    </li>
    <li v-if="!rows.length" class="muted">Sin datos aún.</li>
  </ul>`
};

// Radar de las 11 zonas del Tablero. axes: [{label, value(1-5)}].
export const RadarChart = {
  props: { axes: { type: Array, default: () => [] }, maxValue: { type: Number, default: 5 }, size: { type: Number, default: 320 } },
  setup(props) {
    const cx = 160, cy = 160, R = 118;
    const pt = (i, radius) => {
      const ang = (Math.PI * 2 * i) / props.axes.length - Math.PI / 2;
      return [cx + radius * Math.cos(ang), cy + radius * Math.sin(ang)];
    };
    const rings = computed(() => [1, 2, 3, 4, 5].map((lvl) => props.axes.map((_, i) => pt(i, (R * lvl) / 5).join(',')).join(' ')));
    const spokes = computed(() => props.axes.map((_, i) => pt(i, R)));
    const labels = computed(() => props.axes.map((a, i) => ({ ...a, p: pt(i, R + 16) })));
    const shape = computed(() => props.axes.map((a, i) => pt(i, (R * (Number(a.value) || 0)) / props.maxValue).join(',')).join(' '));
    const dots = computed(() => props.axes.map((a, i) => ({ p: pt(i, (R * (Number(a.value) || 0)) / props.maxValue), v: a.value })));
    return { cx, cy, R, rings, spokes, labels, shape, dots };
  },
  template: `
  <svg :width="size" :height="size" viewBox="0 0 320 320" class="radar">
    <polygon v-for="(r,i) in rings" :key="'r'+i" :points="r" fill="none" stroke="rgba(11,29,58,.07)" stroke-width="1" />
    <line v-for="(s,i) in spokes" :key="'s'+i" :x1="cx" :y1="cy" :x2="s[0]" :y2="s[1]" stroke="rgba(11,29,58,.08)" stroke-width="1" />
    <polygon :points="shape" fill="rgba(37,99,255,.18)" stroke="#2563FF" stroke-width="2" class="radar__shape" />
    <circle v-for="(d,i) in dots" :key="'d'+i" :cx="d.p[0]" :cy="d.p[1]" r="3.5" fill="#2563FF" />
    <text v-for="(l,i) in labels" :key="'l'+i" :x="l.p[0]" :y="l.p[1]" text-anchor="middle" class="radar__label">{{ l.label }}</text>
  </svg>`
};

// Área de tendencia (línea + relleno degradado). items: [{label, value}].
export const TrendArea = {
  props: { items: { type: Array, default: () => [] }, height: { type: Number, default: 150 } },
  setup(props) {
    const W = 560, H = 150, PAD = 18;
    const pts = computed(() => {
      const n = props.items.length;
      if (!n) return [];
      const max = Math.max(1, ...props.items.map((i) => Number(i.value) || 0));
      return props.items.map((it, i) => ({
        x: n === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1),
        y: H - PAD - ((Number(it.value) || 0) / max) * (H - PAD * 2),
        label: it.label, v: Number(it.value) || 0
      }));
    });
    const line = computed(() => pts.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    const area = computed(() => pts.value.length
      ? `${PAD},${H - PAD} ` + line.value + ` ${W - PAD},${H - PAD}` : '');
    return { W, H, pts, line, area };
  },
  template: `
  <div class="trend">
    <svg :viewBox="'0 0 ' + W + ' ' + H" class="trend__svg" preserveAspectRatio="none" v-if="pts.length">
      <defs><linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2563FF" stop-opacity=".28" /><stop offset="1" stop-color="#22D3EE" stop-opacity="0" />
      </linearGradient></defs>
      <polygon :points="area" fill="url(#trendfill)" />
      <polyline :points="line" fill="none" stroke="#2563FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="trend__line" />
      <circle v-for="(p,i) in pts" :key="i" :cx="p.x" :cy="p.y" r="3.5" fill="#fff" stroke="#2563FF" stroke-width="2" />
    </svg>
    <p v-else class="muted">Sin datos suficientes aún.</p>
    <div class="trend__labels" v-if="pts.length">
      <span v-for="(p,i) in pts" :key="i"><b>{{ p.v }}</b>{{ p.label }}</span>
    </div>
  </div>`
};

// Embudo de conversión: barras decrecientes con % respecto a la etapa anterior.
export const FunnelChart = {
  props: { items: { type: Array, default: () => [] } },
  setup(props) {
    const rows = computed(() => {
      const first = Math.max(1, Number(props.items[0]?.value) || 0);
      return props.items.map((it, i) => {
        const prev = i === 0 ? null : (Number(props.items[i - 1].value) || 0);
        return {
          ...it,
          pct: Math.max(4, Math.round(((Number(it.value) || 0) / first) * 100)),
          conv: prev === null ? null : (prev > 0 ? Math.round(((Number(it.value) || 0) / prev) * 100) : 0),
          color: PALETTE[i % PALETTE.length]
        };
      });
    });
    return { rows };
  },
  template: `
  <div class="funnel">
    <div class="funnel__row" v-for="(r,i) in rows" :key="i">
      <div class="funnel__head"><span>{{ r.label }}</span><b>{{ r.value }}<small v-if="r.conv !== null"> · {{ r.conv }}% de la etapa anterior</small></b></div>
      <div class="funnel__track"><span class="funnel__fill" :style="{ width: r.pct + '%', background: 'linear-gradient(90deg,' + r.color + ', ' + r.color + 'cc)', animationDelay: (i*90)+'ms' }"></span></div>
    </div>
    <p v-if="!rows.length" class="muted">Sin datos aún.</p>
  </div>`
};

export default { GaugeRing, DonutChart, BarList, RadarChart, TrendArea, FunnelChart };
