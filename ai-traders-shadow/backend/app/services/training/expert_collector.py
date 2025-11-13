"""
Expert Demonstration Collector for GAIL Training.

This service collects high-quality trading demonstrations from profitable
paper trades to create a dataset for Imitation Learning (GAIL).

Data Flywheel: Good trades → Expert demonstrations → Better AI → More good trades
"""
import json
import numpy as np
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.core.logger import logger
from app.models.expert_demonstration import ExpertDemonstration
from app.models.trade import TradePaper


class ExpertDemonstrationCollector:
    """
    Collects and stores expert demonstrations from successful paper trades.

    Criteria for "Expert" Trade:
    - P&L > 0.5% (configurable threshold)
    - Win rate > 50% (user consistency)
    - No overtrading (< 10 trades in last hour)
    - Proper risk management
    """

    def __init__(
        self,
        profitability_threshold: float = 0.005,  # 0.5%
        min_win_rate: float = 0.50,  # 50%
        max_trades_per_hour: int = 10,
    ):
        """
        Initialize the expert demonstration collector.

        Args:
            profitability_threshold: Minimum P&L % to be considered expert (default 0.5%)
            min_win_rate: Minimum user win rate to be considered expert
            max_trades_per_hour: Maximum trades to avoid overtrading data
        """
        self.profitability_threshold = profitability_threshold
        self.min_win_rate = min_win_rate
        self.max_trades_per_hour = max_trades_per_hour

    async def collect_demonstration(
        self,
        db: Session,
        user_id: int,
        trade_id: int,
        symbol: str,
        action: int,  # 1: BUY, 2: SELL
        executed_price: float,
        pnl: float,
        observation_data: np.ndarray,  # State BEFORE action (50, 10) array
        market_conditions: Optional[Dict] = None,
        strategy_used: str = "manual",
    ) -> Optional[ExpertDemonstration]:
        """
        Collect a demonstration if it meets expert criteria.

        Args:
            db: Database session
            user_id: User who made the trade
            trade_id: Reference to trades_paper table
            symbol: Trading pair
            action: Action taken (1=BUY, 2=SELL)
            executed_price: Price at execution
            pnl: Profit/loss from the trade
            observation_data: Market state (50x10 numpy array)
            market_conditions: Additional market context
            strategy_used: Strategy type ('manual', 'ppo', 'gail')

        Returns:
            ExpertDemonstration if saved, None if criteria not met
        """
        try:
            # Calculate percentage P&L
            pnl_pct = pnl / executed_price if executed_price > 0 else 0

            # Get user statistics
            user_stats = self._get_user_statistics(db, user_id)

            # Check if trade qualifies as expert
            is_expert = self._is_expert_trade(
                pnl_pct=pnl_pct,
                win_rate=user_stats['win_rate'],
                recent_trades_count=user_stats['recent_trades_count'],
            )

            # Calculate expert score (quality metric)
            expert_score = self._calculate_expert_score(
                pnl_pct=pnl_pct,
                win_rate=user_stats['win_rate'],
                consistency=user_stats['consistency'],
            )

            # Prepare observation data for storage
            observation_json = self._prepare_observation_json(observation_data)

            # Calculate reward signal (for RL training)
            reward = float(pnl_pct)  # Simple reward: normalized P&L

            # Create demonstration record
            demonstration = ExpertDemonstration(
                user_id=user_id,
                trade_id=trade_id,
                symbol=symbol,
                action=action,
                executed_price=executed_price,
                reward=reward,
                pnl=pnl,
                win_rate=user_stats['win_rate'],
                is_expert_trade=is_expert,
                expert_score=expert_score if is_expert else None,
                observation_data=observation_json,
                strategy_used=strategy_used,
                market_conditions=market_conditions or {},
            )

            db.add(demonstration)
            db.commit()
            db.refresh(demonstration)

            if is_expert:
                logger.info(
                    f"✅ Expert demonstration collected! "
                    f"User {user_id}, Trade {trade_id}, "
                    f"P&L: {pnl_pct:.2%}, Score: {expert_score:.2f}"
                )
            else:
                logger.debug(
                    f"📝 Demonstration recorded (not expert): "
                    f"User {user_id}, P&L: {pnl_pct:.2%}"
                )

            return demonstration

        except Exception as e:
            logger.error(f"Error collecting demonstration: {e}")
            db.rollback()
            return None

    def _is_expert_trade(
        self,
        pnl_pct: float,
        win_rate: float,
        recent_trades_count: int,
    ) -> bool:
        """
        Determine if a trade qualifies as an expert demonstration.

        Criteria:
        - Profitable above threshold
        - User has good win rate
        - Not overtrading
        """
        is_profitable = pnl_pct >= self.profitability_threshold
        has_good_win_rate = win_rate >= self.min_win_rate
        not_overtrading = recent_trades_count < self.max_trades_per_hour

        return is_profitable and has_good_win_rate and not_overtrading

    def _calculate_expert_score(
        self,
        pnl_pct: float,
        win_rate: float,
        consistency: float,
    ) -> float:
        """
        Calculate a quality score for the demonstration.

        Higher score = better demonstration for training.

        Components:
        - Profitability (0-40 points): Based on P&L %
        - Win rate (0-30 points): User's historical win rate
        - Consistency (0-30 points): Variance in returns

        Returns:
            Score between 0-100
        """
        # Profitability score (0-40 points)
        profit_score = min(pnl_pct / 0.05, 1.0) * 40  # Cap at 5% profit

        # Win rate score (0-30 points)
        win_rate_score = win_rate * 30

        # Consistency score (0-30 points)
        consistency_score = consistency * 30

        total_score = profit_score + win_rate_score + consistency_score

        return min(total_score, 100.0)

    def _get_user_statistics(self, db: Session, user_id: int) -> Dict:
        """
        Get user trading statistics for quality assessment.

        Returns:
            Dict with win_rate, consistency, recent_trades_count
        """
        try:
            # Get all trades for user
            trades = db.query(TradePaper).filter(
                TradePaper.user_id == user_id
            ).all()

            if not trades:
                return {
                    'win_rate': 0.5,  # Neutral starting point
                    'consistency': 0.5,
                    'recent_trades_count': 0,
                }

            # Calculate win rate
            winning_trades = sum(1 for t in trades if (t.pnl or 0) > 0)
            win_rate = winning_trades / len(trades)

            # Calculate consistency (inverse of P&L variance)
            pnls = [t.pnl or 0 for t in trades]
            consistency = 1.0 / (1.0 + np.std(pnls)) if len(pnls) > 1 else 0.5

            # Count recent trades (last hour)
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            recent_trades = db.query(TradePaper).filter(
                and_(
                    TradePaper.user_id == user_id,
                    TradePaper.executed_at >= one_hour_ago
                )
            ).count()

            return {
                'win_rate': float(win_rate),
                'consistency': float(consistency),
                'recent_trades_count': recent_trades,
            }

        except Exception as e:
            logger.error(f"Error calculating user statistics: {e}")
            return {
                'win_rate': 0.5,
                'consistency': 0.5,
                'recent_trades_count': 0,
            }

    def _prepare_observation_json(self, observation: np.ndarray) -> Dict:
        """
        Convert numpy observation to JSONB format for database storage.

        Args:
            observation: Numpy array (50, 10) - market state

        Returns:
            Dict ready for JSONB storage
        """
        return {
            'features': observation.flatten().tolist(),  # Flatten to 1D list
            'shape': list(observation.shape),  # [50, 10]
            'dtype': str(observation.dtype),
            'normalization': 'minmax',  # Document normalization method
            'version': '1.0',  # Schema version for compatibility
        }

    def get_expert_demonstrations(
        self,
        db: Session,
        limit: int = 1000,
        min_expert_score: float = 70.0,
        symbols: Optional[List[str]] = None,
    ) -> List[ExpertDemonstration]:
        """
        Retrieve expert demonstrations for GAIL training.

        Args:
            db: Database session
            limit: Maximum number of demonstrations
            min_expert_score: Minimum quality score
            symbols: Filter by trading pairs (optional)

        Returns:
            List of expert demonstrations
        """
        query = db.query(ExpertDemonstration).filter(
            and_(
                ExpertDemonstration.is_expert_trade == True,
                ExpertDemonstration.expert_score >= min_expert_score,
            )
        )

        if symbols:
            query = query.filter(ExpertDemonstration.symbol.in_(symbols))

        demonstrations = query.order_by(
            ExpertDemonstration.expert_score.desc()
        ).limit(limit).all()

        logger.info(f"Retrieved {len(demonstrations)} expert demonstrations")

        return demonstrations

    def get_dataset_statistics(self, db: Session) -> Dict:
        """
        Get statistics about the expert demonstration dataset.

        Returns:
            Dict with counts, scores, etc.
        """
        total_demos = db.query(ExpertDemonstration).count()
        expert_demos = db.query(ExpertDemonstration).filter(
            ExpertDemonstration.is_expert_trade == True
        ).count()

        avg_score = db.query(
            func.avg(ExpertDemonstration.expert_score)
        ).filter(
            ExpertDemonstration.is_expert_trade == True
        ).scalar() or 0

        return {
            'total_demonstrations': total_demos,
            'expert_demonstrations': expert_demos,
            'average_expert_score': float(avg_score),
            'expert_percentage': expert_demos / total_demos if total_demos > 0 else 0,
        }


# Global singleton instance
expert_collector = ExpertDemonstrationCollector()
