import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { loadImportedElves } from './data/defaultElves';
import './index.css';

// 匯入精靈（延後載入的資料區塊）在第一次繪製前取得：精靈清單從第一幀就完整，
// 不會在使用者保存的隊伍還原之後才改變清單（StartScreen 會依清單同步隊伍）。載入失敗時以不含匯入精靈的清單繼續。
loadImportedElves()
  .catch(error => console.warn('[匯入精靈] 載入失敗，以不含匯入精靈的清單繼續', error))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
