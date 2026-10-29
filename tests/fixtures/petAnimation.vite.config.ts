import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwindcss()],
 // 與正式開發入口一致：預打包會破壞套件內 new URL('./worker.js', import.meta.url)。
 optimizeDeps:{entries:['tests/fixtures/petAnimationPreview.html','tests/fixtures/petBattlePreview.html'],exclude:['@seer-pet-anim/swf-bundle'],include:['buffer','pixi.js','eventemitter3','@arkntools/unity-js','@arkntools/unity-js-tools'],esbuildOptions:{define:{global:'globalThis'}}},
 server:{host:'127.0.0.1',port:3014,strictPort:true,watch:{ignored:['**/.desktop-releases/**','**/.seer-cache/**','**/dist/**']},proxy:{'/api':'http://127.0.0.1:3013','/seer':'http://127.0.0.1:3000'}},resolve:{alias:{buffer:'buffer/'}},worker:{format:'es'},build:{target:'esnext',outDir:'.seer-cache/animation-preview',emptyOutDir:true,minify:false,rollupOptions:{input:['tests/fixtures/petAnimationPreview.html','tests/fixtures/petBattlePreview.html']}}});
