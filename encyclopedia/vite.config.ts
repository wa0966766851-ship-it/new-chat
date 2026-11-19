import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({root:path.resolve('encyclopedia'),publicDir:false,plugins:[react(),tailwindcss()],resolve:{preserveSymlinks:true},build:{minify:'terser',target:'esnext',outDir:'dist',emptyOutDir:true,sourcemap:false},server:{fs:{allow:[path.resolve('.')]}}});
