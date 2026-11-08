import { BRAND_NAME } from '../config/brand';
import type { InstalarPagina } from './instalar-pagina';

export const enInstalarPagina: InstalarPagina = {
  anyFile: `${BRAND_NAME}-v…-windows-x64-setup.exe`,
  sizeOnRelease: 'see the release',
  idleTitle: 'The app is not open on this PC',
  idleHelp: 'If you already installed it, just open it: this page notices on its own. If not, start with Download.',
  dlTitle: 'Download started',
  dlHelp: 'When it finishes, open the file and follow the installer. This page notices when the app opens.',
  stepNow: 'now',
  phoneTitle: 'The app is for Windows',
  phoneHelp: 'Open this page on your PC to download it. From here, you can send yourself the link.',
  sendLink: 'Send the link to your PC',
  copyLink: 'Copy the link',
  linkCopied: 'Link copied',
  checkLabel: 'Paste the hash PowerShell showed you',
  checkHint: 'You can paste the whole line: the page finds the hash in it.',
  checkOk: 'It matches. This is exactly the file we published.',
  checkBad: 'It does not match. Do not run this file: delete it and download it again from this page.',
  checkInvalid: 'That does not look like a SHA-256 (64 letters and digits).',
  checkPath: 'If you saved the file somewhere else, change the path in the command.',
  howToCheck: 'How to check',
  sheetOpen: 'On this page',
  sheetOpenSub: 'Contents and app notes',
  thisVersion: 'This version',
  thisVersionNotes: 'The notes for this version are on GitHub.',
  readNotes: 'Read the notes',
};
