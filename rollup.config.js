import pkg from './package.json'
import rpi_jsy from 'rollup-plugin-jsy-babel'

const sourcemap = 'inline'
const external = ['swim', 'dns']
const plugins = [rpi_jsy()]

export default 
	{ input: 'code/swim_discovery.jsy',
		output: [
      { file: pkg.main, format: 'cjs', sourcemap },
      { file: pkg.module, format: 'es', sourcemap },
    ],
    external, plugins }
