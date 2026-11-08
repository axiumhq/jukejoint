import { BRAND_NAME } from '../config/brand';
import type { AvGuide, InstalledItem } from './install';

export const enInstall = {
  installedItems: (appSize: string): InstalledItem[] => [
    { item: 'App', path: `%LOCALAPPDATA%\\${BRAND_NAME}\\`, size: appSize },
    { item: 'Settings and logs', path: `%APPDATA%\\${BRAND_NAME}\\`, size: 'under 1\u00a0MB' },
    { item: 'Downloaded modes', path: `[Deadlock folder in Steam]\\…\\addons\\${BRAND_NAME.toLowerCase()}\\`, size: '5 to 40\u00a0MB per mode' },
    { item: 'Shortcut', path: 'Start menu', size: '1\u00a0KB' },
  ],
  appDoes: [
    'Launches the game with the files for the mode you picked.',
    'Downloads modes on demand, only when you join one of their lobbies.',
    'Links this site to the game so the Join button works.',
    'Checks for updates when it opens and downloads new versions in the background.',
  ],
  appDoesnt: [
    'Never touches game files outside the addons folder.',
    'Does not keep running after you close the game.',
    'Never asks for your Steam password or reads your inventory.',
    'Installs nothing beyond what is listed above.',
  ],
  avGuides: (file: string): AvGuide[] => [
    {
      id: 'defender',
      name: 'Windows Defender',
      steps: [
        'Open the Start menu and search for "Windows Security".',
        'Go to "Virus & threat protection" and select "Protection history".',
        `Open the entry named ${file} or "${BRAND_NAME}".`,
        'Under "Actions", choose "Restore". If you see "Allow on device", choose that instead.',
        'Optional: under "Virus & threat protection settings", select "Manage settings", then "Add or remove exclusions", and exclude the app folder.',
      ],
    },
    {
      id: 'kaspersky',
      name: 'Kaspersky',
      steps: [
        'Open Kaspersky, go to "Security" and then "Quarantine" (in older versions: "More Tools", "Quarantine").',
        `Select ${file} or the file inside the ${BRAND_NAME} folder.`,
        'Click "Restore". The file goes back to where it was.',
        'Go to "Settings", "Threats and Exclusions", "Manage exclusions", and add the app folder.',
        'Run the installer or open the app again.',
      ],
    },
  ],
  hashCommand: (file: string | null) => `Get-FileHash "$env:USERPROFILE\\Downloads\\${file ?? `${BRAND_NAME}-v*-windows-x64-setup.exe`}"`,
};
