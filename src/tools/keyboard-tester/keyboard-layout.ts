export type RowSpacer = {
  type: 'spacer'
  width: number
}

export type RowKey = {
  type: 'key'
  code: string
  label: string
  secondaryLabel?: string
  hint?: string
  width?: number
  align?: 'left' | 'center' | 'right'
}

export type RowItem = RowSpacer | RowKey

export type GridKey = {
  code: string
  label: string
  secondaryLabel?: string
  hint?: string
  col: number
  row: number
  width?: number
  height?: number
  align?: 'left' | 'center' | 'right'
}

export const functionRow: RowItem[] = [
  { type: 'key', code: 'Escape', label: 'Esc', hint: '系统' },
  { type: 'spacer', width: 1 },
  { type: 'key', code: 'F1', label: 'F1' },
  { type: 'key', code: 'F2', label: 'F2' },
  { type: 'key', code: 'F3', label: 'F3' },
  { type: 'key', code: 'F4', label: 'F4' },
  { type: 'spacer', width: 0.5 },
  { type: 'key', code: 'F5', label: 'F5' },
  { type: 'key', code: 'F6', label: 'F6' },
  { type: 'key', code: 'F7', label: 'F7' },
  { type: 'key', code: 'F8', label: 'F8' },
  { type: 'spacer', width: 0.5 },
  { type: 'key', code: 'F9', label: 'F9' },
  { type: 'key', code: 'F10', label: 'F10' },
  { type: 'key', code: 'F11', label: 'F11' },
  { type: 'key', code: 'F12', label: 'F12' },
  { type: 'spacer', width: 0.5 },
  { type: 'key', code: 'PrintScreen', label: 'PrtSc' },
  { type: 'key', code: 'ScrollLock', label: 'Scroll' },
  { type: 'key', code: 'Pause', label: 'Pause' }
]

export const alphaRows: RowItem[][] = [
  [
    { type: 'key', code: 'Backquote', label: '`', secondaryLabel: '~' },
    { type: 'key', code: 'Digit1', label: '1', secondaryLabel: '!' },
    { type: 'key', code: 'Digit2', label: '2', secondaryLabel: '@' },
    { type: 'key', code: 'Digit3', label: '3', secondaryLabel: '#' },
    { type: 'key', code: 'Digit4', label: '4', secondaryLabel: '$' },
    { type: 'key', code: 'Digit5', label: '5', secondaryLabel: '%' },
    { type: 'key', code: 'Digit6', label: '6', secondaryLabel: '^' },
    { type: 'key', code: 'Digit7', label: '7', secondaryLabel: '&' },
    { type: 'key', code: 'Digit8', label: '8', secondaryLabel: '*' },
    { type: 'key', code: 'Digit9', label: '9', secondaryLabel: '(' },
    { type: 'key', code: 'Digit0', label: '0', secondaryLabel: ')' },
    { type: 'key', code: 'Minus', label: '-', secondaryLabel: '_' },
    { type: 'key', code: 'Equal', label: '=', secondaryLabel: '+' },
    { type: 'key', code: 'Backspace', label: 'Backspace', width: 2, align: 'left' }
  ],
  [
    { type: 'key', code: 'Tab', label: 'Tab', width: 1.5, align: 'left' },
    { type: 'key', code: 'KeyQ', label: 'Q' },
    { type: 'key', code: 'KeyW', label: 'W' },
    { type: 'key', code: 'KeyE', label: 'E' },
    { type: 'key', code: 'KeyR', label: 'R' },
    { type: 'key', code: 'KeyT', label: 'T' },
    { type: 'key', code: 'KeyY', label: 'Y' },
    { type: 'key', code: 'KeyU', label: 'U' },
    { type: 'key', code: 'KeyI', label: 'I' },
    { type: 'key', code: 'KeyO', label: 'O' },
    { type: 'key', code: 'KeyP', label: 'P' },
    { type: 'key', code: 'BracketLeft', label: '[', secondaryLabel: '{' },
    { type: 'key', code: 'BracketRight', label: ']', secondaryLabel: '}' },
    { type: 'key', code: 'Backslash', label: '\\', secondaryLabel: '|', width: 1.5 }
  ],
  [
    { type: 'key', code: 'CapsLock', label: 'Caps Lock', width: 1.8, align: 'left' },
    { type: 'key', code: 'KeyA', label: 'A' },
    { type: 'key', code: 'KeyS', label: 'S' },
    { type: 'key', code: 'KeyD', label: 'D' },
    { type: 'key', code: 'KeyF', label: 'F' },
    { type: 'key', code: 'KeyG', label: 'G' },
    { type: 'key', code: 'KeyH', label: 'H' },
    { type: 'key', code: 'KeyJ', label: 'J' },
    { type: 'key', code: 'KeyK', label: 'K' },
    { type: 'key', code: 'KeyL', label: 'L' },
    { type: 'key', code: 'Semicolon', label: ';', secondaryLabel: ':' },
    { type: 'key', code: 'Quote', label: '\'', secondaryLabel: '"' },
    { type: 'key', code: 'Enter', label: 'Enter', width: 2.2, align: 'left' }
  ],
  [
    { type: 'key', code: 'ShiftLeft', label: 'Shift', width: 2.3, align: 'left' },
    { type: 'key', code: 'KeyZ', label: 'Z' },
    { type: 'key', code: 'KeyX', label: 'X' },
    { type: 'key', code: 'KeyC', label: 'C' },
    { type: 'key', code: 'KeyV', label: 'V' },
    { type: 'key', code: 'KeyB', label: 'B' },
    { type: 'key', code: 'KeyN', label: 'N' },
    { type: 'key', code: 'KeyM', label: 'M' },
    { type: 'key', code: 'Comma', label: ',', secondaryLabel: '<' },
    { type: 'key', code: 'Period', label: '.', secondaryLabel: '>' },
    { type: 'key', code: 'Slash', label: '/', secondaryLabel: '?' },
    { type: 'key', code: 'ShiftRight', label: 'Shift', width: 2.7, align: 'right' }
  ],
  [
    { type: 'key', code: 'ControlLeft', label: 'Ctrl', width: 1.35, align: 'left' },
    { type: 'key', code: 'MetaLeft', label: 'Win', width: 1.35, hint: 'Meta' },
    { type: 'key', code: 'AltLeft', label: 'Alt', width: 1.35, hint: '左侧' },
    { type: 'key', code: 'Space', label: 'Space', width: 6.2 },
    { type: 'key', code: 'AltRight', label: 'Alt', width: 1.35, hint: '右侧' },
    { type: 'key', code: 'MetaRight', label: 'Win', width: 1.35, hint: 'Meta' },
    { type: 'key', code: 'ContextMenu', label: 'Menu', width: 1.35 },
    { type: 'key', code: 'ControlRight', label: 'Ctrl', width: 1.35, align: 'right' }
  ]
]

export const navKeys: GridKey[] = [
  { code: 'Insert', label: 'Ins', col: 1, row: 1 },
  { code: 'Home', label: 'Home', col: 2, row: 1 },
  { code: 'PageUp', label: 'PgUp', col: 3, row: 1 },
  { code: 'Delete', label: 'Del', col: 1, row: 2 },
  { code: 'End', label: 'End', col: 2, row: 2 },
  { code: 'PageDown', label: 'PgDn', col: 3, row: 2 },
  { code: 'ArrowUp', label: 'Up', hint: '方向', col: 2, row: 4 },
  { code: 'ArrowLeft', label: 'Left', hint: '方向', col: 1, row: 5 },
  { code: 'ArrowDown', label: 'Down', hint: '方向', col: 2, row: 5 },
  { code: 'ArrowRight', label: 'Right', hint: '方向', col: 3, row: 5 }
]

export const numpadKeys: GridKey[] = [
  { code: 'NumLock', label: 'Num', hint: 'Lock', col: 1, row: 1 },
  { code: 'NumpadDivide', label: '/', hint: 'Pad', col: 2, row: 1 },
  { code: 'NumpadMultiply', label: '*', hint: 'Pad', col: 3, row: 1 },
  { code: 'NumpadSubtract', label: '-', hint: 'Pad', col: 4, row: 1 },
  { code: 'Numpad7', label: '7', hint: 'Pad', col: 1, row: 2 },
  { code: 'Numpad8', label: '8', hint: 'Pad', col: 2, row: 2 },
  { code: 'Numpad9', label: '9', hint: 'Pad', col: 3, row: 2 },
  { code: 'NumpadAdd', label: '+', hint: 'Pad', col: 4, row: 2, height: 2 },
  { code: 'Numpad4', label: '4', hint: 'Pad', col: 1, row: 3 },
  { code: 'Numpad5', label: '5', hint: 'Pad', col: 2, row: 3 },
  { code: 'Numpad6', label: '6', hint: 'Pad', col: 3, row: 3 },
  { code: 'Numpad1', label: '1', hint: 'Pad', col: 1, row: 4 },
  { code: 'Numpad2', label: '2', hint: 'Pad', col: 2, row: 4 },
  { code: 'Numpad3', label: '3', hint: 'Pad', col: 3, row: 4 },
  { code: 'NumpadEnter', label: 'Enter', hint: 'Pad', col: 4, row: 4, height: 2 },
  { code: 'Numpad0', label: '0', hint: 'Pad', col: 1, row: 5, width: 2 },
  { code: 'NumpadDecimal', label: '.', hint: 'Pad', col: 3, row: 5 }
]

const flattenRowKeys = (rows: RowItem[]) => rows.filter((item): item is RowKey => item.type === 'key')

export const allKeys = [
  ...flattenRowKeys(functionRow),
  ...alphaRows.flatMap((row) => flattenRowKeys(row)),
  ...navKeys,
  ...numpadKeys
]

export const browserLimitedCodes = ['PrintScreen', 'MetaLeft', 'MetaRight', 'ContextMenu']
