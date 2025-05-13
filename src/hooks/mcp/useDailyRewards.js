import { useState, useEffect } from 'react';

/**
 * MCP-integrated daily rewards hook
 * 
 * This hook provides daily rewards management with MCP persistence,
 * replacing the previous DailyRewardsContext implementation.
 */
export function useMcpDailyRewards() {
  const [rewards, setRewards] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todaysClaim, setTodaysClaim] = useState(null);

  // Load rewards data on mount
  useEffect(() => {
    const loadRewards = async () => {
      try {
        setIsLoading(true);
        
        // Try to load from MCP memory
        const response = await fetch('/api/mcp/memory/get', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ key: 'daily_rewards' })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.value) {
            setRewards(data.value);
            
            // Check if there's a reward for today
            const today = new Date().toISOString().split('T')[0];
            const todaysReward = data.value.claims.find(claim => claim.date === today);
            setTodaysClaim(todaysReward || null);
          } else {
            // Initialize default rewards if no saved data exists
            const defaultRewards = {
              streak: 0,
              lastClaim: null,
              claims: [],
              availableRewards: [
                { day: 1, reward: { type: 'points', value: 100 } },
                { day: 2, reward: { type: 'points', value: 200 } },
                { day: 3, reward: { type: 'item', id: 'boost_1', name: 'Score Booster' } },
                { day: 4, reward: { type: 'points', value: 300 } },
                { day: 5, reward: { type: 'points', value: 400 } },
                { day: 6, reward: { type: 'item', id: 'boost_2', name: 'Level Skipper' } },
                { day: 7, reward: { type: 'points', value: 1000 } }
              ]
            };
            setRewards(defaultRewards);
            setTodaysClaim(null);
          }
        } else {
          throw new Error('Failed to load rewards data');
        }
      } catch (err) {
        console.error('Error loading rewards data:', err);
        setError('Failed to load rewards data');
        
        // Fallback to default rewards
        const defaultRewards = {
          streak: 0,
          lastClaim: null,
          claims: [],
          availableRewards: [
            { day: 1, reward: { type: 'points', value: 100 } },
            { day: 2, reward: { type: 'points', value: 200 } },
            { day: 3, reward: { type: 'item', id: 'boost_1', name: 'Score Booster' } },
            { day: 4, reward: { type: 'points', value: 300 } },
            { day: 5, reward: { type: 'points', value: 400 } },
            { day: 6, reward: { type: 'item', id: 'boost_2', name: 'Level Skipper' } },
            { day: 7, reward: { type: 'points', value: 1000 } }
          ]
        };
        setRewards(defaultRewards);
        setTodaysClaim(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRewards();
  }, []);

  // Save rewards data
  const saveRewards = async (newRewards) => {
    try {
      // Update local state
      setRewards(newRewards);
      
      // Save to MCP memory
      const response = await fetch('/api/mcp/memory/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          key: 'daily_rewards',
          value: newRewards,
          ttl: 86400 * 90 // 90 days
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save rewards data');
      }
      
      return true;
    } catch (err) {
      console.error('Error saving rewards data:', err);
      setError('Failed to save rewards data');
      return false;
    }
  };

  // Check if a reward can be claimed today
  const canClaimToday = () => {
    if (!rewards) return false;
    
    const today = new Date().toISOString().split('T')[0];
    return !rewards.claims.some(claim => claim.date === today);
  };

  // Claim today's reward
  const claimDailyReward = async () => {
    if (!rewards || !canClaimToday()) return false;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const lastClaimDate = rewards.lastClaim ? new Date(rewards.lastClaim).toISOString().split('T')[0] : null;
      
      // Check if this is consecutive day
      let newStreak = rewards.streak;
      if (lastClaimDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastClaimDate === yesterdayStr) {
          // Consecutive day
          newStreak++;
        } else {
          // Streak broken
          newStreak = 1;
        }
      } else {
        // First claim
        newStreak = 1;
      }
      
      // Get the reward for current streak day (loop back to day 1 after day 7)
      const rewardDay = ((newStreak - 1) % 7) + 1;
      const reward = rewards.availableRewards.find(r => r.day === rewardDay)?.reward;
      
      if (!reward) {
        throw new Error('Reward not found for streak day');
      }
      
      // Create the claim
      const claim = {
        date: today,
        streakDay: rewardDay,
        reward: reward
      };
      
      // Update rewards data
      const newRewards = {
        ...rewards,
        streak: newStreak,
        lastClaim: new Date().toISOString(),
        claims: [...rewards.claims, claim]
      };
      
      // Save updated rewards
      const success = await saveRewards(newRewards);
      
      if (success) {
        setTodaysClaim(claim);
        return claim;
      } else {
        throw new Error('Failed to save claim');
      }
    } catch (err) {
      console.error('Error claiming reward:', err);
      setError('Failed to claim reward');
      return false;
    }
  };

  // Reset rewards (for testing)
  const resetRewards = async () => {
    const defaultRewards = {
      streak: 0,
      lastClaim: null,
      claims: [],
      availableRewards: rewards?.availableRewards || [
        { day: 1, reward: { type: 'points', value: 100 } },
        { day: 2, reward: { type: 'points', value: 200 } },
        { day: 3, reward: { type: 'item', id: 'boost_1', name: 'Score Booster' } },
        { day: 4, reward: { type: 'points', value: 300 } },
        { day: 5, reward: { type: 'points', value: 400 } },
        { day: 6, reward: { type: 'item', id: 'boost_2', name: 'Level Skipper' } },
        { day: 7, reward: { type: 'points', value: 1000 } }
      ]
    };
    
    return await saveRewards(defaultRewards);
  };

  return {
    rewards,
    todaysClaim,
    isLoading,
    error,
    canClaimToday,
    claimDailyReward,
    resetRewards
  };
}

export default useMcpDailyRewards;