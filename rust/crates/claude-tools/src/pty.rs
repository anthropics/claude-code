//! PTY (Pseudo-Terminal) support for interactive commands
//!
//! Allows running interactive programs like vim, less, and other
//! terminal-based applications within Claude Code.

use std::io::{Read, Write};
use std::os::unix::io::{AsRawFd, RawFd};
use std::process::{Command, Stdio};
use std::time::Duration;
use thiserror::Error;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, Command as TokioCommand};
use tokio::sync::mpsc;
use tokio::time::timeout;
use tracing::{debug, error, info, instrument, warn};

/// PTY errors
#[derive(Debug, Error)]
pub enum PtyError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("PTY allocation failed: {0}")]
    AllocationFailed(String),
    
    #[error("Command execution failed: {0}")]
    ExecutionFailed(String),
    
    #[error("Timeout waiting for PTY output")]
    Timeout,
    
    #[error("PTY is not running")]
    NotRunning,
    
    #[error("Unsupported platform")]
    UnsupportedPlatform,
}

/// A PTY session for running interactive commands
pub struct PtySession {
    master_fd: RawFd,
    slave_fd: RawFd,
    child: Option<Child>,
    output_tx: mpsc::UnboundedSender<Vec<u8>>,
    output_rx: mpsc::UnboundedReceiver<Vec<u8>>,
    input_tx: mpsc::UnboundedSender<Vec<u8>>,
    dimensions: PtyDimensions,
    is_running: bool,
}

/// PTY terminal dimensions
#[derive(Clone, Copy, Debug)]
pub struct PtyDimensions {
    pub rows: u16,
    pub cols: u16,
    pub pixel_width: u16,
    pub pixel_height: u16,
}

impl Default for PtyDimensions {
    fn default() -> Self {
        Self {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        }
    }
}

/// Configuration for a PTY session
pub struct PtyConfig {
    pub command: String,
    pub args: Vec<String>,
    pub working_dir: Option<std::path::PathBuf>,
    pub env_vars: std::collections::HashMap<String, String>,
    pub dimensions: PtyDimensions,
    pub timeout: Duration,
}

impl PtySession {
    /// Create a new PTY session
    #[instrument]
    pub async fn new(config: PtyConfig) -> Result<Self, PtyError> {
        info!("Creating new PTY session for: {}", config.command);
        
        // Platform-specific PTY creation
        #[cfg(unix)]
        {
            Self::create_unix_pty(config).await
        }
        
        #[cfg(not(unix))]
        {
            Err(PtyError::UnsupportedPlatform)
        }
    }
    
    /// Create PTY on Unix systems
    #[cfg(unix)]
    async fn create_unix_pty(config: PtyConfig) -> Result<Self, PtyError> {
        use nix::pty::{openpty, PtyMaster, PtySlave};
        use nix::fcntl::{fcntl, FcntlArg, OFlag};
        
        // Open PTY
        let pty = openpty(&config.dimensions, None)?;
        let master = pty.master;
        let slave = pty.slave;
        
        // Set non-blocking on master
        let flags = fcntl(master.as_raw_fd(), FcntlArg::F_GETFL)?;
        fcntl(master.as_raw_fd(), FcntlArg::F_SETFL(
            OFlag::from_bits_truncate(flags | nix::fcntl::O_NONBLOCK)
        ))?;
        
        // Create communication channels
        let (output_tx, output_rx) = mpsc::unbounded_channel();
        let (input_tx, mut input_rx) = mpsc::unbounded_channel::<Vec<u8>>();
        
        // Spawn the command
        let mut cmd = TokioCommand::new(&config.command);
        cmd.args(&config.args)
            .stdin(Stdio::from(slave.try_clone()?))
            .stdout(Stdio::from(slave.try_clone()?))
            .stderr(Stdio::from(slave));
        
        if let Some(dir) = config.working_dir {
            cmd.current_dir(dir);
        }
        
        for (key, value) in config.env_vars {
            cmd.env(key, value);
        }
        
        let mut child = cmd.spawn()?;
        
        // Spawn reader task
        let master_fd = master.as_raw_fd();
        let output_tx_clone = output_tx.clone();
        
        tokio::spawn(async move {
            let mut buffer = [0u8; 4096];
            
            loop {
                match tokio::task::spawn_blocking(move || {
                    let mut master = unsafe { std::fs::File::from_raw_fd(master_fd) };
                    let result = master.read(&mut buffer);
                    std::mem::forget(master); // Don't close the fd
                    result
                }).await {
                    Ok(Ok(n)) if n > 0 => {
                        let data = buffer[..n].to_vec();
                        if output_tx_clone.send(data).is_err() {
                            break;
                        }
                    }
                    Ok(Ok(0)) => {
                        // EOF
                        break;
                    }
                    Ok(Err(e)) => {
                        warn!("PTY read error: {}", e);
                        break;
                    }
                    Err(e) => {
                        warn!("PTY read task error: {}", e);
                        break;
                    }
                }
                
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        });
        
        // Spawn writer task
        let master_fd_write = master.as_raw_fd();
        tokio::spawn(async move {
            while let Some(data) = input_rx.recv().await {
                let _ = tokio::task::spawn_blocking(move || {
                    let mut master = unsafe { std::fs::File::from_raw_fd(master_fd_write) };
                    let _ = master.write_all(&data);
                    let _ = master.flush();
                    std::mem::forget(master);
                }).await;
            }
        });
        
        info!("PTY session created successfully");
        
        Ok(Self {
            master_fd: master.as_raw_fd(),
            slave_fd: slave.as_raw_fd(),
            child: Some(child),
            output_tx,
            output_rx,
            input_tx,
            dimensions: config.dimensions,
            is_running: true,
        })
    }
    
    /// Send input to the PTY
    pub fn send_input(&self, data: &[u8]) -> Result<(), PtyError> {
        if !self.is_running {
            return Err(PtyError::NotRunning);
        }
        
        self.input_tx.send(data.to_vec())
            .map_err(|_| PtyError::Io(std::io::Error::new(
                std::io::ErrorKind::BrokenPipe,
                "Input channel closed"
            )))?;
        
        Ok(())
    }
    
    /// Send a key sequence to the PTY
    pub fn send_key(&self, key: PtyKey) -> Result<(), PtyError> {
        let sequence = key.to_sequence();
        self.send_input(&sequence)
    }
    
    /// Read output from the PTY (non-blocking)
    pub fn try_read_output(&mut self) -> Option<Vec<u8>> {
        self.output_rx.try_recv().ok()
    }
    
    /// Read output with timeout
    pub async fn read_output_timeout(&mut self, timeout_duration: Duration) -> Result<Vec<u8>, PtyError> {
        match timeout(timeout_duration, self.output_rx.recv()).await {
            Ok(Some(data)) => Ok(data),
            Ok(None) => Err(PtyError::NotRunning),
            Err(_) => Err(PtyError::Timeout),
        }
    }
    
    /// Check if the process is still running
    pub async fn is_running(&mut self) -> bool {
        if let Some(ref mut child) = self.child {
            match child.try_wait() {
                Ok(None) => true,
                Ok(Some(_)) => {
                    self.is_running = false;
                    false
                }
                Err(_) => {
                    self.is_running = false;
                    false
                }
            }
        } else {
            false
        }
    }
    
    /// Wait for the process to complete
    pub async fn wait(&mut self) -> Result<std::process::ExitStatus, PtyError> {
        if let Some(child) = self.child.take() {
            let status = child.wait().await?;
            self.is_running = false;
            Ok(status)
        } else {
            Err(PtyError::NotRunning)
        }
    }
    
    /// Resize the PTY
    #[cfg(unix)]
    pub fn resize(&mut self, dimensions: PtyDimensions) -> Result<(), PtyError> {
        use nix::sys::termios::SetArg;
        
        // Update window size
        let ws = nix::pty::Winsize {
            ws_row: dimensions.rows,
            ws_col: dimensions.cols,
            ws_xpixel: dimensions.pixel_width,
            ws_ypixel: dimensions.pixel_height,
        };
        
        // This is a simplified version - full implementation would use ioctl
        self.dimensions = dimensions;
        
        Ok(())
    }
    
    /// Get current dimensions
    pub fn dimensions(&self) -> PtyDimensions {
        self.dimensions
    }
    
    /// Kill the PTY process
    pub async fn kill(&mut self) -> Result<(), PtyError> {
        if let Some(ref mut child) = self.child {
            child.kill().await?;
            self.is_running = false;
        }
        Ok(())
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        // Clean up PTY
        #[cfg(unix)]
        {
            use nix::unistd::close;
            
            let _ = close(self.master_fd);
            let _ = close(self.slave_fd);
        }
    }
}

/// Key sequences for PTY input
#[derive(Clone, Copy, Debug)]
pub enum PtyKey {
    Char(char),
    Enter,
    Escape,
    Tab,
    Backspace,
    Delete,
    Up,
    Down,
    Left,
    Right,
    Home,
    End,
    PageUp,
    PageDown,
    F(u8),
    Ctrl(char),
    Alt(char),
    CtrlAlt(char),
}

impl PtyKey {
    /// Convert key to byte sequence
    pub fn to_sequence(self) -> Vec<u8> {
        match self {
            PtyKey::Char(c) => vec![c as u8],
            PtyKey::Enter => vec![b'\r'],
            PtyKey::Escape => vec![0x1b],
            PtyKey::Tab => vec![b'\t'],
            PtyKey::Backspace => vec![0x7f],
            PtyKey::Delete => vec![0x1b, b'[', b'3', b'~'],
            PtyKey::Up => vec![0x1b, b'[', b'A'],
            PtyKey::Down => vec![0x1b, b'[', b'B'],
            PtyKey::Left => vec![0x1b, b'[', b'D'],
            PtyKey::Right => vec![0x1b, b'[', b'C'],
            PtyKey::Home => vec![0x1b, b'[', b'H'],
            PtyKey::End => vec![0x1b, b'[', b'F'],
            PtyKey::PageUp => vec![0x1b, b'[', b'5', b'~'],
            PtyKey::PageDown => vec![0x1b, b'[', b'6', b'~'],
            PtyKey::F(n) => match n {
                1 => vec![0x1b, b'O', b'P'],
                2 => vec![0x1b, b'O', b'Q'],
                3 => vec![0x1b, b'O', b'R'],
                4 => vec![0x1b, b'O', b'S'],
                5 => vec![0x1b, b'[', b'1', b'5', b'~'],
                6 => vec![0x1b, b'[', b'1', b'7', b'~'],
                7 => vec![0x1b, b'[', b'1', b'8', b'~'],
                8 => vec![0x1b, b'[', b'1', b'9', b'~'],
                9 => vec![0x1b, b'[', b'2', b'0', b'~'],
                10 => vec![0x1b, b'[', b'2', b'1', b'~'],
                11 => vec![0x1b, b'[', b'2', b'3', b'~'],
                12 => vec![0x1b, b'[', b'2', b'4', b'~'],
                _ => vec![],
            },
            PtyKey::Ctrl(c) => {
                let code = c.to_ascii_uppercase() as u8;
                vec![code & 0x1f]
            }
            PtyKey::Alt(c) => {
                let mut seq = vec![0x1b];
                seq.push(c as u8);
                seq
            }
            PtyKey::CtrlAlt(c) => {
                let code = c.to_ascii_uppercase() as u8;
                vec![0x1b, code & 0x1f]
            }
        }
    }
}

/// High-level interface for running interactive commands
pub struct InteractiveShell {
    session: Option<PtySession>,
    command_history: Vec<String>,
    output_buffer: Vec<u8>,
    dimensions: PtyDimensions,
}

impl InteractiveShell {
    /// Create a new interactive shell
    pub fn new() -> Self {
        Self {
            session: None,
            command_history: Vec::new(),
            output_buffer: Vec::new(),
            dimensions: PtyDimensions::default(),
        }
    }
    
    /// Start an interactive command
    #[instrument]
    pub async fn start(&mut self, command: &str, args: &[&str]) -> Result<(), PtyError> {
        let config = PtyConfig {
            command: command.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            working_dir: None,
            env_vars: std::collections::HashMap::new(),
            dimensions: self.dimensions,
            timeout: Duration::from_secs(30),
        };
        
        let session = PtySession::new(config).await?;
        self.session = Some(session);
        
        info!("Started interactive shell: {} {:?}", command, args);
        
        // Give it a moment to initialize
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        Ok(())
    }
    
    /// Send input to the shell
    pub fn send_input(&mut self, input: &str) -> Result<(), PtyError> {
        if let Some(ref mut session) = self.session {
            session.send_input(input.as_bytes())?;
            Ok(())
        } else {
            Err(PtyError::NotRunning)
        }
    }
    
    /// Send a key to the shell
    pub fn send_key(&mut self, key: PtyKey) -> Result<(), PtyError> {
        if let Some(ref mut session) = self.session {
            session.send_key(key)?;
            Ok(())
        } else {
            Err(PtyError::NotRunning)
        }
    }
    
    /// Read output from the shell
    pub fn read_output(&mut self) -> String {
        let mut output = String::new();
        
        if let Some(ref mut session) = self.session {
            while let Some(data) = session.try_read_output() {
                output.push_str(&String::from_utf8_lossy(&data));
                self.output_buffer.extend_from_slice(&data);
            }
        }
        
        output
    }
    
    /// Get the full output buffer
    pub fn output_buffer(&self) -> &[u8] {
        &self.output_buffer
    }
    
    /// Clear the output buffer
    pub fn clear_buffer(&mut self) {
        self.output_buffer.clear();
    }
    
    /// Check if shell is running
    pub async fn is_running(&mut self) -> bool {
        if let Some(ref mut session) = self.session {
            session.is_running().await
        } else {
            false
        }
    }
    
    /// Wait for shell to complete
    pub async fn wait(&mut self) -> Result<std::process::ExitStatus, PtyError> {
        if let Some(ref mut session) = self.session {
            session.wait().await
        } else {
            Err(PtyError::NotRunning)
        }
    }
    
    /// Stop the shell
    pub async fn stop(&mut self) -> Result<(), PtyError> {
        if let Some(ref mut session) = self.session {
            session.kill().await
        } else {
            Err(PtyError::NotRunning)
        }
    }
    
    /// Resize the terminal
    pub fn resize(&mut self, rows: u16, cols: u16) -> Result<(), PtyError> {
        self.dimensions = PtyDimensions {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        
        if let Some(ref mut session) = self.session {
            session.resize(self.dimensions)?;
        }
        
        Ok(())
    }
}

/// Parser for terminal escape sequences
pub struct EscapeSequenceParser {
    buffer: Vec<u8>,
    state: ParseState,
}

#[derive(Clone, Copy, Debug)]
enum ParseState {
    Normal,
    Escape,
    Csi,     // Control Sequence Introducer
    Osc,     // Operating System Command
}

impl EscapeSequenceParser {
    pub fn new() -> Self {
        Self {
            buffer: Vec::new(),
            state: ParseState::Normal,
        }
    }
    
    /// Parse incoming bytes
    pub fn parse(&mut self, input: &[u8]) -> Vec<TerminalEvent> {
        let mut events = Vec::new();
        
        for &byte in input {
            match self.state {
                ParseState::Normal => {
                    if byte == 0x1b {
                        self.state = ParseState::Escape;
                        self.buffer.clear();
                        self.buffer.push(byte);
                    } else {
                        events.push(TerminalEvent::Char(byte as char));
                    }
                }
                ParseState::Escape => {
                    self.buffer.push(byte);
                    match byte {
                        b'[' => self.state = ParseState::Csi,
                        b']' => self.state = ParseState::Osc,
                        _ => {
                            // Single escape sequence
                            events.push(self.parse_escape_sequence(&self.buffer));
                            self.state = ParseState::Normal;
                        }
                    }
                }
                ParseState::Csi => {
                    self.buffer.push(byte);
                    if byte.is_ascii_alphabetic() || byte == b'~' {
                        events.push(self.parse_csi_sequence(&self.buffer));
                        self.state = ParseState::Normal;
                    }
                }
                ParseState::Osc => {
                    self.buffer.push(byte);
                    if byte == 0x07 || (self.buffer.len() > 2 && byte == b'\\') {
                        events.push(self.parse_osc_sequence(&self.buffer));
                        self.state = ParseState::Normal;
                    }
                }
            }
        }
        
        events
    }
    
    fn parse_escape_sequence(&self, seq: &[u8]) -> TerminalEvent {
        if seq.len() < 2 {
            return TerminalEvent::Unknown;
        }
        
        match seq[1] {
            b'c' => TerminalEvent::Reset,
            _ => TerminalEvent::Unknown,
        }
    }
    
    fn parse_csi_sequence(&self, seq: &[u8]) -> TerminalEvent {
        if seq.len() < 3 {
            return TerminalEvent::Unknown;
        }
        
        let params: Vec<u16> = String::from_utf8_lossy(&seq[2..seq.len()-1])
            .split(';')
            .filter_map(|s| s.parse().ok())
            .collect();
        
        let cmd = seq[seq.len() - 1];
        
        match cmd {
            b'A' => TerminalEvent::CursorUp(params.get(0).copied().unwrap_or(1)),
            b'B' => TerminalEvent::CursorDown(params.get(0).copied().unwrap_or(1)),
            b'C' => TerminalEvent::CursorRight(params.get(0).copied().unwrap_or(1)),
            b'D' => TerminalEvent::CursorLeft(params.get(0).copied().unwrap_or(1)),
            b'H' => TerminalEvent::CursorPosition(
                params.get(0).copied().unwrap_or(1),
                params.get(1).copied().unwrap_or(1)
            ),
            b'J' => TerminalEvent::ClearScreen,
            b'K' => TerminalEvent::ClearLine,
            b'm' => TerminalEvent::Sgr(params),
            b'h' => TerminalEvent::SetMode(params),
            b'l' => TerminalEvent::ResetMode(params),
            b'~' => {
                let code = params.get(0).copied().unwrap_or(0);
                match code {
                    1 => TerminalEvent::Key(PtyKey::Home),
                    2 => TerminalEvent::Key(PtyKey::Insert),
                    3 => TerminalEvent::Key(PtyKey::Delete),
                    4 => TerminalEvent::Key(PtyKey::End),
                    5 => TerminalEvent::Key(PtyKey::PageUp),
                    6 => TerminalEvent::Key(PtyKey::PageDown),
                    _ => TerminalEvent::Unknown,
                }
            }
            _ => TerminalEvent::Unknown,
        }
    }
    
    fn parse_osc_sequence(&self, seq: &[u8]) -> TerminalEvent {
        if seq.len() < 3 {
            return TerminalEvent::Unknown;
        }
        
        let content = String::from_utf8_lossy(&seq[2..seq.len()-1]);
        let parts: Vec<&str> = content.splitn(2, ';').collect();
        
        if let Some(code) = parts.get(0).and_then(|s| s.parse::<u16>().ok()) {
            match code {
                0 | 1 | 2 => TerminalEvent::SetTitle(parts.get(1).map(|s| s.to_string())),
                _ => TerminalEvent::Unknown,
            }
        } else {
            TerminalEvent::Unknown
        }
    }
}

/// Terminal events from escape sequences
#[derive(Clone, Debug)]
pub enum TerminalEvent {
    Char(char),
    Key(PtyKey),
    CursorUp(u16),
    CursorDown(u16),
    CursorLeft(u16),
    CursorRight(u16),
    CursorPosition(u16, u16),
    ClearScreen,
    ClearLine,
    Sgr(Vec<u16>), // Select Graphic Rendition
    SetMode(Vec<u16>),
    ResetMode(Vec<u16>),
    SetTitle(Option<String>),
    Reset,
    Unknown,
}

