// Países en español con código ISO2 (para emoji de bandera) y prefijo telefónico.
const RAW = [
  ['Argentina','AR','+54'], ['Bolivia','BO','+591'], ['Chile','CL','+56'],
  ['Colombia','CO','+57'], ['Costa Rica','CR','+506'], ['Cuba','CU','+53'],
  ['Ecuador','EC','+593'], ['El Salvador','SV','+503'], ['España','ES','+34'],
  ['Estados Unidos','US','+1'], ['Guatemala','GT','+502'], ['Honduras','HN','+504'],
  ['México','MX','+52'], ['Nicaragua','NI','+505'], ['Panamá','PA','+507'],
  ['Paraguay','PY','+595'], ['Perú','PE','+51'], ['Puerto Rico','PR','+1'],
  ['República Dominicana','DO','+1'], ['Uruguay','UY','+598'], ['Venezuela','VE','+58'],
  ['Brasil','BR','+55'], ['Canadá','CA','+1'], ['Portugal','PT','+351'],
  ['Reino Unido','GB','+44'], ['Francia','FR','+33'], ['Alemania','DE','+49'],
  ['Italia','IT','+39'], ['Países Bajos','NL','+31'], ['Bélgica','BE','+32'],
  ['Suiza','CH','+41'], ['Irlanda','IE','+353'], ['Suecia','SE','+46'],
  ['Noruega','NO','+47'], ['Dinamarca','DK','+45'], ['Polonia','PL','+48'],
  ['Australia','AU','+61'], ['Nueva Zelanda','NZ','+64'], ['Japón','JP','+81'],
  ['China','CN','+86'], ['India','IN','+91'], ['Singapur','SG','+65'],
  ['Emiratos Árabes Unidos','AE','+971'], ['Arabia Saudita','SA','+966'],
  ['Sudáfrica','ZA','+27'], ['Marruecos','MA','+212'], ['Israel','IL','+972'],
  ['Turquía','TR','+90'], ['Filipinas','PH','+63'], ['Indonesia','ID','+62']
];

// Convierte ISO2 en emoji de bandera (regional indicator symbols).
function flag(iso) {
  return iso.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export const COUNTRIES = RAW
  .map(([name, iso, dial]) => ({ value: name, label: name, icon: flag(iso), dial, iso }))
  .sort((a, b) => a.label.localeCompare(b.label, 'es'));
