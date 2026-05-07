import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`EduNook payment API running on http://localhost:${env.port}`);
});
