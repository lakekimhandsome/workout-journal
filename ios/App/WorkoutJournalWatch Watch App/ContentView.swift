//
//  ContentView.swift
//  WorkoutJournalWatch Watch App
//
//  Created by 김호수 on 7/7/26.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        GeometryReader { proxy in
            let diameter = min(proxy.size.width, proxy.size.height) * 0.88

            Button(action: {}) {
                Image("AppLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: diameter * 0.56, height: diameter * 0.56)
                    .frame(width: diameter, height: diameter)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.circle)
            .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
        }
    }
}

#Preview {
    ContentView()
}
