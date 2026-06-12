// Add a new command to set the authorized engagement context
class EngageCommand {
  execute(input) {
    const model = this.getModel();
    if (model instanceof Fable5) {
      model.setAuthorizedEngagement(true);
    }
  }
}