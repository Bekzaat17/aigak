import { chromium } from 'playwright';
import { createNativeSession } from './create-native-session';
export const openNativeSession = createNativeSession(async (options, viewport) => {
  const browser = await chromium.launch(options);
  try {
    const context = await browser.newContext({
      viewport,
      locale: 'ru-RU',
      timezoneId: 'Asia/Almaty',
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    return { context, close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
});
