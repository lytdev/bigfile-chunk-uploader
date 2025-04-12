import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import filesize from 'rollup-plugin-filesize';

const isProd = process.env.NODE_ENV === 'production';

export default {
  input: 'src/index.ts', // 入口文件
  output: [
    {
      file: 'dist/index.js',
      format: 'umd',
      name: 'BigFileUploader',
      sourcemap: !isProd, // 开发环境启用 sourcemap
      plugins: isProd ? [terser()] : []
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: !isProd,
      plugins: isProd ? [terser()] : []
    }
  ],
  plugins: [
    resolve(),
    commonjs(),
    filesize(),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      presets: [
        '@babel/preset-env',
        '@babel/preset-typescript'
      ]
    }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist',
      sourceMap: !isProd, // 开发环境启用 sourceMap
      inlineSources: !isProd // 开发环境内联源码
    }),
  ],
  external: ['axios']
};