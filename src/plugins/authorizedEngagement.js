// Add a new plugin to provide the authorized engagement context
class AuthorizedEngagementPlugin {
  constructor() {
    this.authorizedEngagement = false;
  }

  // ...

  setAuthorizedEngagement(context) {
    this.authorizedEngagement = context;
  }

  getAuthorizedEngagement() {
    return this.authorizedEngagement;
  }
}