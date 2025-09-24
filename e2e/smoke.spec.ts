import { test, expect } from '@playwright/test';

test('ping responde 200', async ({ request }) => {
  const res = await request.get('/api/ping');
  expect(res.ok()).toBeTruthy();
});
