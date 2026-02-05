import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schemas',
  out: './drizzle',
  type: 'pg',
  dialect: 'postgresql'
});
