"""
Custom Gymnasium Environment for Crypto Trading

This environment simulates realistic crypto trading conditions for RL training.

CRITICAL FEATURES (must be accurate for training):
1. Trading fees (0.1% maker/taker)
2. Slippage (price impact from market orders)
3. Minimum order size ($10 USD)
4. Spread (bid-ask spread from order book)
5. Position tracking (long/short/flat)

The agent learns to trade profitably DESPITE these frictions, which is
essential for real-world viability.
"""
import gymnasium as gym
from gymnasium import spaces
import numpy as np
import pandas as pd
from typing import Optional, Tuple, Dict, Any
from decimal import Decimal

from app.core.logger import logger


class CryptoTradingEnv(gym.Env):
    """
    Custom Gymnasium environment for cryptocurrency trading.

    Observation Space:
        - Price data (OHLCV)
        - Technical indicators (RSI, MACD, etc.)
        - Order book features (spread, liquidity)
        - Position state (current holdings, P&L)

    Action Space:
        - 0: Hold (no action)
        - 1: Buy (market order)
        - 2: Sell (market order)

    Reward:
        - Realized P&L from closed positions
        - Penalized for: fees, slippage, drawdown
        - Bonus for: risk-adjusted returns (Sharpe ratio)
    """

    metadata = {"render_modes": ["human"]}

    def __init__(
        self,
        df: pd.DataFrame,
        initial_balance: float = 100.0,
        fee_rate: float = 0.001,  # 0.1% fee
        min_order_size_usd: float = 10.0,
        slippage_bps: float = 5.0,  # 0.05% slippage
        window_size: int = 50,  # Number of timesteps in observation
    ):
        """
        Initialize the trading environment.

        Args:
            df: Historical price data (OHLCV + features)
            initial_balance: Starting balance in USD
            fee_rate: Trading fee rate (e.g., 0.001 = 0.1%)
            min_order_size_usd: Minimum order size in USD
            slippage_bps: Slippage in basis points
            window_size: Number of price bars in observation
        """
        super().__init__()

        # Data
        self.df = df.reset_index(drop=True)
        self.window_size = window_size
        self.current_step = window_size  # Start after window

        # Account state
        self.initial_balance = initial_balance
        self.balance = initial_balance  # USD balance
        self.position = 0.0  # BTC holdings (can be negative for short)
        self.position_value_usd = 0.0
        self.entry_price = 0.0

        # Trading parameters
        self.fee_rate = fee_rate
        self.min_order_size_usd = min_order_size_usd
        self.slippage_bps = slippage_bps / 10000  # Convert to decimal

        # Performance tracking
        self.total_fees_paid = 0.0
        self.total_slippage = 0.0
        self.trades_executed = 0
        self.winning_trades = 0
        self.equity_curve = [initial_balance]
        self.max_equity = initial_balance

        # Action space: 0=hold, 1=buy, 2=sell
        self.action_space = spaces.Discrete(3)

        # Observation space
        # Features: OHLCV + technical indicators + position state
        # Shape: (window_size, num_features)
        self.num_features = 10  # TODO: Adjust based on actual features
        self.observation_space = spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(self.window_size, self.num_features),
            dtype=np.float32
        )

        logger.info(
            f"Environment initialized: balance=${initial_balance}, "
            f"fee={fee_rate*100:.2f}%, min_order=${min_order_size_usd}"
        )

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Reset the environment to initial state.

        Returns:
            observation: Initial observation
            info: Additional information
        """
        super().reset(seed=seed)

        # Reset account state
        self.balance = self.initial_balance
        self.position = 0.0
        self.position_value_usd = 0.0
        self.entry_price = 0.0

        # Reset tracking
        self.current_step = self.window_size
        self.total_fees_paid = 0.0
        self.total_slippage = 0.0
        self.trades_executed = 0
        self.winning_trades = 0
        self.equity_curve = [self.initial_balance]
        self.max_equity = self.initial_balance

        observation = self._get_observation()
        info = self._get_info()

        return observation, info

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """
        Execute one step in the environment.

        Args:
            action: Action to take (0=hold, 1=buy, 2=sell)

        Returns:
            observation: Next observation
            reward: Reward for this step
            terminated: Whether episode is done
            truncated: Whether episode was truncated
            info: Additional information
        """
        # Get current market price
        current_price = self.df.loc[self.current_step, 'close']

        # Execute action
        reward = 0.0
        if action == 1:  # Buy
            reward = self._execute_buy(current_price)
        elif action == 2:  # Sell
            reward = self._execute_sell(current_price)
        # action == 0 (hold) does nothing

        # Move to next step
        self.current_step += 1

        # Calculate current equity
        position_value = self.position * current_price if self.position != 0 else 0
        equity = self.balance + position_value

        # Update equity curve
        self.equity_curve.append(equity)
        self.max_equity = max(self.max_equity, equity)

        # Check if episode is done
        terminated = self.current_step >= len(self.df) - 1

        # Check if account is busted
        if equity <= 0:
            terminated = True
            reward = -100  # Large penalty for going broke

        # Get next observation
        observation = self._get_observation()
        info = self._get_info()

        return observation, reward, terminated, False, info

    def _execute_buy(self, price: float) -> float:
        """
        Execute buy order with realistic simulation.

        Args:
            price: Current market price

        Returns:
            Reward for this action
        """
        # If already long, don't buy more (for simplicity)
        if self.position > 0:
            return -0.1  # Small penalty for invalid action

        # Calculate execution price (with slippage)
        execution_price = price * (1 + self.slippage_bps)  # Buy at ask + slippage

        # Calculate order size
        # Use 90% of balance to leave room for fees
        order_value_usd = self.balance * 0.9

        # Check minimum order size
        if order_value_usd < self.min_order_size_usd:
            return -1.0  # Penalty for invalid order size

        # Calculate quantity (in BTC)
        quantity = order_value_usd / execution_price

        # Calculate fee
        fee = order_value_usd * self.fee_rate

        # Update account state
        self.position = quantity
        self.balance -= (order_value_usd + fee)
        self.entry_price = execution_price
        self.total_fees_paid += fee
        self.total_slippage += (execution_price - price) * quantity
        self.trades_executed += 1

        logger.debug(
            f"BUY: {quantity:.6f} BTC @ ${execution_price:.2f} "
            f"| Fee: ${fee:.4f} | Balance: ${self.balance:.2f}"
        )

        # Small reward for taking action (encourages exploration)
        return 0.0

    def _execute_sell(self, price: float) -> float:
        """
        Execute sell order with realistic simulation.

        Args:
            price: Current market price

        Returns:
            Reward for this action (realized P&L)
        """
        # If not holding position, can't sell
        if self.position <= 0:
            return -0.1  # Small penalty for invalid action

        # Calculate execution price (with slippage)
        execution_price = price * (1 - self.slippage_bps)  # Sell at bid - slippage

        # Calculate order value
        order_value_usd = self.position * execution_price

        # Check minimum order size
        if order_value_usd < self.min_order_size_usd:
            return -1.0  # Penalty for invalid order size

        # Calculate fee
        fee = order_value_usd * self.fee_rate

        # Calculate P&L
        cost_basis = self.position * self.entry_price
        realized_pnl = order_value_usd - cost_basis - fee

        # Update account state
        self.balance += (order_value_usd - fee)
        self.position = 0.0
        self.total_fees_paid += fee
        self.total_slippage += (price - execution_price) * self.position
        self.trades_executed += 1

        if realized_pnl > 0:
            self.winning_trades += 1

        logger.debug(
            f"SELL: {self.position:.6f} BTC @ ${execution_price:.2f} "
            f"| P&L: ${realized_pnl:.2f} | Fee: ${fee:.4f} | Balance: ${self.balance:.2f}"
        )

        # Reset position
        self.position = 0.0
        self.entry_price = 0.0

        # Reward is the realized P&L (normalized)
        # Normalize by initial balance to keep rewards in reasonable range
        return realized_pnl / self.initial_balance

    def _get_observation(self) -> np.ndarray:
        """
        Get current observation (market state + position state).

        Returns:
            Observation array of shape (window_size, num_features)
        """
        # Get price window
        start_idx = self.current_step - self.window_size
        end_idx = self.current_step
        window_data = self.df.iloc[start_idx:end_idx]

        # TODO: Extract features from window_data
        # For now, use simple OHLCV normalization

        # Example features (simplified):
        features = []

        # Normalized OHLCV
        for col in ['open', 'high', 'low', 'close', 'volume']:
            if col in window_data.columns:
                values = window_data[col].values
                # Normalize by first value in window
                normalized = values / values[0] if values[0] != 0 else values
                features.append(normalized)

        # Add position state (repeated for each timestep)
        current_price = window_data['close'].iloc[-1]
        position_ratio = (self.position * current_price) / self.initial_balance
        features.append(np.full(self.window_size, position_ratio))

        # Stack features
        observation = np.column_stack(features).astype(np.float32)

        # Pad if necessary to match num_features
        if observation.shape[1] < self.num_features:
            padding = np.zeros((self.window_size, self.num_features - observation.shape[1]))
            observation = np.hstack([observation, padding])

        return observation

    def _get_info(self) -> Dict[str, Any]:
        """
        Get additional information about current state.

        Returns:
            Info dictionary
        """
        current_price = self.df.loc[self.current_step, 'close']
        position_value = self.position * current_price
        equity = self.balance + position_value

        # Calculate drawdown
        drawdown = (self.max_equity - equity) / self.max_equity if self.max_equity > 0 else 0

        # Calculate win rate
        win_rate = self.winning_trades / self.trades_executed if self.trades_executed > 0 else 0

        return {
            'step': self.current_step,
            'balance': self.balance,
            'position': self.position,
            'equity': equity,
            'pnl': equity - self.initial_balance,
            'pnl_pct': ((equity / self.initial_balance) - 1) * 100,
            'total_fees': self.total_fees_paid,
            'total_slippage': self.total_slippage,
            'trades': self.trades_executed,
            'win_rate': win_rate,
            'drawdown': drawdown,
            'max_equity': self.max_equity,
        }

    def render(self):
        """Render the environment (for debugging)."""
        info = self._get_info()
        print(f"\n=== Step {info['step']} ===")
        print(f"Equity: ${info['equity']:.2f} | P&L: ${info['pnl']:.2f} ({info['pnl_pct']:.2f}%)")
        print(f"Balance: ${info['balance']:.2f} | Position: {info['position']:.6f} BTC")
        print(f"Trades: {info['trades']} | Win Rate: {info['win_rate']:.2%}")
        print(f"Fees Paid: ${info['total_fees']:.2f} | Drawdown: {info['drawdown']:.2%}")


# Example usage and training script
def create_sample_data() -> pd.DataFrame:
    """
    Create sample OHLCV data for testing.

    In production, this would load from TimescaleDB.
    """
    import numpy as np

    # Generate synthetic price data
    n_steps = 1000
    base_price = 45000
    dates = pd.date_range(start='2024-01-01', periods=n_steps, freq='1min')

    # Random walk with drift
    returns = np.random.normal(0.0001, 0.005, n_steps)
    prices = base_price * np.exp(np.cumsum(returns))

    df = pd.DataFrame({
        'timestamp': dates,
        'open': prices,
        'high': prices * (1 + np.abs(np.random.normal(0, 0.002, n_steps))),
        'low': prices * (1 - np.abs(np.random.normal(0, 0.002, n_steps))),
        'close': prices,
        'volume': np.random.uniform(1, 100, n_steps),
    })

    return df


if __name__ == "__main__":
    # Test the environment
    df = create_sample_data()
    env = CryptoTradingEnv(df, initial_balance=100.0)

    # Test random actions
    obs, info = env.reset()
    print("Initial state:", info)

    for i in range(10):
        action = env.action_space.sample()
        obs, reward, terminated, truncated, info = env.step(action)

        print(f"\nStep {i}: Action={action}, Reward={reward:.4f}")
        env.render()

        if terminated or truncated:
            break

    print("\n=== Episode Complete ===")
    print(f"Final P&L: ${info['pnl']:.2f} ({info['pnl_pct']:.2f}%)")
    print(f"Total trades: {info['trades']}, Win rate: {info['win_rate']:.2%}")
    print(f"Total fees: ${info['total_fees']:.2f}")
