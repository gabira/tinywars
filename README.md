# TinyWars

Jogo de estratégia em tempo real no navegador, no estilo Age of Empires e Warcraft. Você comanda os **Cavaleiros** contra os **Goblins** (IA): coleta ouro, madeira e carne, constrói a base, treina tropas e destrói a Toca Goblin antes que eles derrubem o seu Castelo.

Feito com Phaser 3, TypeScript e Vite. A arte é o pacote [Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords), da Pixel Frog (veja [CREDITS.md](CREDITS.md)).

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

- a versão antiga (CC0), que traz os Goblins;
- o Free Pack, opcional, com o quartel e os ícones.

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
| Construir | `B` e depois `C` Casa, `Q` Quartel, `T` Torre |
| Treinar | `P` Peão, `G` Guerreiro, `R` Arqueiro |
| Atacar e mover / Manter posição / Parar | `F` / `H` / `X` |
| Entregar recursos | `E` |
| Grupos | `Ctrl+1..9` ou `Alt+1..9` para criar, `1..9` para selecionar (dois toques centralizam) |
| Peão ocioso / Castelo / Último alerta | `.` / `Home` / `Espaço` |
| Cancelar / Pausar | `Esc` |

## Unidades e construções

| Cavaleiros (você) | Goblins (IA) |
|---|---|
| **Peão**: coleta e constrói | **Servo Goblin**: coleta e constrói |
| **Guerreiro**: corpo a corpo, resistente | **Goblin da Tocha**: corpo a corpo, rápido |
| **Arqueiro**: flechas à distância | **Goblin Dinamiteiro**: dinamite com dano em área |
| | **Barril Explosivo**: kamicaze, dano dobrado em construções |
| Castelo, Casa (+5 pop), Quartel, Torre | Toca Goblin, Cabana, Acampamento, Torre de Madeira |

Ouro vem da mina (até 3 peões por vez), madeira das árvores e carne das ovelhas. As ovelhas renascem depois de um tempo. Castelo e casas recebem os recursos.

**Cor do exército** (escolhida no menu): Azul, Vermelho, Roxo ou Amarelo. A IA fica com vermelho, ou azul se você escolher vermelho.

**Mapa:** ilha de 96×72 tiles gerada a cada partida, simétrica para os dois lados, com minas de ouro contestadas e rebanhos de ovelhas no meio.

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

- A pasta `public/assets/` não é versionada. A licença do Free Pack proíbe redistribuir os arquivos, então não publique o `dist/` com eles. Para uma versão pública, use `npm run assets -- --only=legacy` (só CC0); o quartel passa a usar um visual alternativo.
- O **Enemy Pack** (22 monstros) é pago e nunca é baixado pelo script. Se você comprá-lo, coloque o `.zip` em `assets-manual/` e rode `npm run assets`: ele será extraído em `public/assets/enemy/`. Depois é preciso registrar cada monstro:
  - as spritesheets em `src/assets/assetManifest.ts`;
  - os atributos em `src/data/units.ts`.
