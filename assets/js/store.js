// Store reactivo mínimo (sin dependencias externas).
import { reactive } from 'vue';

export const store = reactive({
  // Etiqueta del CTA sticky, adaptable según la sección/etapa (Adaptive CTA).
  stickyLabel: 'Agenda una conversación',
  stickyVisible: false,
  // Resultado del microdiagnóstico (ruta recomendada), persiste entre vistas.
  diagnosticResult: null,
  setSticky(label) { this.stickyLabel = label; },
  showSticky(v) { this.stickyVisible = v; },
  setDiagnosticResult(r) { this.diagnosticResult = r; }
});
