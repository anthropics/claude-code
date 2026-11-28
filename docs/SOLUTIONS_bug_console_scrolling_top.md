import pytest
from unittest.mock import MagicMock, patch
import sys
# Assume this is our internal library function that simulates robust TTY interaction
from cl_cli.utils import StableOutputStream 

@pytest.fixture
def mock_tty_write():
    """Mocks the low-level system write call used for terminal output."""
    with patch('sys.stdout', MagicMock()) as mock_out:
        # This fixture allows tests to inspect how and if 'sys.stdout' was written to.
        yield mock_out

@pytest.fixture
def stable_stream(mock_tty_write):
    """Provides a fresh instance of the stream manager for each test."""
    return StableOutputStream()

class TestStableOutputStream:

    # --- Core Bug Fix Tests (Scroll Stabilization) ---

    def test_scrolling_stability_long_history(self, stable_stream, mock_tty_write):
        """
        Tests that consecutive writes on a long history buffer do not trigger
        scroll reset sequences.
        """
        # Simulate initial fill: 10 pages of text (high volume)
        initial_content = "A" * 5000  # Pseudo-representing large scroll height
        stable_stream._simulate_initial_fill(initial_content)

        # The critical mock function that represents the TTY buffer.
        mock_tty_write.reset_mock() 

        # First small append (Bot adds text)
        append1 = " Bot added this new chunk."
        stable_stream.write(append1)

        # Assert: No explicit scroll reset sequence was emitted during the write.
        # We specifically look for common reset/cursor commands that signal a jump.
        # A robust TTY writer should only emit data characters and cursor move sequences (e.g., '\r').
        output_calls = [call[0][0] for call in mock_tty_write.mock_calls if call[1] == 'write']
        assert b'\x1b[H' not in b"".join(output_calls), "Should not emit cursor home/reset sequences on append."

        # Second, larger append (User types prompt continuation)
        append2 = "\nUser continued typing a significantly longer message here."
        stable_stream.write(append2)
        
        # Assert: The stream handled both writes without catastrophic scrolling resets.
        assert len(output_calls) >= 3, "Must write initial content + append1 + append2"


    def test_appending_at_prompt_boundary(self, stable_stream, mock_tty_write):
        """Tests the transition from completed bot message to active user prompt."""
        # Simulate context: Stable history followed by a visible prompt marker.
        stable_stream._simulate_initial_fill("History...\n")
        
        # Write the final 'Ready' status (the perceived end of generation)
        status_message = "Processing complete. Type your next request:"
        stable_stream.write(status_message)

        # Assert: The writing process remains stable and correctly leaves the cursor ready for input
        output_calls = [call[0][0] for call in mock_tty_write.mock_calls if call[1] == 'write']
        assert status_message.encode('utf-8') in b"".join(output_calls)
        # A successful write should end with a stable cursor position indicator, not a reset command.

    def test_empty_write_no_effect(self, stable_stream, mock_tty_write):
        """Ensures writing empty strings or null data has no side effects."""
        stable_stream._simulate_initial_fill("Stable History.")
        # Call write with an empty string to simulate a pause that shouldn't cause jitter
        stable_stream.write("") 
        
        output_calls = [call[0][0] for call in mock_tty_write.mock_calls if call[1] == 'write']
        assert not output_calls, "Writing an empty string should generate no terminal output calls."

    # --- Feature Enhancement Tests (Scroll Jumping) ---

    def test_scroll_jump_feature_initialization(self, stable_stream, mock_tty_write):
        """
        Tests the setup for direct scrolling. A successful implementation 
        should initialize a key listener and calculate current position delta.
        (Requires mocking platform-specific input handlers.)
        """
        # Mocking an internal component that detects terminal state changes (e.g., raw TTY handling)
        with patch('cl_cli.input_handler.get_key_press') as mock_keypress:
            mock_keypress.return_value = 'UpArrow' # Simulate Up Arrow press
            
            # Execute the jump function which calculates delta and sends key sequence
            stable_stream.jump_to_current_view()

            # Assert that the stream attempts to calculate a specific scroll command 
            # (e.g., sending VT100 sequences for moving cursor up/down).
            mock_tty_write.assert_called_with(b'\x1b[A') # Example: Up arrow sequence
            
    def test_scroll_jump_long_history_edge_case(self, stable_stream, mock_tty_write):
        """
        Tests the scroll jump functionality when the buffer is extremely long. 
        This ensures offset calculations do not overflow or fail.
        """
        # Simulate extreme history volume (100+ pages)
        stable_stream._simulate_initial_fill("A" * 100000)
        
        with patch('cl_cli.input_handler.get_key_press') as mock_keypress:
            mock_keypress.return_value = 'UpArrow'
            
            stable_stream.jump_to_current_view()

            # Assert that the stream was called correctly, indicating a successful 
            # calculation of relative scroll offset, not just a reset call.
            output_calls = [call[0][0] for call in mock_tty_write.mock_calls if call[1] == 'write']
            assert b'\x1b[A' in b"".join(output_calls), "Must emit calculated scroll up sequence.")


# --- Helper Mock Functions (for completeness) ---

def stable_stream_initialization():
    """Mock setup function for the fixture logic."""
    pass # This would house initialization of the stream manager