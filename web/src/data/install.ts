import { APP_RELEASE, BRAND_NAME } from '../config/brand';

export interface InstalledItem {
  item: string;
  path: string;
  size: string;
}

export const installedItems: InstalledItem[] = [
  { item: 'Aplicativo', path: `%LOCALAPPDATA%\\${BRAND_NAME}\\app\\`, size: '31,2 MB' },
  { item: 'Configurações e registros', path: `%APPDATA%\\${BRAND_NAME}\\`, size: 'menos de 1 MB' },
  { item: 'Modos baixados', path: `Steam\\steamapps\\common\\Deadlock\\game\\citadel\\addons\\${BRAND_NAME.toLowerCase()}\\`, size: '5 a 40 MB por modo' },
  { item: 'Atalho', path: 'Menu Iniciar', size: '—' },
];

export const appDoes: string[] = [
  'Abre o Deadlock com os arquivos do modo escolhido.',
  'Baixa modos sob demanda, só quando você entra num lobby deles.',
  'Conecta este site ao jogo para o botão Entrar funcionar.',
  'Verifica atualizações ao abrir. Você decide quando instalar.',
];

export const appDoesnt: string[] = [
  'Não altera arquivos do jogo fora da pasta de addons.',
  'Não roda em segundo plano depois que você fecha o jogo.',
  'Não pede senha da Steam nem acessa seu inventário.',
  'Não instala nada além do que está na lista acima.',
];

export interface AvGuide {
  id: string;
  name: string;
  steps: string[];
}

export const avGuides: AvGuide[] = [
  {
    id: 'defender',
    name: 'Windows Defender',
    steps: [
      'Abra o menu Iniciar e procure por "Segurança do Windows".',
      'Entre em "Proteção contra vírus e ameaças" e clique em "Histórico de proteção".',
      `Abra o item com o nome ${APP_RELEASE.fileName} ou "${BRAND_NAME}".`,
      'Em "Ações", escolha "Restaurar". Se aparecer "Permitir no dispositivo", escolha essa opção.',
      'Opcional: em "Configurações de proteção contra vírus e ameaças", adicione uma exclusão para a pasta do aplicativo.',
    ],
  },
  {
    id: 'kaspersky',
    name: 'Kaspersky',
    steps: [
      'Abra o Kaspersky e vá em "Segurança" e depois em "Quarentena" (em versões antigas: "Mais ferramentas", "Quarentena").',
      `Selecione ${APP_RELEASE.fileName} ou o arquivo dentro da pasta ${BRAND_NAME}.`,
      'Clique em "Restaurar". O arquivo volta para o lugar original.',
      'Em "Configurações", "Ameaças e exclusões", "Gerenciar exclusões", adicione a pasta do aplicativo.',
      'Rode o instalador ou abra o app de novo.',
    ],
  },
];

export const hashCommand = `Get-FileHash .\\${APP_RELEASE.fileName} -Algorithm SHA256`;
