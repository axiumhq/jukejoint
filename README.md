<p align="center">
  <img src="web/src/assets/brand/simbolo-jj.svg" alt="Símbolo do Jukejoint" width="112">
</p>

<h1 align="center">Jukejoint</h1>

<p align="center">Salas da comunidade para jogar modos personalizados de Deadlock com outras pessoas.</p>

<p align="center">
  <a href="https://github.com/axiumhq/jukejoint/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/axiumhq/jukejoint/ci.yml?branch=main&label=CI" alt="Status do CI"></a>
  <a href="https://github.com/axiumhq/jukejoint/releases/latest"><img src="https://img.shields.io/github/v/release/axiumhq/jukejoint?label=vers%C3%A3o" alt="Última versão"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-propriet%C3%A1ria-6b5548" alt="Software proprietário"></a>
  <img src="https://img.shields.io/badge/app_desktop-Windows-0078D4" alt="App desktop para Windows">
</p>

**Jukejoint** é um projeto independente para a comunidade de Deadlock no Brasil e na América Latina. Pelo site ou app para Windows, você encontra uma sala, entra pela Steam e inicia o modo escolhido.

O jogo roda no computador de quem hospeda a sala. Os demais computadores se conectam diretamente por P2P. A API do Jukejoint cuida do login, da lista de salas e da sinalização necessária para os jogadores se encontrarem. O app usa o [Modlock](https://github.com/paralin/modlock), fixado por versão e verificado por SHA-256.

> O Jukejoint é software proprietário. O código está público para permitir inspeção e dar transparência aos releases. Publicar o repositório não concede licença para usar, modificar ou redistribuir o software. Consulte [LICENSE](LICENSE) e [CONTRIBUTING.md](CONTRIBUTING.md).

O projeto não é afiliado à Valve. Deadlock é uma marca da Valve Corporation.

## Baixar

Baixe o instalador mais recente do Windows na [página de releases](https://github.com/axiumhq/jukejoint/releases/latest). O instalador inclui o app, os modos disponíveis e a versão do Modlock fixada para aquele release. O app verifica atualizações antes de abrir a janela principal.

## Modos disponíveis

| Modo | Estado |
| --- | --- |
| Duelo à Meia-Noite | Modo jogável de 1 contra 1, com melhor de cinco e seleção compartilhada de herói. |
| Campo de Treino | Modo jogável para praticar contra alvos e usar comandos de treino. |
| Círculo Profano, Último Bonde, Neblina e Cerco ao Cofre | Aparecem no catálogo, mas ainda iniciam o modo de teste. |

Os modos ficam em `spike/mods/`. Cada modo tem seu próprio README com instruções e cobertura de testes.

## Como funciona

```text
Site e app Windows
        │
        ├── API: login Steam, salas, presença e convites
        └── Modlock: inicia o modo e conecta os computadores por P2P

API e sinalização: hospedadas no Raspberry Pi do projeto
```

O site (`web/`) e o app desktop (`desktop/`) usam a API em Go (`server/`). O serviço de sinalização (`spike/signal/`) ajuda os processos Modlock a estabelecer a conexão. A API e a sinalização são implantadas a partir das imagens Docker publicadas no GHCR; a configuração de infraestrutura fica no repositório [`axiumhq/infra-pi`](https://github.com/axiumhq/infra-pi).

## Executar localmente

### Site com dados de demonstração

Requer Node.js 24 e npm.

```bash
npm ci --prefix web
npm run dev --prefix web
```

Abra `http://localhost:5173`. Sem `VITE_API_URL`, o site usa dados simulados.

### Site com API local

Requer Go na versão indicada em `server/go.mod`.

```bash
cd server
DEV_LOGIN=1 go run .
```

Em outro terminal:

```bash
npm ci --prefix web
VITE_API_URL=http://localhost:8090 npm run dev --prefix web
```

O login `DEV_LOGIN=1` serve somente para desenvolvimento local. Para configurar autenticação Steam e outras variáveis, consulte [`server/README.md`](server/README.md).

### App desktop

O app desktop é desenvolvido e empacotado para Windows. Requer Node.js 24, Rust 1.99.1, MSVC Build Tools 2022, Windows SDK e WebView2.

```powershell
npm ci --prefix web
npm ci --prefix desktop
powershell -ExecutionPolicy Bypass -File scripts\install-modlock.ps1
$env:MODLOCK_BIN = "$PWD\tools\modlock-v0.1.73\modlock.exe"
cd desktop
npx tauri dev
```

Deadlock precisa estar instalado pela Steam para iniciar um modo no jogo. Mais detalhes de desenvolvimento, configuração e build estão em [`desktop/README.md`](desktop/README.md).

## Estrutura do repositório

| Caminho | Conteúdo |
| --- | --- |
| `web/` | Site em React, Vite e TypeScript; também é carregado pelo app desktop. |
| `desktop/` | Interface do app e integração Tauri/Rust com o sistema e o Modlock. |
| `server/` | API em Go para login Steam, salas, presença e convites. |
| `spike/signal/` | Serviço Go de sinalização P2P. |
| `spike/mods/` | Modos personalizados e seus testes. |
| `scripts/` | Instalação do Modlock e ferramentas para builds e testes locais. |
| `docs/` | Decisões de arquitetura, integração, design e auditorias. |
| `.github/workflows/` | CI, fila de merge, builds de release e imagens de servidor. |

O diretório local `tools/` não é versionado. O script de instalação baixa o Modlock esperado e valida o hash antes de usá-lo.

## Verificações

Os comandos abaixo são os principais checks locais. O workflow de CI seleciona os checks conforme os caminhos alterados no PR.

| Área | Comando |
| --- | --- |
| Site | `npm test --prefix web` e `npm run build --prefix web` |
| Interface desktop | `npm run typecheck --prefix desktop` |
| Rust desktop | `cargo test --manifest-path desktop/src-tauri/Cargo.toml` |
| API | `cd server && go vet ./... && go test ./...` |
| Sinalização | `cd spike/signal && go vet ./... && go test ./...` |

## CI e releases

- O workflow `CI` roda os checks das partes alteradas e fornece um check agregado para PRs.
- PRs aprovados e com CI verde podem entrar na merge queue.
- O workflow de release cria a release e calcula a versão a partir das mudanças classificadas.
- O build desktop publica o instalador Windows, a assinatura do atualizador e `latest.json` na release.
- O workflow de imagens publica as imagens da API e da sinalização no GHCR e abre PR de atualização no `infra-pi`.

Consulte a [página de Actions](https://github.com/axiumhq/jukejoint/actions) para o estado atual dos workflows e a [página de releases](https://github.com/axiumhq/jukejoint/releases) para os artefatos publicados.

## Contribuir

Contribuições são bem-vindas por pull request. Antes de abrir um, leia [CONTRIBUTING.md](CONTRIBUTING.md), que explica o processo e os direitos concedidos para contribuições aceitas. O projeto continua proprietário.

## Documentação

- [App desktop](desktop/README.md)
- [API](server/README.md)
- [Sinalização](spike/signal/README.md)
- [Decisão de plataforma](docs/decisao-plataforma.md)
- [Adaptador do Modlock](docs/engine-adapter.md)
- [Primeiro teste entre dois PCs](docs/spike-fase-0.md)
