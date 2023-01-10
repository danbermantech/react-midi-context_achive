import typescript from 'rollup-plugin-typescript2'
import cleanup from 'rollup-plugin-cleanup'

import pkg from './package.json' assert {type:'json'}

export default {
  input: 'src/index.tsx',
  output: [
    {
      file: pkg.main,
      format: 'es',
      exports: 'named',
      sourcemap: true,
      strict: false
    }
  ],
  plugins: [
    typescript({ objectHashIgnoreUnknownHack: true }),
    cleanup({comments:/\/\*/, extensions: ["js", "ts"] }),
  ],
  external: ['react', 'react-dom']
}