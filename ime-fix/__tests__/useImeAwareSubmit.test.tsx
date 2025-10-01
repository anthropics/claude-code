/**
 * Unit tests for useImeAwareSubmit hook
 * Tests IME composition handling and Enter key behavior
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { fireEvent } from '@testing-library/react';
import { useImeAwareSubmit } from '../useImeAwareSubmit';

describe('useImeAwareSubmit', () => {
  let mockSubmit: jest.Mock;

  beforeEach(() => {
    mockSubmit = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should NOT submit form when Enter is pressed during IME composition (isComposing=true)', () => {
    const { result } = renderHook(() => 
      useImeAwareSubmit({ onSubmit: mockSubmit })
    );

    // Start IME composition
    act(() => {
      result.current.handleCompositionStart();
    });

    // Create mock event with Enter key during composition
    const mockEvent = {
      key: 'Enter',
      keyCode: 13,
      currentTarget: {
        value: 'test input',
      },
      preventDefault: jest.fn(),
    } as any;

    // Press Enter during composition
    act(() => {
      result.current.handleKeyDown(mockEvent);
    });

    // Should NOT call submit
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  test('should NOT submit form when Enter is pressed with keyCode 229 (IME processing)', () => {
    const { result } = renderHook(() => 
      useImeAwareSubmit({ onSubmit: mockSubmit })
    );

    // Create mock event with keyCode 229 (IME processing)
    const mockEvent = {
      key: 'Enter',
      keyCode: 229, // IME processing code
      currentTarget: {
        value: 'test input',
      },
      preventDefault: jest.fn(),
    } as any;

    // Press Enter with keyCode 229
    act(() => {
      result.current.handleKeyDown(mockEvent);
    });

    // Should NOT call submit
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  test('should submit form when Enter is pressed after composition ends', () => {
    const { result } = renderHook(() => 
      useImeAwareSubmit({ onSubmit: mockSubmit })
    );

    // Start and end IME composition
    act(() => {
      result.current.handleCompositionStart();
    });

    act(() => {
      result.current.handleCompositionEnd();
    });

    // Create mock event with Enter key after composition
    const mockEvent = {
      key: 'Enter',
      keyCode: 13,
      currentTarget: {
        value: 'test input',
      },
      preventDefault: jest.fn(),
    } as any;

    // Press Enter after composition ends
    act(() => {
      result.current.handleKeyDown(mockEvent);
    });

    // Should call submit with trimmed value
    expect(mockSubmit).toHaveBeenCalledWith('test input');
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.currentTarget.value).toBe(''); // Input should be cleared
  });

  test('should NOT submit form when Enter is pressed with empty input', () => {
    const { result } = renderHook(() => 
      useImeAwareSubmit({ onSubmit: mockSubmit })
    );

    // Create mock event with empty value
    const mockEvent = {
      key: 'Enter',
      keyCode: 13,
      currentTarget: {
        value: '   ', // Whitespace only
      },
      preventDefault: jest.fn(),
    } as any;

    // Press Enter with empty input
    act(() => {
      result.current.handleKeyDown(mockEvent);
    });

    // Should NOT call submit
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  test('should handle non-Enter keys without any action', () => {
    const { result } = renderHook(() => 
      useImeAwareSubmit({ onSubmit: mockSubmit })
    );

    // Create mock event with non-Enter key
    const mockEvent = {
      key: 'a',
      keyCode: 65,
      currentTarget: {
        value: 'test',
      },
      preventDefault: jest.fn(),
    } as any;

    // Press non-Enter key
    act(() => {
      result.current.handleKeyDown(mockEvent);
    });

    // Should NOT call submit or preventDefault
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  test('isComposing state should update correctly', () => {
    const { result } = renderHook(() => 
      useImeAwareSubmit({ onSubmit: mockSubmit })
    );

    // Initially not composing
    expect(result.current.isComposing).toBe(false);

    // Start composition
    act(() => {
      result.current.handleCompositionStart();
    });
    expect(result.current.isComposing).toBe(true);

    // End composition
    act(() => {
      result.current.handleCompositionEnd();
    });
    expect(result.current.isComposing).toBe(false);
  });
});

