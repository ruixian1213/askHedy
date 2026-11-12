import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../lib/theme';

/**
 * 輕量 Markdown 渲染器（不依賴第三方套件）：
 * 標題、粗體、斜體、行內程式碼、程式碼區塊、連結、清單、引用、分隔線。
 */

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: number; text: string }
  | { type: 'code'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'hr' };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', text: buf.join('\n') });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({ type: 'h', level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i])) {
          items[items.length - 1] += ' ' + lines[i].trim();
          i++;
        }
      }
      blocks.push({ type: 'ul', items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) {
          items[items.length - 1] += ' ' + lines[i].trim();
          i++;
        }
      }
      blocks.push({ type: 'ol', items });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'quote', text: buf.join('\n') });
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    blocks.push({ type: 'p', text: buf.join('\n') });
  }
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*|_[^_\n]+_)/g;

function renderInline(text: string, baseStyle: object, key = 'k'): React.ReactNode[] {
  const parts = text.split(INLINE);
  return parts.map((part, idx) => {
    const k = `${key}-${idx}`;
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**'))
      return (
        <Text key={k} style={[baseStyle, styles.bold]}>
          {part.slice(2, -2)}
        </Text>
      );
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <Text key={k} style={[baseStyle, styles.codeInline]}>
          {part.slice(1, -1)}
        </Text>
      );
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link)
      return (
        <Text key={k} style={[baseStyle, styles.link]} onPress={() => void Linking.openURL(link[2]).catch(() => undefined)}>
          {link[1]}
        </Text>
      );
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_')))
      return (
        <Text key={k} style={[baseStyle, styles.italic]}>
          {part.slice(1, -1)}
        </Text>
      );
    return (
      <Text key={k} style={baseStyle}>
        {part}
      </Text>
    );
  });
}

export function SimpleMarkdown({ children, color = colors.text }: { children: string; color?: string }) {
  const blocks = parseBlocks(children);
  const base = { color };
  return (
    <View>
      {blocks.map((b, i) => {
        const last = i === blocks.length - 1;
        const mb = last ? 0 : 8;
        switch (b.type) {
          case 'h':
            return (
              <Text
                key={i}
                style={[styles.heading, b.level >= 3 && styles.heading3, base, { marginBottom: mb }]}
                selectable
              >
                {renderInline(b.text, [styles.heading, b.level >= 3 && styles.heading3, base], `h${i}`)}
              </Text>
            );
          case 'code':
            return (
              <View key={i} style={[styles.codeBlock, { marginBottom: mb }]}>
                <Text style={styles.codeText} selectable>
                  {b.text}
                </Text>
              </View>
            );
          case 'ul':
          case 'ol':
            return (
              <View key={i} style={{ marginBottom: mb }}>
                {b.items.map((item, j) => (
                  <View key={j} style={styles.listItem}>
                    <Text style={[styles.body, base, styles.bullet]}>{b.type === 'ul' ? '•' : `${j + 1}.`}</Text>
                    <Text style={[styles.body, base, { flex: 1 }]} selectable>
                      {renderInline(item, [styles.body, base], `li${i}-${j}`)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'quote':
            return (
              <View key={i} style={[styles.quote, { marginBottom: mb }]}>
                <Text style={[styles.body, base]} selectable>
                  {renderInline(b.text, [styles.body, base], `q${i}`)}
                </Text>
              </View>
            );
          case 'hr':
            return <View key={i} style={[styles.hr, { marginBottom: mb }]} />;
          default:
            return (
              <Text key={i} style={[styles.body, base, { marginBottom: mb }]} selectable>
                {renderInline(b.text, [styles.body, base], `p${i}`)}
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  heading: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  heading3: { fontSize: 16 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  codeInline: { fontFamily: 'Menlo', fontSize: 13, backgroundColor: colors.surfaceAlt, borderRadius: 4 },
  codeBlock: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: 10 },
  codeText: { fontFamily: 'Menlo', fontSize: 13, lineHeight: 18, color: colors.text },
  link: { color: colors.blue, textDecorationLine: 'underline' },
  listItem: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  bullet: { width: 18, textAlign: 'right' },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 10, backgroundColor: colors.surfaceAlt, borderRadius: 4, paddingVertical: 4 },
  hr: { height: 1, backgroundColor: colors.border },
});
