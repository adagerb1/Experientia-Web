// Opciones de arte para la generación de portadas (formato, calidad, estilo,
// iluminación, ambiente) como campos "select con búsqueda" (input + datalist:
// se puede elegir un preset o escribir libremente). El estado vive en el objeto
// reactivo `opts` que pasa el componente padre.
const FORMATS = ['16:9', '9:16', '1:1', '4:5', '3:2'];
const QUALITIES = ['Estándar', 'Alta definición', 'Ultra detallada'];
const STYLES = ['Fotografía corporativa', 'Cinematográfico corporativo', 'Editorial minimalista', 'Ilustración plana', 'Render 3D', 'Duotono de marca', 'Aspiracional premium', 'Flat design tecnológico'];
const LIGHTS = ['Natural cálida', 'Natural fría', 'Estudio suave', 'Contraluz', 'Dramática', 'Difusa', 'Hora dorada'];
const MOODS = ['Inspirador', 'Profesional', 'Dinámico', 'Sobrio', 'Optimista', 'Tecnológico', 'Confiable'];

export default {
  props: { opts: { type: Object, required: true }, idp: { type: String, default: 'co' } },
  setup() { return { FORMATS, QUALITIES, STYLES, LIGHTS, MOODS }; },
  template: `
  <div class="vid-opts">
    <label>Formato
      <input :list="idp+'-fmt'" v-model="opts.aspect" placeholder="16:9" />
      <datalist :id="idp+'-fmt'"><option v-for="o in FORMATS" :key="o" :value="o"></option></datalist>
    </label>
    <label>Calidad
      <input :list="idp+'-qly'" v-model="opts.quality" placeholder="Alta definición" />
      <datalist :id="idp+'-qly'"><option v-for="o in QUALITIES" :key="o" :value="o"></option></datalist>
    </label>
    <label>Estilo
      <input :list="idp+'-sty'" v-model="opts.style" placeholder="Cinematográfico corporativo" />
      <datalist :id="idp+'-sty'"><option v-for="o in STYLES" :key="o" :value="o"></option></datalist>
    </label>
    <label>Iluminación
      <input :list="idp+'-lgt'" v-model="opts.lighting" placeholder="Natural cálida" />
      <datalist :id="idp+'-lgt'"><option v-for="o in LIGHTS" :key="o" :value="o"></option></datalist>
    </label>
    <label>Ambiente
      <input :list="idp+'-mod'" v-model="opts.mood" placeholder="Inspirador" />
      <datalist :id="idp+'-mod'"><option v-for="o in MOODS" :key="o" :value="o"></option></datalist>
    </label>
  </div>`
};
