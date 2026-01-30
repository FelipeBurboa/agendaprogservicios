import { chromium, type Page, type BrowserContext } from 'playwright';

async function login(page: Page): Promise<void> {
  console.log('Navigating to sign-in page...');
  await page.goto('https://app.agendapro.com/sign_in', { waitUntil: 'networkidle' });
  console.log('Page loaded:', await page.title());

  await page.screenshot({ path: 'before-login.png' });
  console.log('Screenshot saved: before-login.png');

  // Fill email
  const emailInput = page.locator(
    'input[type="email"], input[name="email"], input[name="user[email]"], input#user_email, input[placeholder*="mail"], input[placeholder*="correo"]'
  ).first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('gerencia@clubdelabarba.cl');
  console.log('Email filled');

  // Fill password
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill('CLUB6488');
  console.log('Password filled');

  await page.screenshot({ path: 'fields-filled.png' });
  console.log('Screenshot saved: fields-filled.png');

  // Click login button
  const loginButton = page.locator(
    'button[type="submit"], input[type="submit"], button:has-text("Iniciar"), button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Ingresar")'
  ).first();
  await loginButton.click();
  console.log('Login button clicked');

  // Wait for navigation
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('Current URL after login:', page.url());
  console.log('Page title:', await page.title());

  await page.screenshot({ path: 'after-login.png' });
  console.log('Screenshot saved: after-login.png');
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  const context: BrowserContext = await browser.newContext();
  const page: Page = await context.newPage();

  try {
    await login(page);

    // Save auth state for future use
    await context.storageState({ path: 'auth-state.json' });
    console.log('Auth state saved to auth-state.json');

    console.log('\nLogin complete! Browser will stay open for 60 seconds...');
    console.log('Press Ctrl+C to close earlier.');
    await page.waitForTimeout(60000);
  } catch (err) {
    console.error('Error:', (err as Error).message);
    await page.screenshot({ path: 'error-screenshot.png' });
    console.log('Error screenshot saved');
  } finally {
    await browser.close();
  }
}

main();
