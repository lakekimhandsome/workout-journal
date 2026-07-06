//
//  ContentView.swift
//  WorkoutJournalWatch Watch App
//
//  Created by 김호수 on 7/7/26.
//

import SwiftUI
import WatchKit
import Combine
import UIKit

private enum WatchFont {
    static let pretendardBold = "Pretendard-Bold"
    static let phoneTimerTrackingEm: CGFloat = -0.03

    static func timer(size: CGFloat) -> Font {
        if UIFont(name: pretendardBold, size: size) != nil {
            return .custom(pretendardBold, size: size)
        }

        return .system(size: size, weight: .bold)
    }

    static func timerTracking(for size: CGFloat) -> CGFloat {
        size * phoneTimerTrackingEm
    }
}

struct ContentView: View {
    @ObservedObject private var session = WatchSessionManager.shared
    @State private var now = Date()
    @State private var didPlayCompletionHaptic = false

    private let tickTimer = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black

                if session.showsTimer(at: now) {
                    let remaining = session.remainingSeconds(at: now)
                    let progress = session.remainingProgress(at: now)

                    FullScreenWatchButton(size: proxy.size, action: session.sendTimerReset) {
                        TimerDrainView(
                            size: proxy.size,
                            remaining: remaining,
                            progress: progress
                        )
                    }
                } else {
                    FullScreenWatchButton(size: proxy.size, action: session.sendSetButtonPressed) {
                        Image(systemName: "plus")
                            .font(.system(size: min(proxy.size.width, proxy.size.height) * 0.3, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }
            }
            .animation(nil, value: session.showsTimer(at: now))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
        .ignoresSafeArea()
        .onAppear {
            session.activate()
        }
        .onReceive(tickTimer) { date in
            now = date

            if session.showsTimer(at: date), session.remainingSeconds(at: date) <= 0, !didPlayCompletionHaptic {
                WKInterfaceDevice.current().play(.success)
                didPlayCompletionHaptic = true
                return
            }

            if !session.showsTimer(at: date) {
                didPlayCompletionHaptic = false
            }
        }
    }
}

private struct TimerDrainView: View {
    let size: CGSize
    let remaining: Int
    let progress: Double

    private let backgroundAnimation = Animation.linear(duration: 0.95)

    private var whiteHeight: CGFloat {
        size.height * max(0, min(1, progress))
    }

    private var boundaryY: CGFloat {
        size.height - whiteHeight
    }

    private var fontSize: CGFloat {
        min(size.width, size.height) * 0.22
    }

    var body: some View {
        ZStack {
            Color.black

            Rectangle()
                .fill(Color.white)
                .frame(height: whiteHeight)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                .animation(backgroundAnimation, value: whiteHeight)

            SplitColorTimerText(
                text: formatTimer(remaining),
                fontSize: fontSize,
                boundaryY: boundaryY,
                containerSize: size,
                boundaryAnimation: backgroundAnimation
            )
        }
        .frame(width: size.width, height: size.height)
    }

    private func formatTimer(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let restSeconds = seconds % 60
        return String(format: "%d:%02d", minutes, restSeconds)
    }
}

private struct SplitColorTimerText: View {
    let text: String
    let fontSize: CGFloat
    let boundaryY: CGFloat
    let containerSize: CGSize
    let boundaryAnimation: Animation

    private var timerText: some View {
        Text(text)
            .font(WatchFont.timer(size: fontSize))
            .fontWeight(.bold)
            .tracking(WatchFont.timerTracking(for: fontSize))
            .lineLimit(1)
            .contentTransition(.identity)
            .animation(nil, value: text)
    }

    var body: some View {
        ZStack {
            timerText
                .foregroundStyle(.white)
                .mask {
                    Rectangle()
                        .frame(width: containerSize.width, height: max(0, boundaryY))
                        .frame(width: containerSize.width, height: containerSize.height, alignment: .top)
                        .animation(boundaryAnimation, value: boundaryY)
                }

            timerText
                .foregroundStyle(.black)
                .mask {
                    Rectangle()
                        .frame(width: containerSize.width, height: max(0, containerSize.height - boundaryY))
                        .frame(width: containerSize.width, height: containerSize.height, alignment: .top)
                        .offset(y: boundaryY)
                        .animation(boundaryAnimation, value: boundaryY)
                }
        }
        .frame(width: containerSize.width, height: containerSize.height)
    }
}

private struct FullScreenWatchButton<Label: View>: View {
    let size: CGSize
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            Color.black
                .overlay {
                    label()
                        .allowsHitTesting(false)
                }
                .frame(width: size.width, height: size.height)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .frame(width: size.width, height: size.height)
    }
}

#Preview {
    ContentView()
}
