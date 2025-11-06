namespace CCTTB.Orchestration
{
    public interface ISignalFilter
    {
        bool Allow(TradeSignal s, OrchestratorPreset activePreset);
    }
}
