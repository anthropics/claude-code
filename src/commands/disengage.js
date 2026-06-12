// Add a new command to reset the authorized engagement context
class DisengageCommand {
  execute(input) {
    const model = this.getModel();
    if (model instanceof Fable5) {
      model.setAuthorizedEngagement(false);
    }
  }
}