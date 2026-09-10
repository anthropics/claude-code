import { c as _c } from "react/compiler-runtime";
import React, { type ReactNode } from 'react';
import { ListItem } from '../design-system/ListItem.js';
export type SelectOptionProps = {
  /**
   * Determines if option is focused.
   */
  readonly isFocused: boolean;

  /**
   * Determines if option is selected.
   */
  readonly isSelected: boolean;

  /**
   * Option label.
   */
  readonly children: ReactNode;

  /**
   * Optional description to display below the label.
   */
  readonly description?: string;

  /**
   * Determines if the down arrow should be shown.
   */
  readonly shouldShowDownArrow?: boolean;

  /**
   * Determines if the up arrow should be shown.
   */
  readonly shouldShowUpArrow?: boolean;

  /**
   * Whether ListItem should declare the terminal cursor position.
   * Set false when a child declares its own cursor (e.g. BaseTextInput).
   */
  readonly declareCursor?: boolean;
};
export function SelectOption(t0) {
  const $ = _c(8);
  const {
    isFocused,
    isSelected,
    children,
    description,
    shouldShowDownArrow,
    shouldShowUpArrow,
    declareCursor
  } = t0;
  let t1;
  if ($[0] !== children || $[1] !== declareCursor || $[2] !== description || $[3] !== isFocused || $[4] !== isSelected || $[5] !== shouldShowDownArrow || $[6] !== shouldShowUpArrow) {
    t1 = <ListItem isFocused={isFocused} isSelected={isSelected} description={description} showScrollDown={shouldShowDownArrow} showScrollUp={shouldShowUpArrow} styled={false} declareCursor={declareCursor}>{children}</ListItem>;
    $[0] = children;
    $[1] = declareCursor;
    $[2] = description;
    $[3] = isFocused;
    $[4] = isSelected;
    $[5] = shouldShowDownArrow;
    $[6] = shouldShowUpArrow;
    $[7] = t1;
  } else {
    t1 = $[7];
  }
  return t1;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsIlJlYWN0Tm9kZSIsIkxpc3RJdGVtIiwiU2VsZWN0T3B0aW9uUHJvcHMiLCJpc0ZvY3VzZWQiLCJpc1NlbGVjdGVkIiwiY2hpbGRyZW4iLCJkZXNjcmlwdGlvbiIsInNob3VsZFNob3dEb3duQXJyb3ciLCJzaG91bGRTaG93VXBBcnJvdyIsImRlY2xhcmVDdXJzb3IiLCJTZWxlY3RPcHRpb24iLCJ0MCIsIiQiLCJfYyIsInQxIl0sInNvdXJjZXMiOlsic2VsZWN0LW9wdGlvbi50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHR5cGUgUmVhY3ROb2RlIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgeyBMaXN0SXRlbSB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vTGlzdEl0ZW0uanMnXG5cbmV4cG9ydCB0eXBlIFNlbGVjdE9wdGlvblByb3BzID0ge1xuICAvKipcbiAgICogRGV0ZXJtaW5lcyBpZiBvcHRpb24gaXMgZm9jdXNlZC5cbiAgICovXG4gIHJlYWRvbmx5IGlzRm9jdXNlZDogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBEZXRlcm1pbmVzIGlmIG9wdGlvbiBpcyBzZWxlY3RlZC5cbiAgICovXG4gIHJlYWRvbmx5IGlzU2VsZWN0ZWQ6IGJvb2xlYW5cblxuICAvKipcbiAgICogT3B0aW9uIGxhYmVsLlxuICAgKi9cbiAgcmVhZG9ubHkgY2hpbGRyZW46IFJlYWN0Tm9kZVxuXG4gIC8qKlxuICAgKiBPcHRpb25hbCBkZXNjcmlwdGlvbiB0byBkaXNwbGF5IGJlbG93IHRoZSBsYWJlbC5cbiAgICovXG4gIHJlYWRvbmx5IGRlc2NyaXB0aW9uPzogc3RyaW5nXG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgaWYgdGhlIGRvd24gYXJyb3cgc2hvdWxkIGJlIHNob3duLlxuICAgKi9cbiAgcmVhZG9ubHkgc2hvdWxkU2hvd0Rvd25BcnJvdz86IGJvb2xlYW5cblxuICAvKipcbiAgICogRGV0ZXJtaW5lcyBpZiB0aGUgdXAgYXJyb3cgc2hvdWxkIGJlIHNob3duLlxuICAgKi9cbiAgcmVhZG9ubHkgc2hvdWxkU2hvd1VwQXJyb3c/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgTGlzdEl0ZW0gc2hvdWxkIGRlY2xhcmUgdGhlIHRlcm1pbmFsIGN1cnNvciBwb3NpdGlvbi5cbiAgICogU2V0IGZhbHNlIHdoZW4gYSBjaGlsZCBkZWNsYXJlcyBpdHMgb3duIGN1cnNvciAoZS5nLiBCYXNlVGV4dElucHV0KS5cbiAgICovXG4gIHJlYWRvbmx5IGRlY2xhcmVDdXJzb3I/OiBib29sZWFuXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBTZWxlY3RPcHRpb24oe1xuICBpc0ZvY3VzZWQsXG4gIGlzU2VsZWN0ZWQsXG4gIGNoaWxkcmVuLFxuICBkZXNjcmlwdGlvbixcbiAgc2hvdWxkU2hvd0Rvd25BcnJvdyxcbiAgc2hvdWxkU2hvd1VwQXJyb3csXG4gIGRlY2xhcmVDdXJzb3IsXG59OiBTZWxlY3RPcHRpb25Qcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIHJldHVybiAoXG4gICAgPExpc3RJdGVtXG4gICAgICBpc0ZvY3VzZWQ9e2lzRm9jdXNlZH1cbiAgICAgIGlzU2VsZWN0ZWQ9e2lzU2VsZWN0ZWR9XG4gICAgICBkZXNjcmlwdGlvbj17ZGVzY3JpcHRpb259XG4gICAgICBzaG93U2Nyb2xsRG93bj17c2hvdWxkU2hvd0Rvd25BcnJvd31cbiAgICAgIHNob3dTY3JvbGxVcD17c2hvdWxkU2hvd1VwQXJyb3d9XG4gICAgICBzdHlsZWQ9e2ZhbHNlfVxuICAgICAgZGVjbGFyZUN1cnNvcj17ZGVjbGFyZUN1cnNvcn1cbiAgICA+XG4gICAgICB7Y2hpbGRyZW59XG4gICAgPC9MaXN0SXRlbT5cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsT0FBT0EsS0FBSyxJQUFJLEtBQUtDLFNBQVMsUUFBUSxPQUFPO0FBQzdDLFNBQVNDLFFBQVEsUUFBUSw4QkFBOEI7QUFFdkQsT0FBTyxLQUFLQyxpQkFBaUIsR0FBRztFQUM5QjtBQUNGO0FBQ0E7RUFDRSxTQUFTQyxTQUFTLEVBQUUsT0FBTzs7RUFFM0I7QUFDRjtBQUNBO0VBQ0UsU0FBU0MsVUFBVSxFQUFFLE9BQU87O0VBRTVCO0FBQ0Y7QUFDQTtFQUNFLFNBQVNDLFFBQVEsRUFBRUwsU0FBUzs7RUFFNUI7QUFDRjtBQUNBO0VBQ0UsU0FBU00sV0FBVyxDQUFDLEVBQUUsTUFBTTs7RUFFN0I7QUFDRjtBQUNBO0VBQ0UsU0FBU0MsbUJBQW1CLENBQUMsRUFBRSxPQUFPOztFQUV0QztBQUNGO0FBQ0E7RUFDRSxTQUFTQyxpQkFBaUIsQ0FBQyxFQUFFLE9BQU87O0VBRXBDO0FBQ0Y7QUFDQTtBQUNBO0VBQ0UsU0FBU0MsYUFBYSxDQUFDLEVBQUUsT0FBTztBQUNsQyxDQUFDO0FBRUQsT0FBTyxTQUFBQyxhQUFBQyxFQUFBO0VBQUEsTUFBQUMsQ0FBQSxHQUFBQyxFQUFBO0VBQXNCO0lBQUFWLFNBQUE7SUFBQUMsVUFBQTtJQUFBQyxRQUFBO0lBQUFDLFdBQUE7SUFBQUMsbUJBQUE7SUFBQUMsaUJBQUE7SUFBQUM7RUFBQSxJQUFBRSxFQVFUO0VBQUEsSUFBQUcsRUFBQTtFQUFBLElBQUFGLENBQUEsUUFBQVAsUUFBQSxJQUFBTyxDQUFBLFFBQUFILGFBQUEsSUFBQUcsQ0FBQSxRQUFBTixXQUFBLElBQUFNLENBQUEsUUFBQVQsU0FBQSxJQUFBUyxDQUFBLFFBQUFSLFVBQUEsSUFBQVEsQ0FBQSxRQUFBTCxtQkFBQSxJQUFBSyxDQUFBLFFBQUFKLGlCQUFBO0lBRWhCTSxFQUFBLElBQUMsUUFBUSxDQUNJWCxTQUFTLENBQVRBLFVBQVEsQ0FBQyxDQUNSQyxVQUFVLENBQVZBLFdBQVMsQ0FBQyxDQUNURSxXQUFXLENBQVhBLFlBQVUsQ0FBQyxDQUNSQyxjQUFtQixDQUFuQkEsb0JBQWtCLENBQUMsQ0FDckJDLFlBQWlCLENBQWpCQSxrQkFBZ0IsQ0FBQyxDQUN2QixNQUFLLENBQUwsTUFBSSxDQUFDLENBQ0VDLGFBQWEsQ0FBYkEsY0FBWSxDQUFDLENBRTNCSixTQUFPLENBQ1YsRUFWQyxRQUFRLENBVUU7SUFBQU8sQ0FBQSxNQUFBUCxRQUFBO0lBQUFPLENBQUEsTUFBQUgsYUFBQTtJQUFBRyxDQUFBLE1BQUFOLFdBQUE7SUFBQU0sQ0FBQSxNQUFBVCxTQUFBO0lBQUFTLENBQUEsTUFBQVIsVUFBQTtJQUFBUSxDQUFBLE1BQUFMLG1CQUFBO0lBQUFLLENBQUEsTUFBQUosaUJBQUE7SUFBQUksQ0FBQSxNQUFBRSxFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBRixDQUFBO0VBQUE7RUFBQSxPQVZYRSxFQVVXO0FBQUEiLCJpZ25vcmVMaXN0IjpbXX0=