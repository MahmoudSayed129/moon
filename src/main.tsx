import { createRoot } from 'react-dom/client'
// Registers the demo dataset before anything reads the local store.
import './lib/demo-seed'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
