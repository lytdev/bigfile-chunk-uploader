import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts', // 入口文件
  output: [
    {
      file: 'dist/index.js',
      format: 'umd',
      name: 'BigFileUploader',
      plugins: [terser()]
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      plugins: [terser()]
    }
  ],
  plugins: [
    resolve(),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      presets: [
        '@babel/preset-env',
        '@babel/preset-typescript'
      ]
    })
  ],
  external: ['axios', 'spark-md5']
};