# TinyWars

Jogo de estratégia em tempo real no navegador, no estilo Age of Empires e Warcraft. Você comanda um reino contra um **reino rival** controlado pela IA: coleta ouro, madeira e carne, constrói a base, treina tropas e destrói o castelo inimigo antes que ele derrube o seu.

Feito com Phaser 3, TypeScript e Vite. A arte é o **Tiny Swords (Free Pack)**, da [Pixel Frog](https://pixelfrog-assets.itch.io/tiny-swords) (veja [CREDITS.md](CREDITS.md)).

## Como rodar

Requisito: Node.js 22.12 ou mais novo.

**Jeito mais simples** — um único comando cuida de tudo (instala as dependências, baixa a arte e abre o jogo):

```bash
npm run play
```

No Windows, dá para dar duplo clique em [`jogar.bat`](jogar.bat) em vez de usar o terminal.

**Passo a passo manual**, se preferir mais controle:

```bash
npm install
npm run assets   # baixa a arte gratuita do itch.io para public/assets/
npm run dev      # abre o jogo no navegador
```

`npm run assets` baixa só os arquivos **gratuitos**:

- o **Free Pack**: toda a arte principal (unidades, construções, terreno, recursos, efeitos e interface);
- a versão antiga (CC0): só as peças que o Free Pack não tem (fundações de obra, ruínas e a caveira de morte).

Se o itch.io bloquear o download automático, o script explica como baixar à mão. Nesse caso, coloque os `.zip` em `assets-manual/` e rode o comando de novo.

## Controles

| Ação | Como |
|---|---|
| Selecionar | Clique esquerdo. Arraste para selecionar vários. Shift adiciona ou remove |
| Selecionar todos do mesmo tipo | Duplo clique ou Ctrl+clique |
| Mover, atacar, coletar, ajudar a construir | Clique direito (Shift enfileira ordens) |
| Ponto de encontro | Com uma construção selecionada, clique direito |
| Câmera | WASD ou setas, bordas da tela, botão do meio arrastando, minimapa |
| Zoom | Roda do mouse |
| Construir | `B` e depois `C` Casa, `Q` Quartel, `R` Arquearia, `M` Monastério, `T` Torre |
| Treinar | `P` Peão, `G` Guerreiro, `L` Lanceiro, `R` Arqueiro, `M` Monge |
| Atacar e mover / Manter posição / Parar | `F` / `H` / `X` |
| Entregar recursos | `E` |
| Grupos | `Ctrl+1..9` ou `Alt+1..9` para criar, `1..9` para selecionar (dois toques centralizam) |
| Peão ocioso / Castelo / Último alerta | `.` / `Home` / `Espaço` |
| Cancelar / Pausar | `Esc` |

## Unidades e construções

Os dois reinos têm as mesmas unidades e construções:

| Unidade | Onde treina | Papel |
|---|---|---|
| **Peão** | Castelo | Coleta e constrói, com a ferramenta certa: machado, picareta, faca ou martelo |
| **Guerreiro** | Quartel | Corpo a corpo com espada e escudo |
| **Lanceiro** | Quartel | Lança longa, muita vida e armadura, mais lento |
| **Arqueiro** | Arquearia | Flechas à distância |
| **Monge** | Monastério | Não luta: cura os aliados feridos por perto |

| Construção | Função |
|---|---|
| **Castelo** | Base principal (se cair, você perde). Treina peões e recebe recursos |
| **Casa** | +5 de população. Também recebe recursos |
| **Quartel**, **Arquearia**, **Monastério** | Treinam as tropas (o Monastério exige um Quartel) |
| **Torre** | Um arqueiro no topo atira nos invasores (exige um Quartel) |

Ouro vem das jazidas de pedras douradas (até 4 peões por vez; a pedra encolhe conforme se esgota), madeira das árvores (que viram tocos) e carne das ovelhas. As ovelhas renascem depois de um tempo.

**Cor do reino** (escolhida no menu): Azul, Vermelho, Amarelo, Roxo ou Preto. O reino rival fica com vermelho, ou preto se você escolher vermelho.

**Mapa:** ilha de 96×72 tiles gerada a cada partida, simétrica para os dois lados, com planaltos rochosos intransponíveis, jazidas de ouro contestadas e rebanhos de ovelhas no meio.

**Dificuldade** (escolhida no menu): Fácil, Normal ou Difícil. Muda a velocidade de decisão da IA, o ritmo de coleta, o tamanho das ondas e o primeiro ataque: cerca de 7, 5 e 3,5 minutos.

## Opções de depuração (na URL)

- `?nofog`: sem névoa de guerra
- `?fast`: jogo 4x mais rápido
- `?seed=123`: mapa fixo
- `?debug=anims`: mostra todas as animações das spritesheets
- `?debug=perf`: FPS, unidades e fila de caminhos

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes (A*, mapa, economia, combate, IA simulada, textos, manifesto de assets) |
| `npm run typecheck` | Checagem de tipos do jogo e dos testes |
| `npm run build` / `npm run preview` | Build de produção em `dist/` |
| `npm run assets:inspect` | Mostra grade e quadros de cada spritesheet baixada |

## Estrutura

```
scripts/        download e inspeção dos assets (itch.io)
src/
  core, data, entities, map, systems, ai   simulação pura, sem Phaser (roda nos testes)
  render, input, ui, scenes, game          Phaser: desenho, controles, HUD e cenas
  assets/assetManifest.ts                  todas as spritesheets e animações num lugar só
  i18n/pt-BR.ts                            todos os textos do jogo
```

A simulação roda em passo fixo de 20 Hz. O jogador e a IA usam a mesma API de comandos (`world.issue`). Os valores de balanceamento ficam em `src/data/`.

## Sobre a arte e o Enemy Pack

- A pasta `public/assets/` não é versionada. A licença do Free Pack proíbe redistribuir os arquivos, então não publique o `dist/` com eles.
- O **Enemy Pack** (22 monstros) é pago e nunca é baixado pelo script. Se você comprá-lo, coloque o `.zip` em `assets-manual/` e rode `npm run assets`: ele será extraído em `public/assets/enemy/`. Depois é preciso registrar cada monstro:
  - as spritesheets em `src/assets/assetManifest.ts`;
  - os atributos em `src/data/units.ts`.
