/**
 * Textos da página Instalar que dependem de dados (nome do arquivo, tamanho) ou que são listas
 * longas: o que é instalado, o que o app faz e não faz, os guias de antivírus e o comando de hash.
 * Como live.ts, ficam fora de pt-BR.ts. O inglês está em en-install.ts.
 */
import { BRAND_NAME } from '../config/brand';
import { enInstall } from './en-install';
import { getLocale } from './locale';

export interface InstalledItem {
  item: string;
  path: string;
  size: string;
}

export interface AvGuide {
  id: string;
  name: string;
  steps: string[];
}

const ptBRInstall = {
  /** `size` já vem formatado (ex.: "38,2"), da release usada na página. */
  installedItems: (size: string): InstalledItem[] => [
    { item: 'Aplicativo', path: `%LOCALAPPDATA%\\${BRAND_NAME}\\`, size: `${size}\u00a0MB` },
    { item: 'Configurações e registros', path: `%APPDATA%\\${BRAND_NAME}\\`, size: 'menos de 1\u00a0MB' },
    { item: 'Modos baixados', path: `[pasta do jogo na Steam]\\…\\addons\\${BRAND_NAME.toLowerCase()}\\`, size: '5 a 40\u00a0MB por modo' },
    { item: 'Atalho', path: 'Menu Iniciar', size: '1\u00a0KB' },
  ],
  appDoes: [
    'Abre o jogo com os arquivos do modo escolhido.',
    'Baixa modos sob demanda, só quando você entra num lobby deles.',
    'Conecta este site ao jogo para o botão Entrar funcionar.',
    'Procura atualizações ao abrir e baixa a nova versão em segundo plano.',
  ],
  appDoesnt: [
    'Não altera arquivos do jogo fora da pasta de addons.',
    'Não roda em segundo plano depois que você fecha o jogo.',
    'Não pede senha da Steam nem acessa seu inventário.',
    'Não instala nada além do que está na lista acima.',
  ],
  avGuides: (file: string): AvGuide[] => [
    {
      id: 'defender',
      name: 'Windows Defender',
      steps: [
        'Abra o menu Iniciar e procure por "Segurança do Windows".',
        'Entre em "Proteção contra vírus e ameaças" e clique em "Histórico de proteção".',
        `Abra o item com o nome ${file} ou "${BRAND_NAME}".`,
        'Em "Ações", escolha "Restaurar". Se aparecer "Permitir no dispositivo", escolha essa opção.',
        'Opcional: em "Configurações de proteção contra vírus e ameaças", adicione uma exclusão para a pasta do aplicativo.',
      ],
    },
    {
      id: 'kaspersky',
      name: 'Kaspersky',
      steps: [
        'Abra o Kaspersky e vá em "Segurança" e depois em "Quarentena" (em versões antigas: "Mais ferramentas", "Quarentena").',
        `Selecione ${file} ou o arquivo dentro da pasta ${BRAND_NAME}.`,
        'Clique em "Restaurar". O arquivo volta para o lugar original.',
        'Em "Configurações", "Ameaças e exclusões", "Gerenciar exclusões", adicione a pasta do aplicativo.',
        'Rode o instalador ou abra o app de novo.',
      ],
    },
  ],
  hashCommand: (file: string) => `Get-FileHash .\\${file} -Algorithm SHA256`,
};

export type InstallTexts = typeof ptBRInstall;

export const installTexts: InstallTexts = new Proxy(ptBRInstall, {
  get(_target, property, receiver) {
    return Reflect.get(getLocale() === 'en' ? enInstall : ptBRInstall, property, receiver);
  },
});
