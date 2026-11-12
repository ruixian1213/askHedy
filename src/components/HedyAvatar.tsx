import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { HEDY_SVG } from '../lib/hedySvg';
import { colors } from '../lib/theme';

export function HedyAvatar({ size = 40, ring = false }: { size?: number; ring?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: colors.surfaceAlt,
        borderWidth: ring ? 3 : 0,
        borderColor: colors.primarySoft,
      }}
    >
      <SvgXml xml={HEDY_SVG} width={size} height={size} />
    </View>
  );
}
