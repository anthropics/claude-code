import WidgetKit
import SwiftUI

@main
struct ClaudeWidgetBundle: WidgetBundle {
    var body: some Widget {
        ClaudeStatusWidget()
        ClaudeSessionWidget()
    }
}
