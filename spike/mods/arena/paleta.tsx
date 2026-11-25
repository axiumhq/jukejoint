// As cores e as peças pequenas que a Arena usa na tela, no mesmo desenho do painel de votação
// (.design/arena-hud/opcoes.html, opção A). Os tamanhos aqui já estão no HUD de 1080 de altura
// (o desenho é de 900, então cada medida do desenho vezes 1,2). As faces de letra são as do
// próprio jogo (theme.types): o corpo para o texto e a de capitulares para títulos e números.
import { type Child, type Player, type Style, theme } from 'modlock'

/** As cores (#rrggbbaa quando têm transparência). */
export const P = {
  /** O fundo dos painéis sobre o mapa. */
  panel: '#161210db',
  /** As linhas finas: entre seções e nas bordas. */
  line: '#e7dccb24',
  /** A linha um pouco mais forte, dos controles. */
  line2: '#e7dccb47',
  /** O latão: o que está valendo, os botões principais. */
  brass: '#c8a46a',
  /** O texto sobre o latão. */
  brassInk: '#1a161c',
  /** O latão bem fraco, por trás do que vale. */
  brassSoft: '#c8a46a29',
  /** O marfim do texto, e dois tons abaixo dele. */
  ink: '#e7dccb',
  ink2: '#cac3b9',
  ink3: '#a59d94',
  /** Pronto. */
  ok: '#9cc98a',
  /** Aviso: falta gente, fora do círculo. */
  warn: '#e58b6b',
  /** Os dois lados. */
  amber: '#e3a45a',
  sapphire: '#8db4e6',
  /** O fundo das pílulas de pessoa e da tecla. */
  chip: '#ffffff0d',
  /** O círculo da inicial de quem não tem herói. */
  avatar: '#4a2c49',
  shadow: '#00000073',
  clear: '#00000000',
} as const

/** A cor de cada lado: o lado 0 joga no time âmbar, o lado 1 no safira. */
export const SIDE_COLORS: readonly string[] = [P.amber, P.sapphire]

/** As faces do jogo: o corpo do texto e as capitulares de títulos e números. */
export const FACE = { body: theme.types.body.face, block: theme.types.title.face } as const

/** Uma porcentagem como medida de painel. */
export const pct = (n: number): `${number}%` => `${Math.round(Math.max(0, Math.min(100, n)))}%`

/** Um texto: tamanho, cor e peso; com sombra quando fica direto sobre o mapa. */
export function L(props: {
  size: number
  color?: string
  weight?: Style['weight']
  block?: boolean
  upper?: boolean
  spacing?: number
  /** shadow: o texto fica sobre o mapa, sem painel por trás. */
  shadow?: boolean
  style?: Style
  children?: Child
}) {
  return (
    <label
      style={{
        face: props.block ? FACE.block : FACE.body,
        fontSize: props.size,
        color: props.color ?? P.ink,
        weight: props.weight,
        uppercase: props.upper,
        letterSpacing: props.spacing,
        shadow: props.shadow,
        ...props.style,
      }}
    >
      {props.children}
    </label>
  )
}

/** O título pequeno de uma seção, em capitulares apagadas. */
export function Heading(props: { children?: Child; style?: Style }) {
  return (
    <L size={15} block upper spacing={1} color={P.ink3} style={{ margin: [0, 0, 12, 0], ...props.style }}>
      {props.children}
    </L>
  )
}

/** O painel sobre o mapa: fundo escuro translúcido, linha fina e sombra macia. */
export const surface: Style = {
  background: P.panel,
  borderWidth: 1,
  borderColor: P.line,
  borderRadius: 8,
  boxShadow: { x: 0, y: 14, blur: 38, color: P.shadow },
}

/** Um botão de contorno, discreto: Trocar, os bots, Fechar. */
export function Outline(props: {
  children?: Child
  onPress: (player: Player) => void
  tooltip?: string
  style?: Style
}) {
  return (
    <button
      tooltip={props.tooltip}
      onPress={props.onPress}
      sound={theme.sounds.press}
      hoverSound={theme.sounds.hover}
      style={{ padding: [7, 14], borderRadius: 4, borderWidth: 1, borderColor: P.line2, transition: 0.15, ...props.style }}
      hover={{ background: P.brassSoft, borderColor: P.brass }}
    >
      <L size={17} color={P.brass} style={{ horizontalAlign: 'center', verticalAlign: 'center', noWrap: true }}>
        {props.children}
      </L>
    </button>
  )
}

/** A linha fina entre seções. */
export function Rule() {
  return <panel style={{ width: '100%', height: 1, background: P.line }} />
}
