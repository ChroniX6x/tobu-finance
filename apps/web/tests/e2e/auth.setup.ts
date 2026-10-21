import { test } from '@playwright/test';
import initializeRealAuth from './helpers/global-setup';

test('authenticate the real API test user', async () => {
  await initializeRealAuth();
});
