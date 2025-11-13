"""
Crypto Trading Environment for Reinforcement Learning
Implements a Gym-compatible environment for training PPO agents on crypto trading

Author: AI Trader's Shadow Team
"""

import numpy as np
import pandas as pd
import gymnasium as gym
from gymnasium import spaces
from typing import Dict, Tuple, Optional, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CryptoTradingEnv(gym.Env):
    """
    A cryptocurrency trading environment for OpenAI Gym

    Observation Space:
        - OHLCV data (normalized)
        - Technical indicators (RSI, MACD, Bollinger Bands, etc.)
        - Portfolio state (balance, position, PnL)

    Action Space:
        - 0: HOLD (do nothing)
        - 1: BUY (long position)
        - 2: SELL (short position)
        - 3: CLOSE (close current position)

    Reward:
        - Based on realized PnL and risk-adjusted returns
        - Penalties for excessive trading and drawdowns
    """

    metadata = {'render.modes': ['human']}

    def __init__(
        self,
        df: pd.DataFrame,
        initial_balance: float = 100.0,
        commission: float = 0.0004,  # 0.04% trading fee (Bybit maker fee)
        max_position_size: float = 1.0,  # Max 100% of balance per trade
        lookback_window: int = 20,  # Number of candles to include in observation
        reward_scaling: float = 1e-4,  # Scale rewards for stability
    ):
        """
        Initialize the trading environment

        Args:
            df: DataFrame with columns ['timestamp', 'open', 'high', 'low', 'close', 'volume']
            initial_balance: Starting capital in USDT
            commission: Trading fee percentage (e.g., 0.0004 = 0.04%)
            max_position_size: Maximum position size as fraction of balance
            lookback_window: Number of historical candles in observation
            reward_scaling: Scaling factor for rewards
        """
        super(CryptoTradingEnv, self).__init__()

        # Validate input data
        required_columns = ['open', 'high', 'low', 'close', 'volume']
        if not all(col in df.columns for col in required_columns):
            raise ValueError(f"DataFrame must contain columns: {required_columns}")

        self.df = df.reset_index(drop=True)
        self.initial_balance = initial_balance
        self.commission = commission
        self.max_position_size = max_position_size
        self.lookback_window = lookback_window
        self.reward_scaling = reward_scaling

        # Calculate technical indicators
        self._calculate_features()

        # Environment state
        self.current_step = 0
        self.balance = initial_balance
        self.position = 0  # 0: no position, 1: long, -1: short
        self.entry_price = 0.0
        self.position_size = 0.0
        self.total_pnl = 0.0
        self.total_trades = 0
        self.winning_trades = 0
        self.max_balance = initial_balance
        self.max_drawdown = 0.0

        # Action space: HOLD, BUY, SELL, CLOSE
        self.action_space = spaces.Discrete(4)

        # Observation space: [OHLCV + indicators] * lookback_window + portfolio state
        # Features per timestep: OHLCV (5) + indicators (10) = 15 features
        # Total: 15 * lookback_window + 5 (portfolio state)
        obs_dim = 15 * lookback_window + 5
        self.observation_space = spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(obs_dim,),
            dtype=np.float32
        )

        logger.info(f"CryptoTradingEnv initialized: {len(self.df)} candles, "
                   f"observation_dim={obs_dim}, initial_balance={initial_balance}")

    def _calculate_features(self):
        """Calculate technical indicators as features"""
        df = self.df.copy()

        # Normalize prices (percentage change from first price)
        first_price = df['close'].iloc[0]
        df['close_norm'] = (df['close'] - first_price) / first_price
        df['open_norm'] = (df['open'] - first_price) / first_price
        df['high_norm'] = (df['high'] - first_price) / first_price
        df['low_norm'] = (df['low'] - first_price) / first_price
        df['volume_norm'] = (df['volume'] - df['volume'].mean()) / (df['volume'].std() + 1e-8)

        # RSI (Relative Strength Index)
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / (loss + 1e-8)
        df['rsi'] = 100 - (100 / (1 + rs))
        df['rsi_norm'] = (df['rsi'] - 50) / 50  # Normalize to [-1, 1]

        # MACD (Moving Average Convergence Divergence)
        ema12 = df['close'].ewm(span=12, adjust=False).mean()
        ema26 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd'] = ema12 - ema26
        df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
        df['macd_norm'] = (df['macd'] - df['macd_signal']) / (df['close'] + 1e-8)

        # Bollinger Bands
        bb_window = 20
        bb_sma = df['close'].rolling(window=bb_window).mean()
        bb_std = df['close'].rolling(window=bb_window).std()
        df['bb_upper'] = bb_sma + (bb_std * 2)
        df['bb_lower'] = bb_sma - (bb_std * 2)
        df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'] + 1e-8)
        df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / (bb_sma + 1e-8)

        # ATR (Average True Range)
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        df['atr'] = tr.rolling(14).mean()
        df['atr_norm'] = df['atr'] / (df['close'] + 1e-8)

        # Moving Averages
        df['ema20'] = df['close'].ewm(span=20, adjust=False).mean()
        df['ema50'] = df['close'].ewm(span=50, adjust=False).mean()
        df['ema_diff'] = (df['ema20'] - df['ema50']) / (df['close'] + 1e-8)

        # Volume indicators
        df['volume_sma'] = df['volume'].rolling(20).mean()
        df['volume_ratio'] = df['volume'] / (df['volume_sma'] + 1e-8)

        # Momentum
        df['momentum'] = df['close'].pct_change(periods=10)

        # Fill NaN values with 0
        df = df.fillna(0)

        self.df = df
        logger.info("Technical indicators calculated successfully")

    def _get_observation(self) -> np.ndarray:
        """
        Get current observation (state)

        Returns:
            np.ndarray: Flattened observation vector
        """
        # Get lookback window of OHLCV + indicators
        start_idx = max(0, self.current_step - self.lookback_window + 1)
        end_idx = self.current_step + 1

        # Select features
        feature_cols = [
            'open_norm', 'high_norm', 'low_norm', 'close_norm', 'volume_norm',
            'rsi_norm', 'macd_norm', 'bb_position', 'bb_width', 'atr_norm',
            'ema_diff', 'volume_ratio', 'momentum',
            'close', 'volume'  # Keep raw for internal use
        ]

        window_data = self.df.loc[start_idx:end_idx, feature_cols].values

        # Pad if necessary (for early timesteps)
        if len(window_data) < self.lookback_window:
            padding = np.zeros((self.lookback_window - len(window_data), len(feature_cols)))
            window_data = np.vstack([padding, window_data])

        # Flatten OHLCV + indicators (exclude last 2 cols which are raw values)
        market_features = window_data[:, :-2].flatten()

        # Portfolio state features
        current_price = self.df.loc[self.current_step, 'close']
        portfolio_features = np.array([
            self.balance / self.initial_balance,  # Normalized balance
            self.position,  # Current position (-1, 0, 1)
            (current_price - self.entry_price) / (self.entry_price + 1e-8) if self.position != 0 else 0,  # Unrealized PnL%
            self.total_pnl / self.initial_balance,  # Total PnL%
            self.max_drawdown,  # Max drawdown
        ])

        # Combine all features
        observation = np.concatenate([market_features, portfolio_features]).astype(np.float32)

        return observation

    def _calculate_reward(self, action: int) -> float:
        """
        Calculate reward for the current step

        Reward components:
        1. Realized PnL from closed positions
        2. Unrealized PnL from open positions
        3. Penalty for excessive trading
        4. Penalty for drawdowns

        Args:
            action: Action taken

        Returns:
            float: Reward value
        """
        current_price = self.df.loc[self.current_step, 'close']
        reward = 0.0

        # 1. Unrealized PnL (mark-to-market)
        if self.position != 0:
            price_change = (current_price - self.entry_price) / self.entry_price
            unrealized_pnl = price_change * self.position * self.position_size
            reward += unrealized_pnl * 0.1  # Small reward for holding profitable positions

        # 2. Penalty for holding losing positions
        if self.position != 0:
            price_change_pct = (current_price - self.entry_price) / self.entry_price
            if (self.position == 1 and price_change_pct < -0.02) or \
               (self.position == -1 and price_change_pct > 0.02):
                reward -= 0.5  # Penalty for >2% drawdown

        # 3. Small penalty for doing nothing (encourage action)
        if action == 0 and self.position == 0:
            reward -= 0.01

        # 4. Reward for closing profitable positions (handled in step())

        # Scale reward
        reward *= self.reward_scaling

        return reward

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """
        Execute one time step within the environment

        Args:
            action: Action to take (0: HOLD, 1: BUY, 2: SELL, 3: CLOSE)

        Returns:
            observation: Current observation
            reward: Reward for the action
            terminated: Whether episode is done
            truncated: Whether episode is truncated
            info: Additional information
        """
        current_price = self.df.loc[self.current_step, 'close']
        reward = 0.0
        trade_executed = False

        # Execute action
        if action == 1:  # BUY (LONG)
            if self.position == 0:  # Only if no position
                self.position = 1
                self.entry_price = current_price
                self.position_size = self.balance * self.max_position_size
                commission_cost = self.position_size * self.commission
                self.balance -= commission_cost
                trade_executed = True
                logger.debug(f"Step {self.current_step}: BUY at {current_price:.2f}, size={self.position_size:.2f}")

        elif action == 2:  # SELL (SHORT)
            if self.position == 0:  # Only if no position
                self.position = -1
                self.entry_price = current_price
                self.position_size = self.balance * self.max_position_size
                commission_cost = self.position_size * self.commission
                self.balance -= commission_cost
                trade_executed = True
                logger.debug(f"Step {self.current_step}: SELL at {current_price:.2f}, size={self.position_size:.2f}")

        elif action == 3:  # CLOSE position
            if self.position != 0:
                # Calculate PnL
                price_change = (current_price - self.entry_price) / self.entry_price
                pnl = price_change * self.position * self.position_size
                commission_cost = self.position_size * self.commission
                net_pnl = pnl - commission_cost

                self.balance += self.position_size + net_pnl
                self.total_pnl += net_pnl
                self.total_trades += 1

                if net_pnl > 0:
                    self.winning_trades += 1
                    reward += net_pnl * 10  # Big reward for profitable trades
                else:
                    reward += net_pnl * 5  # Moderate penalty for losses

                logger.debug(f"Step {self.current_step}: CLOSE at {current_price:.2f}, "
                           f"PnL={net_pnl:.2f}, balance={self.balance:.2f}")

                # Reset position
                self.position = 0
                self.entry_price = 0.0
                self.position_size = 0.0
                trade_executed = True

        # Calculate reward
        reward += self._calculate_reward(action)

        # Update max balance and drawdown
        total_equity = self.balance
        if self.position != 0:
            unrealized_pnl = ((current_price - self.entry_price) / self.entry_price) * \
                           self.position * self.position_size
            total_equity += unrealized_pnl

        if total_equity > self.max_balance:
            self.max_balance = total_equity

        drawdown = (self.max_balance - total_equity) / self.max_balance
        if drawdown > self.max_drawdown:
            self.max_drawdown = drawdown

        # Move to next step
        self.current_step += 1

        # Check if episode is done
        terminated = False
        truncated = False

        if self.current_step >= len(self.df) - 1:
            terminated = True
            # Force close any open position at the end
            if self.position != 0:
                price_change = (current_price - self.entry_price) / self.entry_price
                pnl = price_change * self.position * self.position_size
                self.balance += self.position_size + pnl
                self.total_pnl += pnl

        # Terminate if balance drops too low
        if total_equity < self.initial_balance * 0.5:  # 50% max loss
            terminated = True
            reward -= 10.0  # Big penalty for blowing up account

        # Get next observation
        observation = self._get_observation()

        # Info dict
        info = {
            'balance': self.balance,
            'total_equity': total_equity,
            'position': self.position,
            'total_pnl': self.total_pnl,
            'total_trades': self.total_trades,
            'winning_trades': self.winning_trades,
            'win_rate': self.winning_trades / self.total_trades if self.total_trades > 0 else 0,
            'max_drawdown': self.max_drawdown,
            'trade_executed': trade_executed,
        }

        return observation, reward, terminated, truncated, info

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[dict] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Reset the environment to initial state

        Args:
            seed: Random seed
            options: Additional options

        Returns:
            observation: Initial observation
            info: Additional information
        """
        super().reset(seed=seed)

        # Reset state
        self.current_step = self.lookback_window  # Start after lookback window
        self.balance = self.initial_balance
        self.position = 0
        self.entry_price = 0.0
        self.position_size = 0.0
        self.total_pnl = 0.0
        self.total_trades = 0
        self.winning_trades = 0
        self.max_balance = self.initial_balance
        self.max_drawdown = 0.0

        observation = self._get_observation()

        info = {
            'balance': self.balance,
            'position': self.position,
        }

        logger.info("Environment reset")

        return observation, info

    def render(self, mode='human'):
        """Render the environment"""
        if mode == 'human':
            current_price = self.df.loc[self.current_step, 'close']
            print(f"\n=== Step {self.current_step} ===")
            print(f"Price: {current_price:.2f}")
            print(f"Balance: {self.balance:.2f} USDT")
            print(f"Position: {self.position} ({'LONG' if self.position == 1 else 'SHORT' if self.position == -1 else 'NONE'})")
            if self.position != 0:
                print(f"Entry Price: {self.entry_price:.2f}")
                pnl_pct = ((current_price - self.entry_price) / self.entry_price) * 100 * self.position
                print(f"Unrealized PnL: {pnl_pct:.2f}%")
            print(f"Total PnL: {self.total_pnl:.2f} ({(self.total_pnl/self.initial_balance)*100:.2f}%)")
            print(f"Trades: {self.total_trades} (Win rate: {(self.winning_trades/self.total_trades)*100 if self.total_trades > 0 else 0:.1f}%)")
            print(f"Max Drawdown: {self.max_drawdown*100:.2f}%")

    def close(self):
        """Clean up environment resources"""
        pass


# Example usage
if __name__ == "__main__":
    # Create dummy data for testing
    np.random.seed(42)
    n_candles = 1000

    # Simulate price movement (random walk with trend)
    price = 100.0
    prices = []
    for _ in range(n_candles):
        price *= (1 + np.random.normal(0.0001, 0.01))  # Slight upward trend with volatility
        prices.append(price)

    df = pd.DataFrame({
        'timestamp': pd.date_range(start='2024-01-01', periods=n_candles, freq='1min'),
        'open': prices,
        'high': [p * (1 + abs(np.random.normal(0, 0.005))) for p in prices],
        'low': [p * (1 - abs(np.random.normal(0, 0.005))) for p in prices],
        'close': prices,
        'volume': np.random.uniform(1000, 10000, n_candles),
    })

    # Initialize environment
    env = CryptoTradingEnv(df, initial_balance=100.0)

    # Test environment
    obs, info = env.reset()
    print(f"Observation shape: {obs.shape}")
    print(f"Observation space: {env.observation_space}")
    print(f"Action space: {env.action_space}")

    # Run a few random steps
    for i in range(10):
        action = env.action_space.sample()
        obs, reward, terminated, truncated, info = env.step(action)
        env.render()

        if terminated or truncated:
            print("\nEpisode finished!")
            break

    print("\n✅ CryptoTradingEnv test completed successfully!")
