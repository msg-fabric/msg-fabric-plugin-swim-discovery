import rpi_babel from 'rollup-plugin-babel'

const sourcemap = 'inline'

const external = ['swim', 'dns']

const plugins = [jsy_plugin()]

export default [
	{ input: 'code/swim_discovery.jsy',
		output: [
      { file: `dist/swim_discovery.js`, format: 'cjs' },
      { file: `dist/swim_discovery.mjs`, format: 'es' },
    ],
    sourcemap, external, plugins },
]




function jsy_plugin() {
  const jsy_preset = [ 'jsy/lean', { no_stage_3: true, modules: false } ]
  return rpi_babel({
    exclude: 'node_modules/**',
    presets: [ jsy_preset ],
    plugins: [],
    babelrc: false }) }
