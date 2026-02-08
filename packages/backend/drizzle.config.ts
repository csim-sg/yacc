import { defineConfig } from 'drizzle-kit';

const getDbUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  // Build from individual env vars for local development
  const user = process.env.DB_USER || 'yacc_user';
  const password = process.env.DB_PASSWORD || 'yacc_password';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'yacc_inbox';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
};

export default defineConfig({
  schema: ['./src/schemas/**/*.ts', './src/enums/**/*.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDbUrl(),
  },
});
