import './style.css';
import { SceneManager } from './SceneManager.js';

const canvas = document.getElementById('canvas');
const sceneManager = new SceneManager(canvas);

sceneManager.init().then(() => {
  sceneManager.start();
}).catch((error) => {
  console.error('Failed to initialize scene:', error);
  const message = error instanceof Error
    ? `Không thể tải mô phỏng: ${error.message}`
    : 'Không thể tải mô phỏng. Kiểm tra console để xem chi tiết.';
  sceneManager.ui?.showLoadingError(message);
});
