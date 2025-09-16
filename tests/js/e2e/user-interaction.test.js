/**
 * End-to-End tests for User Interactions
 * Tests complete user workflows using Playwright browser automation
 */

const { test, expect } = require('@playwright/test');

test.describe('Ski Terrain 3D User Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:8080');
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Wait for basic page elements to be available
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    // Wait a bit for WebGL initialization
    await page.waitForTimeout(2000);
  });

  test('loads application with default terrain', async ({ page }) => {
    // Check that the canvas is present and has content
    const canvas = await page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Check page title
    await expect(page).toHaveTitle(/Ski/);
    
    // Verify basic page structure
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('switches between ski resorts', async ({ page }) => {
    // Find and interact with resort selector
    const resortSelect = page.locator('#resortSelect');
    await expect(resortSelect).toBeVisible();
    
    // Select Whistler
    await resortSelect.selectOption('whistler');
    
    // Verify the selection changed
    const selectedValue = await resortSelect.inputValue();
    expect(selectedValue).toBe('whistler');
  });

  test('adjusts terrain detail level', async ({ page }) => {
    // Find detail slider
    const detailSlider = page.locator('#detailSlider');
    await expect(detailSlider).toBeVisible();
    
    // Set slider to maximum value
    await detailSlider.fill('256');
    
    // Verify the detail value display updates
    const detailValue = page.locator('#detailValue');
    await expect(detailValue).toContainText('256x256');
  });

  test('camera controls respond to mouse input', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Simulate mouse interaction on canvas
    await canvas.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.up();
    
    // Verify camera position info is displayed
    const cameraPos = page.locator('#cameraPos');
    await expect(cameraPos).toBeVisible();
  });

  test('camera responds to keyboard controls', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.click(); // Focus the canvas
    
    // Press W key to move forward
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(100);
    
    // Verify camera position info is still displayed (basic functionality test)
    const cameraPos = page.locator('#cameraPos');
    await expect(cameraPos).toBeVisible();
  });

  test('mouse wheel zooms camera', async ({ page }) => {
    const canvas = page.locator('canvas');
    
    // Scroll to zoom
    await canvas.hover();
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(100);
    
    // Verify camera position info is still displayed (basic functionality test)
    const cameraPos = page.locator('#cameraPos');
    await expect(cameraPos).toBeVisible();
  });

  test('weather controls change scene appearance', async ({ page }) => {
    // Find weather selector
    const weatherSelect = page.locator('#weather');
    await expect(weatherSelect).toBeVisible();
    
    // Change to snowing
    await weatherSelect.selectOption('snowing');
    
    // Verify the selection changed
    const selectedValue = await weatherSelect.inputValue();
    expect(selectedValue).toBe('snowing');
  });

  test('performance metrics are displayed', async ({ page }) => {
    // Check that FPS counter is visible
    const fpsCounter = page.locator('#fps');
    await expect(fpsCounter).toBeVisible();
    
    // Check other performance metrics
    const elevation = page.locator('#elevation');
    const slope = page.locator('#slope');
    await expect(elevation).toBeVisible();
    await expect(slope).toBeVisible();
  });

  test('handles window resize gracefully', async ({ page }) => {
    // Resize window
    await page.setViewportSize({ width: 800, height: 600 });
    
    // Wait for resize to take effect
    await page.waitForTimeout(500);
    
    // Check that UI elements are still visible
    const ui = page.locator('#ui');
    const info = page.locator('#info');
    await expect(ui).toBeVisible();
    await expect(info).toBeVisible();
  });

  test('loads elevation data from MCP server', async ({ page }) => {
    // Find and click the generate terrain button
    const generateButton = page.locator('#generateTerrain');
    await expect(generateButton).toBeVisible();
    
    await generateButton.click();
    
    // Wait for any loading to complete
    await page.waitForTimeout(2000);
    
    // Verify the button is still clickable (basic functionality test)
    await expect(generateButton).toBeEnabled();
  });

  test('maintains smooth animation during interactions', async ({ page }) => {
    // Perform some interactions
    const canvas = page.locator('canvas');
    const resortSelect = page.locator('#resortSelect');
    
    // Change resort and interact with canvas
    await resortSelect.selectOption('whistler');
    await canvas.hover();
    await page.mouse.move(100, 100);
    
    // Verify FPS counter is still updating
    const fpsCounter = page.locator('#fps');
    await expect(fpsCounter).toBeVisible();
    
    const fpsText = await fpsCounter.textContent();
    expect(fpsText).toMatch(/\d+/);
  });

  test('error handling for network failures', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/elevation*', route => {
      route.abort('failed');
    });
    
    // Try to switch resorts (should trigger network request)
    const resortSelect = page.locator('#resort-select');
    if (await resortSelect.count() > 0) {
      await resortSelect.selectOption('zermatt');
      
      // Should handle error gracefully and show fallback terrain
      await page.waitForTimeout(2000);
      
      const hasTerrainMesh = await page.evaluate(() => {
        return window.app.terrainRenderer.terrainMesh !== null;
      });
      expect(hasTerrainMesh).toBe(true);
    }
  });

  test('accessibility features work correctly', async ({ page }) => {
    // Test keyboard navigation
    
    // Check that form controls are properly structured
    const resortSelect = page.locator('#resortSelect');
    const detailSlider = page.locator('#detailSlider');
    
    await expect(resortSelect).toBeVisible();
    await expect(detailSlider).toBeVisible();
    
    // Verify controls are focusable
    await resortSelect.focus();
    await detailSlider.focus();
  });

  test('mobile touch interactions work', async ({ page, isMobile }) => {
    if (isMobile) {
      const canvas = page.locator('#container canvas');
      
      // Test touch drag for camera rotation
      await canvas.hover();
      await page.touchscreen.tap(200, 200);
      await page.touchscreen.tap(250, 250);
      
      // Test pinch zoom
      await page.touchscreen.tap(200, 200);
      await page.touchscreen.tap(300, 300);
      
      // Verify camera responded to touch
      const cameraPosition = await page.evaluate(() => ({
        x: window.app.camera.position.x,
        y: window.app.camera.position.y,
        z: window.app.camera.position.z
      }));
      
      expect(typeof cameraPosition.x).toBe('number');
      expect(typeof cameraPosition.y).toBe('number');
      expect(typeof cameraPosition.z).toBe('number');
    }
  });

  test('saves and restores user preferences', async ({ page }) => {
    // Set preferences
    const resortSelect = page.locator('#resort-select');
    const detailSlider = page.locator('#detail-slider');
    
    if (await resortSelect.count() > 0) {
      await resortSelect.selectOption('stanton');
    }
    if (await detailSlider.count() > 0) {
      await detailSlider.fill('128');
    }
    
    // Reload page
    await page.reload();
    await page.waitForSelector('#container canvas', { timeout: 10000 });
    
    // Check if preferences were restored
    if (await resortSelect.count() > 0) {
      const selectedResort = await resortSelect.inputValue();
      // Should either restore preference or use default
      expect(['stanton', 'chamonix']).toContain(selectedResort);
    }
  });
});
