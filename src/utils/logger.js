export const logger = {
  info: (msg, data = '') => console.log(`[INFO] [${new Date().toISOString()}] ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg, data = '') => console.warn(`[WARN] [${new Date().toISOString()}] ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg, err = '') => console.error(`[ERROR] [${new Date().toISOString()}] ${msg}`, err),
  debug: (msg, data = '') => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] [${new Date().toISOString()}] ${msg}`, data);
    }
  }
};
