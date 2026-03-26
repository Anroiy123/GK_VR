import './style.css';
import { SceneManager } from './SceneManager.js';

const canvas = document.getElementById('canvas');
const sceneManager = new SceneManager(canvas);

sceneManager.init().then(() => {
  sceneManager.start();
}).catch((error) => {
  console.error('Failed to initialize scene:', error);
});
