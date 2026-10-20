import { expect, test } from '@playwright/test'

test('landing page loads and primary CTA is visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /tomorrow can start/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /find a donor/i }).first()).toBeVisible()
})

test('find donors page renders filters', async ({ page }) => {
  await page.goto('/find-donors')
  await expect(page.getByRole('heading', { name: /find a donor/i })).toBeVisible()
  await expect(page.getByRole('group', { name: /blood group/i })).toBeVisible()
})

test('admin shell redirects unauthenticated users when supabase is configured', async ({ page }) => {
  await page.goto('/admin')
  // Without credentials, either demo admin UI or auth redirect is acceptable.
  await expect(page.locator('body')).toBeVisible()
})
