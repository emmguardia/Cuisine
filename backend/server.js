import 'dotenv/config';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;

createApp().listen(PORT, () => {
  console.log(`[cuisine-backend] :${PORT} — NODE_ENV=${process.env.NODE_ENV || 'development'}`);
});
