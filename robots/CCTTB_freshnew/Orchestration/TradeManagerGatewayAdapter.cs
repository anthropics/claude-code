using System;
using cAlgo.API;

namespace CCTTB.Orchestration
{
    public class TradeManagerGatewayAdapter : IOrderGateway
    {
        private readonly Robot _robot;
        private readonly TradeManager _tradeManager;

        public TradeManagerGatewayAdapter(Robot robot, TradeManager tradeManager)
        {
            _robot = robot ?? throw new ArgumentNullException(nameof(robot));
            _tradeManager = tradeManager ?? throw new ArgumentNullException(nameof(tradeManager));
        }

        public void OpenFromSignal(TradeSignal signal)
        {
            _robot.Print($"[GATEWAY] Received signal → Calling TradeManager.ExecuteTrade");
            _tradeManager.ExecuteTrade(signal);
            _robot.Print($"[GATEWAY] TradeManager.ExecuteTrade completed");
        }
    }
}
