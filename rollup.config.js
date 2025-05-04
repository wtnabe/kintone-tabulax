import { defineConfig } from 'rollup'
import pluginGas from 'rollup-plugin-google-apps-script'
import replace from 'rollup-plugin-re'

export default defineConfig({
  input: 'dist/kintone-tabulax.create.js',
  output: {
    file: 'dist/kintone-tabulax.gas.js',
    name: 'KintoneTabulax'
  },
  plugins: [
    pluginGas({
      gasEntryOptions: {
        comment: true,
        globalIdentifierName: 'KintoneTabulax'
      }
    }),
    replace({
      patterns: [
        {
          test: /.*^[\s]+\/\* -- begin of KintoneTabulax -- \*\/$(.*)/sm,
          replace: '\\1'
        },
        {
          test: /(.*)^[\s]+\/\* -- end of createKintoneTabulax -- \*\/$/sm,
          replace: '\\1'
        }
      ]
    })
  ]
})
