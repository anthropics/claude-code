namespace CCTTB.Orchestration
{
    public interface IOrderGateway
    {
        void OpenFromSignal(TradeSignal signal);
    }
}
