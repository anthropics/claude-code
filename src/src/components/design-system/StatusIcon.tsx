import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import React from 'react';
import { Text } from '../../ink.js';
type Status = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'loading';
type Props = {
  /**
   * The status to display. Determines both the icon and color.
   *
   * - `success`: Green checkmark (✓)
   * - `error`: Red cross (✗)
   * - `warning`: Yellow warning symbol (⚠)
   * - `info`: Blue info symbol (ℹ)
   * - `pending`: Dimmed circle (○)
   * - `loading`: Dimmed ellipsis (…)
   */
  status: Status;
  /**
   * Include a trailing space after the icon. Useful when followed by text.
   * @default false
   */
  withSpace?: boolean;
};
const STATUS_CONFIG: Record<Status, {
  icon: string;
  color: 'success' | 'error' | 'warning' | 'suggestion' | undefined;
}> = {
  success: {
    icon: figures.tick,
    color: 'success'
  },
  error: {
    icon: figures.cross,
    color: 'error'
  },
  warning: {
    icon: figures.warning,
    color: 'warning'
  },
  info: {
    icon: figures.info,
    color: 'suggestion'
  },
  pending: {
    icon: figures.circle,
    color: undefined
  },
  loading: {
    icon: '…',
    color: undefined
  }
};

/**
 * Renders a status indicator icon with appropriate color.
 *
 * @example
 * // Success indicator
 * <StatusIcon status="success" />
 *
 * @example
 * // Error with trailing space for text
 * <Text><StatusIcon status="error" withSpace />Failed to connect</Text>
 *
 * @example
 * // Status line pattern
 * <Text>
 *   <StatusIcon status="pending" withSpace />
 *   Waiting for response
 * </Text>
 */
export function StatusIcon(t0) {
  const $ = _c(5);
  const {
    status,
    withSpace: t1
  } = t0;
  const withSpace = t1 === undefined ? false : t1;
  const config = STATUS_CONFIG[status];
  const t2 = !config.color;
  const t3 = withSpace && " ";
  let t4;
  if ($[0] !== config.color || $[1] !== config.icon || $[2] !== t2 || $[3] !== t3) {
    t4 = <Text color={config.color} dimColor={t2}>{config.icon}{t3}</Text>;
    $[0] = config.color;
    $[1] = config.icon;
    $[2] = t2;
    $[3] = t3;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  return t4;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJUZXh0IiwiU3RhdHVzIiwiUHJvcHMiLCJzdGF0dXMiLCJ3aXRoU3BhY2UiLCJTVEFUVVNfQ09ORklHIiwiUmVjb3JkIiwiaWNvbiIsImNvbG9yIiwic3VjY2VzcyIsInRpY2siLCJlcnJvciIsImNyb3NzIiwid2FybmluZyIsImluZm8iLCJwZW5kaW5nIiwiY2lyY2xlIiwidW5kZWZpbmVkIiwibG9hZGluZyIsIlN0YXR1c0ljb24iLCJ0MCIsIiQiLCJfYyIsInQxIiwiY29uZmlnIiwidDIiLCJ0MyIsInQ0Il0sInNvdXJjZXMiOlsiU3RhdHVzSWNvbi50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IFRleHQgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5cbnR5cGUgU3RhdHVzID0gJ3N1Y2Nlc3MnIHwgJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpbmZvJyB8ICdwZW5kaW5nJyB8ICdsb2FkaW5nJ1xuXG50eXBlIFByb3BzID0ge1xuICAvKipcbiAgICogVGhlIHN0YXR1cyB0byBkaXNwbGF5LiBEZXRlcm1pbmVzIGJvdGggdGhlIGljb24gYW5kIGNvbG9yLlxuICAgKlxuICAgKiAtIGBzdWNjZXNzYDogR3JlZW4gY2hlY2ttYXJrICjinJMpXG4gICAqIC0gYGVycm9yYDogUmVkIGNyb3NzICjinJcpXG4gICAqIC0gYHdhcm5pbmdgOiBZZWxsb3cgd2FybmluZyBzeW1ib2wgKOKaoClcbiAgICogLSBgaW5mb2A6IEJsdWUgaW5mbyBzeW1ib2wgKOKEuSlcbiAgICogLSBgcGVuZGluZ2A6IERpbW1lZCBjaXJjbGUgKOKXiylcbiAgICogLSBgbG9hZGluZ2A6IERpbW1lZCBlbGxpcHNpcyAo4oCmKVxuICAgKi9cbiAgc3RhdHVzOiBTdGF0dXNcbiAgLyoqXG4gICAqIEluY2x1ZGUgYSB0cmFpbGluZyBzcGFjZSBhZnRlciB0aGUgaWNvbi4gVXNlZnVsIHdoZW4gZm9sbG93ZWQgYnkgdGV4dC5cbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIHdpdGhTcGFjZT86IGJvb2xlYW5cbn1cblxuY29uc3QgU1RBVFVTX0NPTkZJRzogUmVjb3JkPFxuICBTdGF0dXMsXG4gIHtcbiAgICBpY29uOiBzdHJpbmdcbiAgICBjb2xvcjogJ3N1Y2Nlc3MnIHwgJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdzdWdnZXN0aW9uJyB8IHVuZGVmaW5lZFxuICB9XG4+ID0ge1xuICBzdWNjZXNzOiB7IGljb246IGZpZ3VyZXMudGljaywgY29sb3I6ICdzdWNjZXNzJyB9LFxuICBlcnJvcjogeyBpY29uOiBmaWd1cmVzLmNyb3NzLCBjb2xvcjogJ2Vycm9yJyB9LFxuICB3YXJuaW5nOiB7IGljb246IGZpZ3VyZXMud2FybmluZywgY29sb3I6ICd3YXJuaW5nJyB9LFxuICBpbmZvOiB7IGljb246IGZpZ3VyZXMuaW5mbywgY29sb3I6ICdzdWdnZXN0aW9uJyB9LFxuICBwZW5kaW5nOiB7IGljb246IGZpZ3VyZXMuY2lyY2xlLCBjb2xvcjogdW5kZWZpbmVkIH0sXG4gIGxvYWRpbmc6IHsgaWNvbjogJ+KApicsIGNvbG9yOiB1bmRlZmluZWQgfSxcbn1cblxuLyoqXG4gKiBSZW5kZXJzIGEgc3RhdHVzIGluZGljYXRvciBpY29uIHdpdGggYXBwcm9wcmlhdGUgY29sb3IuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFN1Y2Nlc3MgaW5kaWNhdG9yXG4gKiA8U3RhdHVzSWNvbiBzdGF0dXM9XCJzdWNjZXNzXCIgLz5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gRXJyb3Igd2l0aCB0cmFpbGluZyBzcGFjZSBmb3IgdGV4dFxuICogPFRleHQ+PFN0YXR1c0ljb24gc3RhdHVzPVwiZXJyb3JcIiB3aXRoU3BhY2UgLz5GYWlsZWQgdG8gY29ubmVjdDwvVGV4dD5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gU3RhdHVzIGxpbmUgcGF0dGVyblxuICogPFRleHQ+XG4gKiAgIDxTdGF0dXNJY29uIHN0YXR1cz1cInBlbmRpbmdcIiB3aXRoU3BhY2UgLz5cbiAqICAgV2FpdGluZyBmb3IgcmVzcG9uc2VcbiAqIDwvVGV4dD5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIFN0YXR1c0ljb24oe1xuICBzdGF0dXMsXG4gIHdpdGhTcGFjZSA9IGZhbHNlLFxufTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBjb25maWcgPSBTVEFUVVNfQ09ORklHW3N0YXR1c11cblxuICByZXR1cm4gKFxuICAgIDxUZXh0IGNvbG9yPXtjb25maWcuY29sb3J9IGRpbUNvbG9yPXshY29uZmlnLmNvbG9yfT5cbiAgICAgIHtjb25maWcuaWNvbn1cbiAgICAgIHt3aXRoU3BhY2UgJiYgJyAnfVxuICAgIDwvVGV4dD5cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsT0FBT0EsT0FBTyxNQUFNLFNBQVM7QUFDN0IsT0FBT0MsS0FBSyxNQUFNLE9BQU87QUFDekIsU0FBU0MsSUFBSSxRQUFRLGNBQWM7QUFFbkMsS0FBS0MsTUFBTSxHQUFHLFNBQVMsR0FBRyxPQUFPLEdBQUcsU0FBUyxHQUFHLE1BQU0sR0FBRyxTQUFTLEdBQUcsU0FBUztBQUU5RSxLQUFLQyxLQUFLLEdBQUc7RUFDWDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFQyxNQUFNLEVBQUVGLE1BQU07RUFDZDtBQUNGO0FBQ0E7QUFDQTtFQUNFRyxTQUFTLENBQUMsRUFBRSxPQUFPO0FBQ3JCLENBQUM7QUFFRCxNQUFNQyxhQUFhLEVBQUVDLE1BQU0sQ0FDekJMLE1BQU0sRUFDTjtFQUNFTSxJQUFJLEVBQUUsTUFBTTtFQUNaQyxLQUFLLEVBQUUsU0FBUyxHQUFHLE9BQU8sR0FBRyxTQUFTLEdBQUcsWUFBWSxHQUFHLFNBQVM7QUFDbkUsQ0FBQyxDQUNGLEdBQUc7RUFDRkMsT0FBTyxFQUFFO0lBQUVGLElBQUksRUFBRVQsT0FBTyxDQUFDWSxJQUFJO0lBQUVGLEtBQUssRUFBRTtFQUFVLENBQUM7RUFDakRHLEtBQUssRUFBRTtJQUFFSixJQUFJLEVBQUVULE9BQU8sQ0FBQ2MsS0FBSztJQUFFSixLQUFLLEVBQUU7RUFBUSxDQUFDO0VBQzlDSyxPQUFPLEVBQUU7SUFBRU4sSUFBSSxFQUFFVCxPQUFPLENBQUNlLE9BQU87SUFBRUwsS0FBSyxFQUFFO0VBQVUsQ0FBQztFQUNwRE0sSUFBSSxFQUFFO0lBQUVQLElBQUksRUFBRVQsT0FBTyxDQUFDZ0IsSUFBSTtJQUFFTixLQUFLLEVBQUU7RUFBYSxDQUFDO0VBQ2pETyxPQUFPLEVBQUU7SUFBRVIsSUFBSSxFQUFFVCxPQUFPLENBQUNrQixNQUFNO0lBQUVSLEtBQUssRUFBRVM7RUFBVSxDQUFDO0VBQ25EQyxPQUFPLEVBQUU7SUFBRVgsSUFBSSxFQUFFLEdBQUc7SUFBRUMsS0FBSyxFQUFFUztFQUFVO0FBQ3pDLENBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTyxTQUFBRSxXQUFBQyxFQUFBO0VBQUEsTUFBQUMsQ0FBQSxHQUFBQyxFQUFBO0VBQW9CO0lBQUFuQixNQUFBO0lBQUFDLFNBQUEsRUFBQW1CO0VBQUEsSUFBQUgsRUFHbkI7RUFETixNQUFBaEIsU0FBQSxHQUFBbUIsRUFBaUIsS0FBakJOLFNBQWlCLEdBQWpCLEtBQWlCLEdBQWpCTSxFQUFpQjtFQUVqQixNQUFBQyxNQUFBLEdBQWVuQixhQUFhLENBQUNGLE1BQU0sQ0FBQztFQUdHLE1BQUFzQixFQUFBLElBQUNELE1BQU0sQ0FBQWhCLEtBQU07RUFFL0MsTUFBQWtCLEVBQUEsR0FBQXRCLFNBQWdCLElBQWhCLEdBQWdCO0VBQUEsSUFBQXVCLEVBQUE7RUFBQSxJQUFBTixDQUFBLFFBQUFHLE1BQUEsQ0FBQWhCLEtBQUEsSUFBQWEsQ0FBQSxRQUFBRyxNQUFBLENBQUFqQixJQUFBLElBQUFjLENBQUEsUUFBQUksRUFBQSxJQUFBSixDQUFBLFFBQUFLLEVBQUE7SUFGbkJDLEVBQUEsSUFBQyxJQUFJLENBQVEsS0FBWSxDQUFaLENBQUFILE1BQU0sQ0FBQWhCLEtBQUssQ0FBQyxDQUFZLFFBQWEsQ0FBYixDQUFBaUIsRUFBWSxDQUFDLENBQy9DLENBQUFELE1BQU0sQ0FBQWpCLElBQUksQ0FDVixDQUFBbUIsRUFBZSxDQUNsQixFQUhDLElBQUksQ0FHRTtJQUFBTCxDQUFBLE1BQUFHLE1BQUEsQ0FBQWhCLEtBQUE7SUFBQWEsQ0FBQSxNQUFBRyxNQUFBLENBQUFqQixJQUFBO0lBQUFjLENBQUEsTUFBQUksRUFBQTtJQUFBSixDQUFBLE1BQUFLLEVBQUE7SUFBQUwsQ0FBQSxNQUFBTSxFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBTixDQUFBO0VBQUE7RUFBQSxPQUhQTSxFQUdPO0FBQUEiLCJpZ25vcmVMaXN0IjpbXX0=