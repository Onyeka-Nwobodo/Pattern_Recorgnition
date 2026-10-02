import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
const hostContext = await browser.newContext();
const playerContext = await browser.newContext();
const host = await hostContext.newPage();
const player = await playerContext.newPage();

host.on('console', msg => console.log('HOST CONSOLE:', msg.type(), msg.text()));
host.on('pageerror', err => console.log('HOST PAGEERROR:', err.message));
player.on('console', msg => console.log('PLAYER CONSOLE:', msg.type(), msg.text()));
player.on('pageerror', err => console.log('PLAYER PAGEERROR:', err.message));

const base = 'http://127.0.0.1:8000/?v=50';

try {
  await host.goto(base, {waitUntil:'domcontentloaded'});
  await host.click('#hostChoice');
  await host.click('#createRoom');
  await host.waitForSelector('#hostApp:not(.hidden)', {timeout:20000});
  await host.waitForFunction(() => document.querySelector('#netText')?.textContent?.includes('Room online'), null, {timeout:20000});

  const room = (await host.textContent('#roomCodeDisplay')).trim();
  if (!/^[A-Z0-9]{6}$/.test(room)) throw new Error('Host did not create a valid room code: ' + room);

  await player.goto(base + '&room=' + room, {waitUntil:'domcontentloaded'});
  await player.fill('#playerName', 'Test Student');
  await player.click('#joinRoom');

  await host.waitForFunction(() => {
    const text = document.querySelector('#hostPlayers')?.textContent || '';
    return text.includes('Test Student') && text.includes('Ready');
  }, null, {timeout:25000});

  await player.waitForFunction(() => {
    const text = document.querySelector('#playerWelcome')?.textContent || '';
    return text.includes('Ready') && !document.querySelector('#playerApp')?.classList.contains('hidden');
  }, null, {timeout:25000});

  const disabled = await host.isDisabled('#startGame');
  if (disabled) throw new Error('Start game remained disabled after Test Student became Ready.');

  await host.click('#startGame');
  await host.waitForSelector('#hostRound:not(.hidden)', {timeout:10000});
  await player.waitForSelector('#playerRound:not(.hidden)', {timeout:15000});

  const hostLabel = (await host.textContent('#hostRoundLabel')).trim();
  const playerLabel = (await player.textContent('#playerRoundLabel')).trim();
  if (!hostLabel.startsWith('Word 1 /')) throw new Error('Host did not enter Word 1: ' + hostLabel);
  if (!playerLabel.startsWith('Word 1 /')) throw new Error('Player did not enter Word 1: ' + playerLabel);

  console.log('PASS');
  console.log(JSON.stringify({room, hostLabel, playerLabel}));
} catch (err) {
  console.error('FAIL:', err);
  console.error('HOST STATUS:', await host.locator('body').innerText().catch(()=>'')); 
  console.error('PLAYER STATUS:', await player.locator('body').innerText().catch(()=>'')); 
  process.exitCode = 1;
} finally {
  await browser.close();
}
