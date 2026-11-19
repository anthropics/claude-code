//! Event handling

use crossterm::event::{self, Event as CEvent, KeyEvent, MouseEvent};
use std::time::Duration;
use tokio::sync::mpsc;

/// UI Event
#[derive(Debug)]
pub enum Event {
    /// Keyboard event
    Key(KeyEvent),
    /// Mouse event
    Mouse(MouseEvent),
    /// Resize event
    Resize(u16, u16),
    /// Tick event (for animations)
    Tick,
}

/// Event handler
pub struct EventHandler {
    /// Event receiver
    rx: mpsc::UnboundedReceiver<Event>,
    /// Tick rate
    _tick_rate: Duration,
}

impl EventHandler {
    /// Create new event handler
    pub fn new(tick_rate: Duration) -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        
        // Spawn event listener
        let tx_clone = tx.clone();
        tokio::spawn(async move {
            loop {
                if event::poll(tick_rate).unwrap_or(false) {
                    if let Ok(event) = event::read() {
                        let ev = match event {
                            CEvent::Key(key) => Event::Key(key),
                            CEvent::Mouse(mouse) => Event::Mouse(mouse),
                            CEvent::Resize(w, h) => Event::Resize(w, h),
                            _ => continue,
                        };
                        if tx_clone.send(ev).is_err() {
                            break;
                        }
                    }
                }
            }
        });
        
        // Spawn tick generator
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tick_rate);
            loop {
                interval.tick().await;
                if tx.send(Event::Tick).is_err() {
                    break;
                }
            }
        });
        
        Self {
            rx,
            _tick_rate: tick_rate,
        }
    }
    
    /// Get next event
    pub async fn next(&mut self) -> Option<Event> {
        self.rx.recv().await
    }
}

