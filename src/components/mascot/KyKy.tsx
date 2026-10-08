/**
 * Kỳ Kỳ — linh vật thứ 2 của Aptis Kỳ Tích (bạn thân của Tích Tích).
 * Robot sứ trắng, tai gấu cam, ôm gấu bông. Nhìn theo chuột, chớp mắt, 13 biểu cảm.
 * Tương tác: di chuột vào (vẫy tay), giữ 1.5s (mắt tim), bấm (phản ứng ngẫu nhiên),
 * bấm 5 lần (dỗi), lắc chuột nhanh (chóng mặt), rời chuột (buồn), idle 12s (ngủ).
 * shy = ôm gấu che mặt (ô mật khẩu). Halloween: html.halloween → mũ phù thủy + giỏ bí ngô.
 * Ẩn trên thiết bị cảm ứng. CSS inject 1 lần vào <head>.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export type KyKyMood =
  | "normal" | "happy" | "laugh" | "love" | "star" | "wink"
  | "surprise" | "think" | "worry" | "sad" | "angry" | "sleep" | "shy";

export interface KyKyProps {
  /** Kích thước tương đương Tích Tích (px). Mặc định 110. */
  size?: number;
  mood?: KyKyMood;
  /** Ôm gấu che mặt (ô mật khẩu). */
  shy?: boolean;
  interactive?: boolean;
  idleSleep?: boolean;
  lookAt?: { x: number; y: number } | null;
  bubbleSide?: "top" | "left";
  enterLines?: string[];
  className?: string;
}

const SVG = "<svg aria-hidden=\"true\" viewBox=\"-12 -34 144 184\" xmlns=\"http://www.w3.org/2000/svg\"><defs>\n<radialGradient id=\"shell\" cx=\"35%\" cy=\"25%\" r=\"85%\"><stop offset=\"0\" stop-color=\"#FFFFFF\"/><stop offset=\".5\" stop-color=\"#F6F5F8\"/><stop offset=\".82\" stop-color=\"#E1DEE6\"/><stop offset=\"1\" stop-color=\"#C9C4D2\"/></radialGradient>\n<radialGradient id=\"shellB\" cx=\"40%\" cy=\"30%\" r=\"80%\"><stop offset=\"0\" stop-color=\"#FFFFFF\"/><stop offset=\".6\" stop-color=\"#F1EFF4\"/><stop offset=\"1\" stop-color=\"#CFCAD8\"/></radialGradient>\n<linearGradient id=\"org\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#FF7A1A\"/><stop offset=\"1\" stop-color=\"#FFAA22\"/></linearGradient>\n<radialGradient id=\"orgBall\" cx=\"35%\" cy=\"30%\" r=\"75%\"><stop offset=\"0\" stop-color=\"#FFD27A\"/><stop offset=\".45\" stop-color=\"#FF9A22\"/><stop offset=\"1\" stop-color=\"#EE6510\"/></radialGradient>\n<radialGradient id=\"visor\" cx=\"42%\" cy=\"32%\" r=\"80%\"><stop offset=\"0\" stop-color=\"#FFFFFF\"/><stop offset=\".75\" stop-color=\"#FBFAFC\"/><stop offset=\"1\" stop-color=\"#ECE8F0\"/></radialGradient>\n<radialGradient id=\"eyeGlow\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0\" stop-color=\"#FFE7B8\"/><stop offset=\".45\" stop-color=\"#FFB04A\"/><stop offset=\"1\" stop-color=\"#FF7A1A\" stop-opacity=\"0\"/></radialGradient>\n<radialGradient id=\"earDisc\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0\" stop-color=\"#FFD58A\"/><stop offset=\".45\" stop-color=\"#FFAA22\"/><stop offset=\".8\" stop-color=\"#F07A18\"/><stop offset=\"1\" stop-color=\"#C85A10\"/></radialGradient>\n<radialGradient id=\"bearG\" cx=\"40%\" cy=\"30%\" r=\"85%\"><stop offset=\"0\" stop-color=\"#C4875A\"/><stop offset=\".7\" stop-color=\"#A86C44\"/><stop offset=\"1\" stop-color=\"#8C5733\"/></radialGradient>\n<filter id=\"soft\" x=\"-80%\" y=\"-80%\" width=\"260%\" height=\"260%\"><feGaussianBlur stdDeviation=\"2\"/></filter>\n<filter id=\"soft4\" x=\"-100%\" y=\"-100%\" width=\"300%\" height=\"300%\"><feGaussianBlur stdDeviation=\"4\"/></filter>\n<filter id=\"glowF\" x=\"-100%\" y=\"-100%\" width=\"300%\" height=\"300%\"><feGaussianBlur stdDeviation=\"1.6\" result=\"b\"/><feMerge><feMergeNode in=\"b\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter>\n<filter id=\"fuzz\" x=\"-10%\" y=\"-10%\" width=\"120%\" height=\"120%\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"1.2\" numOctaves=\"1\" result=\"n\"/><feDisplacementMap in=\"SourceGraphic\" in2=\"n\" scale=\"0.9\"/></filter>\n\n<radialGradient id=\"wBody\" cx=\"38%\" cy=\"30%\" r=\"80%\"><stop offset=\"0\" stop-color=\"#FFFFFF\"/><stop offset=\".55\" stop-color=\"#F7F5F9\"/><stop offset=\".85\" stop-color=\"#E6E2EB\"/><stop offset=\"1\" stop-color=\"#D4CEDC\"/></radialGradient>\n<radialGradient id=\"wFace\" cx=\"45%\" cy=\"35%\" r=\"75%\"><stop offset=\"0\" stop-color=\"#FFFFFF\"/><stop offset=\".8\" stop-color=\"#FBFAFC\"/><stop offset=\"1\" stop-color=\"#EFEBF3\"/></radialGradient>\n<linearGradient id=\"org5\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#FF7A1A\"/><stop offset=\"1\" stop-color=\"#FFAA22\"/></linearGradient>\n<linearGradient id=\"orgH\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#FF7A1A\"/><stop offset=\"1\" stop-color=\"#FFAA22\"/></linearGradient>\n<radialGradient id=\"orgBall5\" cx=\"35%\" cy=\"30%\" r=\"75%\"><stop offset=\"0\" stop-color=\"#FFD27A\"/><stop offset=\".45\" stop-color=\"#FF9A22\"/><stop offset=\"1\" stop-color=\"#F26A12\"/></radialGradient>\n<radialGradient id=\"bearG5\" cx=\"38%\" cy=\"32%\" r=\"80%\"><stop offset=\"0\" stop-color=\"#D59A68\"/><stop offset=\".65\" stop-color=\"#A56A3C\"/><stop offset=\"1\" stop-color=\"#7E4B25\"/></radialGradient>\n<radialGradient id=\"bearL5\" cx=\"45%\" cy=\"40%\" r=\"70%\"><stop offset=\"0\" stop-color=\"#F7DEC0\"/><stop offset=\"1\" stop-color=\"#DDB287\"/></radialGradient>\n<radialGradient id=\"bulbG\" cx=\"40%\" cy=\"35%\" r=\"70%\"><stop offset=\"0\" stop-color=\"#FFFFFF\"/><stop offset=\".6\" stop-color=\"#FFF6DD\"/><stop offset=\"1\" stop-color=\"#FFE3A3\"/></radialGradient>\n<radialGradient id=\"glow\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0\" stop-color=\"#FFD66B\" stop-opacity=\".85\"/><stop offset=\"1\" stop-color=\"#FFD66B\" stop-opacity=\"0\"/></radialGradient>\n\n\n<filter id=\"drop\" x=\"-60%\" y=\"-60%\" width=\"220%\" height=\"220%\"><feDropShadow dx=\"0\" dy=\"3\" stdDeviation=\"3.5\" flood-color=\"#5a3a6b\" flood-opacity=\".22\"/></filter>\n\n</defs><ellipse class=\"kk-shadow\" cx=\"60\" cy=\"146\" rx=\"24\" ry=\"4\" fill=\"#6b4a7a\" opacity=\".18\" filter=\"url(#soft4)\"/><g class=\"kk-float\"><ellipse cx=\"60\" cy=\"114\" rx=\"25\" ry=\"20\" fill=\"url(#shellB)\"/><ellipse cx=\"50\" cy=\"104\" rx=\"7\" ry=\"4.5\" fill=\"#fff\" opacity=\".95\" filter=\"url(#soft)\"/><ellipse cx=\"60\" cy=\"129\" rx=\"20\" ry=\"5\" fill=\"#B7B0C2\" opacity=\".35\" filter=\"url(#soft4)\"/><circle cx=\"62\" cy=\"116\" r=\"9.5\" fill=\"url(#org)\"/><circle cx=\"62\" cy=\"116\" r=\"7\" fill=\"#FBFAFC\"/><text x=\"62\" y=\"119.6\" text-anchor=\"middle\" font-family=\"'Baloo 2',system-ui,sans-serif\" font-weight=\"800\" font-size=\"9.5\" fill=\"#EE6510\">K</text><g class=\"kk-hand-r\"><ellipse cx=\"87.7\" cy=\"121.6\" rx=\"7\" ry=\"6.4\" fill=\"url(#orgBall)\"/><ellipse cx=\"85.5\" cy=\"119.4\" rx=\"2\" ry=\"1.4\" fill=\"#fff\" opacity=\".7\"/><path d=\"M84.7 124.6 q3 2 6 0\" stroke=\"#E0600F\" stroke-width=\".9\" fill=\"none\" opacity=\".7\"/></g><g class=\"kk-hw kk-pumpkin\"><path d=\"M77 128 Q84 118 91 128\" stroke=\"#3A2470\" stroke-width=\"1.6\" fill=\"none\"/><ellipse cx=\"84\" cy=\"134\" rx=\"10\" ry=\"8\" fill=\"#FF8A1E\"/><ellipse cx=\"84\" cy=\"134\" rx=\"4\" ry=\"8\" fill=\"#FFA43A\"/><path d=\"M79 132 l2 -2 l2 2 Z M85 132 l2 -2 l2 2 Z\" fill=\"#3A1A00\"/><path d=\"M80 137 Q84 140 88 137\" stroke=\"#3A1A00\" stroke-width=\"1.4\" fill=\"none\"/></g><g class=\"kk-head\"><g class=\"kk-wires\"><path d=\"M48 22 Q42 8 36 -6\" stroke=\"#E9E7EE\" stroke-width=\"1.5\" fill=\"none\"/><path d=\"M53 19 Q51 4 49 -10\" stroke=\"#E9E7EE\" stroke-width=\"1.5\" fill=\"none\"/><rect x=\"34.2\" y=\"-12\" width=\"3.8\" height=\"6.5\" rx=\"1.7\" fill=\"#fff\" stroke=\"#CFCAD8\" stroke-width=\".6\"/><rect x=\"47.2\" y=\"-16\" width=\"3.8\" height=\"6.5\" rx=\"1.7\" fill=\"#fff\" stroke=\"#CFCAD8\" stroke-width=\".6\"/><circle cx=\"36.1\" cy=\"-12.5\" r=\"1.5\" fill=\"#FFAA22\"/><circle cx=\"49.1\" cy=\"-16.5\" r=\"1.5\" fill=\"#FFAA22\"/></g><circle cx=\"28\" cy=\"25\" r=\"11\" fill=\"url(#orgBall5)\"/><circle cx=\"28\" cy=\"26\" r=\"5.6\" fill=\"#FFE0B0\" opacity=\".85\"/><circle cx=\"92\" cy=\"25\" r=\"11\" fill=\"url(#orgBall5)\"/><circle cx=\"92\" cy=\"26\" r=\"5.6\" fill=\"#FFE0B0\" opacity=\".85\"/><clipPath id=\"c65894\"><ellipse cx=\"60\" cy=\"58\" rx=\"47\" ry=\"42\"/></clipPath><ellipse cx=\"60\" cy=\"58\" rx=\"47\" ry=\"42\" fill=\"url(#wBody)\" stroke=\"#E2DCE8\" stroke-width=\"1\"/><g clip-path=\"url(#c65894)\"><ellipse cx=\"60\" cy=\"81.1\" rx=\"37.6\" ry=\"14.7\" fill=\"#B9B0C6\" opacity=\".28\" filter=\"url(#soft4)\"/><ellipse cx=\"43.55\" cy=\"39.099999999999994\" rx=\"15.040000000000001\" ry=\"7.56\" fill=\"#fff\" opacity=\".95\" filter=\"url(#soft)\" transform=\"rotate(-20 43.55 39.099999999999994)\"/></g><ellipse cx=\"60\" cy=\"61\" rx=\"35\" ry=\"27\" fill=\"url(#org)\"/><ellipse cx=\"60\" cy=\"61\" rx=\"31.5\" ry=\"23.5\" fill=\"url(#visor)\"/><path d=\"M33 54 Q36 42 50 38\" stroke=\"#FFD9A8\" stroke-width=\"1.5\" opacity=\".9\" fill=\"none\" stroke-linecap=\"round\"/><g class=\"kk-std\"><g class=\"kk-bow\"><g transform=\"translate(93 34) rotate(-12) scale(1.0)\"><path d=\"M0 0 C-10 -10 -13 5 -2 3.5 Z\" fill=\"url(#org)\"/><path d=\"M0 0 C10 -10 13 5 2 3.5 Z\" fill=\"url(#org)\"/><circle cx=\"0\" cy=\"1\" r=\"2.8\" fill=\"#F06A12\"/><path d=\"M-7 -3.5 Q-6 -5 -4 -4.5\" stroke=\"#fff\" stroke-width=\"1.2\" opacity=\".7\" fill=\"none\"/></g></g></g><g class=\"kk-hw\"><path d=\"M30 26 Q60 16 92 24 Q96 28 92 31 Q60 24 28 33 Q24 30 30 26 Z\" fill=\"#3A2470\"/><path d=\"M40 27 Q50 -6 72 -26 Q70 -6 82 24 Q60 20 40 27 Z\" fill=\"#4B2E8F\"/><path d=\"M41 24 Q60 18 81 21 L80 15 Q60 12 43 18 Z\" fill=\"url(#org)\"/><path d=\"M72 -26 Q80 -24 84 -16\" stroke=\"#4B2E8F\" stroke-width=\"5\" fill=\"none\" stroke-linecap=\"round\"/><path transform=\"translate(58 4) scale(.5)\" d=\"M0 -8 Q1 -1 8 0 Q1 1 0 8 Q-1 1 -8 0 Q-1 -1 0 -8 Z\" fill=\"#FFC531\"/></g><g class=\"kk-face\"><g class=\"kk-eyes-normal\"><g class=\"kk-eye\"><ellipse cx=\"47\" cy=\"60\" rx=\"9.4\" ry=\"10.8\" fill=\"#EEEAF4\"/><g class=\"kk-pupil\"><ellipse cx=\"47\" cy=\"60\" rx=\"7.4\" ry=\"8.8\" fill=\"#2A1458\"/><ellipse cx=\"47\" cy=\"63\" rx=\"5\" ry=\"4\" fill=\"#5B3FA8\" opacity=\".55\"/><g class=\"kk-glint\"><circle cx=\"49.6\" cy=\"56.6\" r=\"2.8\" fill=\"#fff\"/><circle cx=\"44.6\" cy=\"63.3\" r=\"1.2\" fill=\"#fff\" opacity=\".85\"/></g></g><path d=\"M41.0 53.0 q-3.0 -1 -5.0 -4.5\" stroke=\"#2A1458\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M39.0 57.0 q-3.0 0 -5.5 -2.5\" stroke=\"#2A1458\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\"/><ellipse class=\"kk-lid\" cx=\"47\" cy=\"60\" rx=\"9.6\" ry=\"11.2\" fill=\"#FCFBFD\"/><path class=\"kk-lid\" d=\"M39 60 Q47 65 55 60\" stroke=\"#2A1458\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/></g><g class=\"kk-eye\"><ellipse cx=\"73\" cy=\"60\" rx=\"9.4\" ry=\"10.8\" fill=\"#EEEAF4\"/><g class=\"kk-pupil\"><ellipse cx=\"73\" cy=\"60\" rx=\"7.4\" ry=\"8.8\" fill=\"#2A1458\"/><ellipse cx=\"73\" cy=\"63\" rx=\"5\" ry=\"4\" fill=\"#5B3FA8\" opacity=\".55\"/><g class=\"kk-glint\"><circle cx=\"75.6\" cy=\"56.6\" r=\"2.8\" fill=\"#fff\"/><circle cx=\"70.6\" cy=\"63.3\" r=\"1.2\" fill=\"#fff\" opacity=\".85\"/></g></g><path d=\"M79.0 53.0 q3.0 -1 5.0 -4.5\" stroke=\"#2A1458\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M81.0 57.0 q3.0 0 5.5 -2.5\" stroke=\"#2A1458\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\"/><ellipse class=\"kk-lid\" cx=\"73\" cy=\"60\" rx=\"9.6\" ry=\"11.2\" fill=\"#FCFBFD\"/><path class=\"kk-lid\" d=\"M65 60 Q73 65 81 60\" stroke=\"#2A1458\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/></g></g><g class=\"kk-x kk-x-happy\"><path d=\"M39 62 Q47 52 55 62\" stroke=\"#2A1458\" stroke-width=\"3.6\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M39.0 61.0 l-4.0 -3\" stroke=\"#2A1458\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><path d=\"M65 62 Q73 52 81 62\" stroke=\"#2A1458\" stroke-width=\"3.6\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M81.0 61.0 l4.0 -3\" stroke=\"#2A1458\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></g><g class=\"kk-x kk-x-laugh\"><path d=\"M39 59 Q47 66 55 59\" stroke=\"#2A1458\" stroke-width=\"3.2\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M39.0 59.0 l-4.0 2\" stroke=\"#2A1458\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M65 59 Q73 66 81 59\" stroke=\"#2A1458\" stroke-width=\"3.2\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M81.0 59.0 l4.0 2\" stroke=\"#2A1458\" stroke-width=\"2\" stroke-linecap=\"round\"/></g><g class=\"kk-x kk-x-love\"><g class=\"kk-heart\"><path transform=\"translate(47 60) scale(1.15)\" d=\"M0 7 C-10 0 -9 -9 -4 -9 C-1.5 -9 0 -7 0 -5 C0 -7 1.5 -9 4 -9 C9 -9 10 0 0 7 Z\" fill=\"#FF4F6E\"/><circle cx=\"43.5\" cy=\"55\" r=\"1.5\" fill=\"#fff\" opacity=\".9\"/></g><g class=\"kk-heart\"><path transform=\"translate(73 60) scale(1.15)\" d=\"M0 7 C-10 0 -9 -9 -4 -9 C-1.5 -9 0 -7 0 -5 C0 -7 1.5 -9 4 -9 C9 -9 10 0 0 7 Z\" fill=\"#FF4F6E\"/><circle cx=\"69.5\" cy=\"55\" r=\"1.5\" fill=\"#fff\" opacity=\".9\"/></g></g><g class=\"kk-x kk-x-star\"><g class=\"kk-star\"><polygon points=\"47.0,50.0 49.6,56.4 56.5,56.9 51.2,61.4 52.9,68.1 47.0,64.4 41.1,68.1 42.8,61.4 37.5,56.9 44.4,56.4\" fill=\"url(#orgBall)\"/></g><g class=\"kk-star\"><polygon points=\"73.0,50.0 75.6,56.4 82.5,56.9 77.2,61.4 78.9,68.1 73.0,64.4 67.1,68.1 68.8,61.4 63.5,56.9 70.4,56.4\" fill=\"url(#orgBall)\"/></g></g><g class=\"kk-x kk-x-wink\"><path d=\"M65 62 Q73 52 81 62\" stroke=\"#2A1458\" stroke-width=\"3.6\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M81.0 61.0 l4.0 -3\" stroke=\"#2A1458\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></g><g class=\"kk-x kk-x-sleep\"><path d=\"M39 59 Q47 66 55 59\" stroke=\"#2A1458\" stroke-width=\"3.2\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M39.0 59.0 l-4.0 2\" stroke=\"#2A1458\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M65 59 Q73 66 81 59\" stroke=\"#2A1458\" stroke-width=\"3.2\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M81.0 59.0 l4.0 2\" stroke=\"#2A1458\" stroke-width=\"2\" stroke-linecap=\"round\"/><g class=\"kk-zzz\"><text x=\"96\" y=\"22\" font-family=\"'Baloo 2',system-ui,sans-serif\" font-weight=\"800\" font-size=\"14\" fill=\"#7B5CFF\">z</text><text x=\"104\" y=\"12\" font-family=\"'Baloo 2',system-ui,sans-serif\" font-weight=\"800\" font-size=\"10\" fill=\"#7B5CFF\">z</text></g></g><g class=\"kk-x kk-x-worry\"><path d=\"M38 45 L52 42 M82 45 L68 42\" stroke=\"#2A1458\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><path class=\"kk-sweat\" d=\"M95 40 C91 48 92 52 95 52 C98 52 99 48 95 40 Z\" fill=\"#7CCBFF\"/></g><g class=\"kk-x kk-x-surprise\"><text class=\"kk-qmark\" x=\"98\" y=\"26\" font-family=\"'Baloo 2',system-ui,sans-serif\" font-weight=\"800\" font-size=\"18\" fill=\"#FF8A2A\">!</text></g><g class=\"kk-x kk-x-sad\"><path d=\"M38 46 L52 49 M82 46 L68 49\" stroke=\"#2A1458\" stroke-width=\"2.2\" stroke-linecap=\"round\" transform=\"rotate(180 60 47.5) translate(0 0)\"/><path class=\"kk-tear\" d=\"M41 70 C38 76 39 79 41 79 C43 79 44 76 41 70 Z\" fill=\"#7CCBFF\"/></g><g class=\"kk-x kk-x-angry\"><path d=\"M38 43 L53 47 M82 43 L67 47\" stroke=\"#2A1458\" stroke-width=\"2.6\" stroke-linecap=\"round\"/><path d=\"M95 30 l4 4 m0 -4 l-4 4 M101 28 l3 3\" stroke=\"#FF4F4F\" stroke-width=\"2.4\" stroke-linecap=\"round\"/></g><g class=\"kk-x kk-x-think\"><text class=\"kk-qmark\" x=\"96\" y=\"24\" font-family=\"'Baloo 2',system-ui,sans-serif\" font-weight=\"800\" font-size=\"16\" fill=\"#7B5CFF\">?</text></g><g class=\"kk-cheek\"><ellipse cx=\"36\" cy=\"71\" rx=\"5.2\" ry=\"3.6\" fill=\"#FF8FA3\"/><ellipse cx=\"84\" cy=\"71\" rx=\"5.2\" ry=\"3.6\" fill=\"#FF8FA3\"/></g><g class=\"kk-m kk-m-smile\"><g transform=\"translate(0 -2)\"><path d=\"M53 75 Q60 81 67 75\" stroke=\"#E8571A\" stroke-width=\"3.2\" fill=\"none\" stroke-linecap=\"round\"/></g></g><g class=\"kk-m kk-m-big\"><g transform=\"translate(0 -2)\"><path d=\"M51 73 Q60 73 69 73 Q68 84 60 84 Q52 84 51 73 Z\" fill=\"#E8571A\"/><path d=\"M54.5 80 Q60 76.5 65.5 80 Q63 83.5 60 83.5 Q57 83.5 54.5 80Z\" fill=\"#FF95A6\"/></g></g><g class=\"kk-m kk-m-laugh\"><g transform=\"translate(0 -2)\"><path d=\"M51 73 Q60 73 69 73 Q68 84 60 84 Q52 84 51 73 Z\" fill=\"#E8571A\"/><path d=\"M54.5 80 Q60 76.5 65.5 80 Q63 83.5 60 83.5 Q57 83.5 54.5 80Z\" fill=\"#FF95A6\"/></g></g><g class=\"kk-m kk-m-o\"><g transform=\"translate(0 -2)\"><ellipse cx=\"60\" cy=\"77\" rx=\"4.2\" ry=\"5\" fill=\"#E8571A\"/></g></g><g class=\"kk-m kk-m-cat\"><g transform=\"translate(0 -2)\"><path d=\"M53 75 Q56.5 79 60 75 Q63.5 79 67 75\" stroke=\"#E8571A\" stroke-width=\"2.8\" fill=\"none\" stroke-linecap=\"round\"/></g></g><g class=\"kk-m kk-m-sad\"><g transform=\"translate(0 -2)\"><path d=\"M54 79 Q60 74 66 79\" stroke=\"#E8571A\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/></g></g><g class=\"kk-m kk-m-kiss\"><g transform=\"translate(0 -2)\"><path d=\"M58 72 Q64 74 59 77 Q64 80 58 82\" stroke=\"#E8571A\" stroke-width=\"2.8\" fill=\"none\" stroke-linecap=\"round\"/></g></g><g class=\"kk-m kk-m-flat\"><path d=\"M54 74 H66\" stroke=\"#E8571A\" stroke-width=\"3\" stroke-linecap=\"round\"/></g><g class=\"kk-m kk-m-pout\"><path d=\"M55 75 Q60 71 65 75\" stroke=\"#E8571A\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/></g><g class=\"kk-m kk-m-tongue\"><path d=\"M53 72 Q60 78 67 72\" stroke=\"#E8571A\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M58 75 Q58 82 62 82 Q65.5 82 65 75 Z\" fill=\"#FF6F91\"/></g></g></g><g class=\"kk-bear\"><g transform=\"translate(31 118) rotate(-10) scale(1.0)\"><g filter=\"url(#fuzz)\"><ellipse cx=\"-11\" cy=\"24\" rx=\"6.5\" ry=\"7.5\" fill=\"#8C5733\"/><ellipse cx=\"11\" cy=\"24\" rx=\"6.5\" ry=\"7.5\" fill=\"#8C5733\"/><ellipse cx=\"-11\" cy=\"26\" rx=\"4\" ry=\"4.5\" fill=\"#B57A4D\"/><ellipse cx=\"11\" cy=\"26\" rx=\"4\" ry=\"4.5\" fill=\"#B57A4D\"/><ellipse cx=\"0\" cy=\"13\" rx=\"13\" ry=\"13\" fill=\"url(#bearG)\"/><ellipse cx=\"-14\" cy=\"8\" rx=\"5\" ry=\"8\" fill=\"url(#bearG)\" transform=\"rotate(35 -14 8)\"/><ellipse cx=\"14\" cy=\"8\" rx=\"5\" ry=\"8\" fill=\"url(#bearG)\" transform=\"rotate(-35 14 8)\"/><circle cx=\"-11\" cy=\"-11\" r=\"5.5\" fill=\"url(#bearG)\"/><circle cx=\"11\" cy=\"-11\" r=\"5.5\" fill=\"url(#bearG)\"/><circle cx=\"-11\" cy=\"-11\" r=\"3\" fill=\"#D9A47A\"/><circle cx=\"11\" cy=\"-11\" r=\"3\" fill=\"#D9A47A\"/><ellipse cx=\"0\" cy=\"-2\" rx=\"14\" ry=\"13\" fill=\"url(#bearG)\"/></g><ellipse cx=\"0\" cy=\"3\" rx=\"6.5\" ry=\"5\" fill=\"#E8C9A6\"/><ellipse cx=\"0\" cy=\"1.2\" rx=\"2.1\" ry=\"1.5\" fill=\"#1E120A\"/><path d=\"M0 2.6 V4.4 M-2.4 4.6 Q0 7.4 2.4 4.6\" stroke=\"#1E120A\" stroke-width=\".9\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"-5\" cy=\"-3.5\" r=\"1.7\" fill=\"#1E120A\"/><circle cx=\"5\" cy=\"-3.5\" r=\"1.7\" fill=\"#1E120A\"/><path d=\"M0 10 C-7 4 -10 14 -1.5 12 Z\" fill=\"#E0242E\"/><path d=\"M0 10 C7 4 10 14 1.5 12 Z\" fill=\"#E0242E\"/><path d=\"M-1 11.5 L-4 17 M1 11.5 L4 17\" stroke=\"#E0242E\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"0\" cy=\"11\" r=\"1.8\" fill=\"#B5141D\"/></g><g class=\"kk-hw\"><path d=\"M20 107 Q31 98 42 106 Q31 103 20 107 Z\" fill=\"#3A2470\"/><path d=\"M24 106 Q29 92 36 86 Q35 96 39 105 Z\" fill=\"#4B2E8F\"/></g><ellipse cx=\"45\" cy=\"132\" rx=\"6\" ry=\"4.6\" fill=\"url(#orgBall)\" transform=\"rotate(-20 45 132)\"/></g><g class=\"kk-fx kk-fx-love\"><path transform=\"translate(108 40) scale(.4)\" d=\"M0 12 C-18 0 -16 -15 -7 -15 C-3 -15 0 -12 0 -8 C0 -12 3 -15 7 -15 C16 -15 18 0 0 12 Z\" fill=\"#FF4F6E\"/><path transform=\"translate(14 36) scale(.3)\" d=\"M0 12 C-18 0 -16 -15 -7 -15 C-3 -15 0 -12 0 -8 C0 -12 3 -15 7 -15 C16 -15 18 0 0 12 Z\" fill=\"#FF4F6E\"/></g><g class=\"kk-fx kk-fx-star\"><path transform=\"translate(110 30) scale(.8)\" d=\"M0 -8 Q1 -1 8 0 Q1 1 0 8 Q-1 1 -8 0 Q-1 -1 0 -8 Z\" fill=\"#FFC531\"/><path transform=\"translate(8 50) scale(.6)\" d=\"M0 -8 Q1 -1 8 0 Q1 1 0 8 Q-1 1 -8 0 Q-1 -1 0 -8 Z\" fill=\"#FF8FB1\"/></g></g></svg>";

const CSS = "/* ===== Kỳ Kỳ ===== */\n.kk-robot{width:var(--s);position:relative;user-select:none;flex-shrink:0}\n.kk-robot.kk-interactive{cursor:pointer}\n.kk-robot svg{width:100%;height:auto;overflow:visible;display:block}\n.kk-robot .kk-float{animation:kk-bob 3.2s ease-in-out infinite;transform-origin:60px 120px}\n.kk-robot .kk-shadow{animation:kk-shadow 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}\n@keyframes kk-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}\n@keyframes kk-shadow{0%,100%{transform:scale(1);opacity:.18}50%{transform:scale(.88);opacity:.12}}\n.kk-robot .kk-head{transition:transform .25s ease-out;transform-origin:60px 80px}\n.kk-robot .kk-pupil{transition:transform .06s linear}.kk-robot .kk-face{transition:transform .1s linear}\n.kk-robot .kk-lid{transform-box:fill-box;transform-origin:center;transform:scaleY(0);opacity:0;transition:transform .08s,opacity .08s}\n.kk-robot.kk-blink .kk-lid{transform:scaleY(1);opacity:1}\n.kk-robot .kk-wires{transform-origin:50px 22px;animation:kk-sway 2.6s ease-in-out infinite}\n@keyframes kk-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}\n.kk-robot .kk-bow{transform-box:fill-box;transform-origin:center;animation:kk-bowwig 4s ease-in-out infinite}\n@keyframes kk-bowwig{0%,86%,100%{transform:rotate(0)}91%{transform:rotate(-14deg)}96%{transform:rotate(10deg)}}\n.kk-robot .kk-bear{transform-origin:40px 128px;animation:kk-bearsway 3.2s ease-in-out infinite}\n@keyframes kk-bearsway{0%,100%{transform:rotate(0)}50%{transform:rotate(-3deg)}}\n.kk-robot .kk-hand-r{transform-origin:84px 104px;transition:transform .35s cubic-bezier(.3,1.4,.5,1)}\n.kk-robot .kk-x,.kk-robot .kk-m,.kk-robot .kk-fx,.kk-robot .kk-hw{display:none}\n.kk-robot .kk-m-smile{display:inline}\n.kk-robot .kk-cheek{opacity:.5;transition:opacity .2s}\n/* biểu cảm */\n.kk-robot[data-mood=happy] .kk-eyes-normal,.kk-robot[data-mood=laugh] .kk-eyes-normal,.kk-robot[data-mood=love] .kk-eyes-normal,.kk-robot[data-mood=star] .kk-eyes-normal,.kk-robot[data-mood=sleep] .kk-eyes-normal{display:none}\n.kk-robot[data-mood=wink] .kk-eye:last-child{display:none}\n.kk-robot[data-mood]:not([data-mood=normal]):not([data-mood=think]) .kk-m-smile{display:none}\n.kk-robot[data-mood=happy] .kk-x-happy,.kk-robot[data-mood=happy] .kk-m-big{display:inline}\n.kk-robot[data-mood=laugh] .kk-x-laugh,.kk-robot[data-mood=laugh] .kk-m-laugh{display:inline}\n.kk-robot[data-mood=love] .kk-x-love,.kk-robot[data-mood=love] .kk-m-kiss,.kk-robot[data-mood=love] .kk-fx-love{display:inline}\n.kk-robot[data-mood=star] .kk-x-star,.kk-robot[data-mood=star] .kk-m-big,.kk-robot[data-mood=star] .kk-fx-star{display:inline}\n.kk-robot[data-mood=wink] .kk-x-wink,.kk-robot[data-mood=wink] .kk-m-tongue{display:inline}\n.kk-robot[data-mood=sleep] .kk-x-sleep,.kk-robot[data-mood=sleep] .kk-m-o{display:inline}\n.kk-robot[data-mood=worry] .kk-x-worry,.kk-robot[data-mood=worry] .kk-m-flat{display:inline}\n.kk-robot[data-mood=surprise] .kk-x-surprise,.kk-robot[data-mood=surprise] .kk-m-o{display:inline}\n.kk-robot[data-mood=sad] .kk-x-sad,.kk-robot[data-mood=sad] .kk-m-sad{display:inline}\n.kk-robot[data-mood=angry] .kk-x-angry,.kk-robot[data-mood=angry] .kk-m-pout{display:inline}\n.kk-robot[data-mood=think] .kk-x-think{display:inline}\n.kk-robot[data-mood=shy] .kk-m-cat{display:inline}\n.kk-robot[data-mood=happy] .kk-cheek,.kk-robot[data-mood=laugh] .kk-cheek,.kk-robot[data-mood=love] .kk-cheek,.kk-robot[data-mood=shy] .kk-cheek{opacity:.95}\n.kk-robot[data-mood=angry] .kk-cheek{opacity:1}\n.kk-robot[data-mood=surprise] .kk-pupil{transform:scale(1.18)!important;transform-box:fill-box;transform-origin:center}\n.kk-robot[data-mood=think] .kk-pupil{transform:translate(3px,-4px)!important}\n.kk-robot[data-mood=sad] .kk-pupil{transform:translate(0,3px) scale(.9)!important;transform-box:fill-box;transform-origin:center}\n.kk-robot[data-mood=worry] .kk-pupil{transform:scale(.82)!important;transform-box:fill-box;transform-origin:center}\n.kk-robot[data-mood=happy] .kk-float,.kk-robot[data-mood=laugh] .kk-float{animation:kk-hop .9s ease-in-out infinite}\n@keyframes kk-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-10px)}60%{transform:translateY(-8px)}}\n.kk-robot[data-mood=laugh] .kk-head{animation:kk-shake .35s ease-in-out infinite}\n@keyframes kk-shake{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}\n.kk-robot .kk-heart{transform-box:fill-box;transform-origin:center;animation:kk-beat .8s ease-in-out infinite}\n@keyframes kk-beat{0%,100%{transform:scale(1)}30%{transform:scale(1.25)}}\n.kk-robot .kk-star{transform-box:fill-box;transform-origin:center;animation:kk-twinkle 1.6s linear infinite}\n@keyframes kk-twinkle{0%,100%{transform:rotate(0) scale(1)}50%{transform:rotate(20deg) scale(1.15)}}\n.kk-robot .kk-fx path{animation:kk-spark 1.3s ease-in-out infinite}\n@keyframes kk-spark{0%,100%{opacity:1;transform-origin:center}50%{opacity:.25}}\n.kk-robot .kk-tear{animation:kk-drop 1.6s ease-in infinite}\n.kk-robot .kk-sweat{animation:kk-drop 2.2s ease-in infinite}\n@keyframes kk-drop{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(14px);opacity:0}}\n.kk-robot .kk-zzz{animation:kk-zzz 2.4s ease-in-out infinite}\n@keyframes kk-zzz{0%{transform:translate(0,4px);opacity:0}40%{opacity:1}100%{transform:translate(6px,-8px);opacity:0}}\n.kk-robot .kk-qmark{animation:kk-bob 1.8s ease-in-out infinite}\n.kk-robot[data-mood=sleep] .kk-head{transform:rotate(9deg)!important}\n.kk-robot[data-mood=sleep] .kk-float{animation-duration:4.5s}\n.kk-robot[data-mood=angry] .kk-float{animation:kk-tremble .18s linear infinite}\n@keyframes kk-tremble{0%,100%{transform:translateX(0)}50%{transform:translateX(1.3px)}}\n.kk-robot[data-mood=surprise] .kk-float{animation:kk-jump 1.4s ease-out infinite}\n@keyframes kk-jump{0%,60%,100%{transform:translateY(0)}20%{transform:translateY(-13px)}}\n.kk-robot[data-mood=love] .kk-hand-r,.kk-robot[data-mood=star] .kk-hand-r{transform:rotate(-110deg)}\n.kk-robot[data-mood=think] .kk-hand-r{transform:rotate(-95deg)}\n/* xấu hổ: ôm gấu che mặt */\n.kk-robot .kk-bear{transition:transform .4s cubic-bezier(.3,1.4,.5,1)}\n.kk-robot[data-mood=shy] .kk-bear{animation:none;transform:translate(20px,-58px) scale(1.25)}\n.kk-robot[data-mood=shy] .kk-hand-r{transform:rotate(-120deg)}\n/* tương tác */\n.kk-robot.kk-wave .kk-hand-r{animation:kk-wave .45s ease-in-out 4}\n@keyframes kk-wave{0%,100%{transform:rotate(-125deg)}50%{transform:rotate(-95deg)}}\n.kk-robot.kk-spin .kk-float{animation:kk-spinjump .7s ease-in-out 1}\n@keyframes kk-spinjump{0%{transform:translateY(0) rotate(0)}40%{transform:translateY(-18px) rotate(180deg)}100%{transform:translateY(0) rotate(360deg)}}\n.kk-robot.kk-squish .kk-float{animation:kk-squish .35s ease-out 1}\n@keyframes kk-squish{0%{transform:scale(1,1)}40%{transform:scale(1.12,.86) translateY(10px)}100%{transform:scale(1,1)}}\n.kk-robot.kk-dizzy .kk-pupil{animation:kk-dizzy .5s linear infinite}\n@keyframes kk-dizzy{0%{transform:translate(3px,0)}25%{transform:translate(0,3px)}50%{transform:translate(-3px,0)}75%{transform:translate(0,-3px)}100%{transform:translate(3px,0)}}\n.kk-robot.kk-dizzy .kk-head{animation:kk-shake .25s ease-in-out infinite}\n.kk-bubble{position:absolute;left:50%;top:-6px;transform:translate(-50%,0) scale(.9);background:#fff;border:1px solid #F1D5C2;border-radius:14px;padding:7px 12px;font-size:12px;font-weight:600;white-space:nowrap;color:#5a2a10;box-shadow:0 8px 20px #0000001a;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:5}\n.kk-bubble::after{content:\"\";position:absolute;left:50%;top:100%;transform:translateX(-50%);border:7px solid transparent;border-top-color:#fff}\n.kk-bubble.kk-show{opacity:1;transform:translate(-50%,-10px) scale(1)}\n.kk-bubble.kk-left{left:auto;right:100%;top:18%;transform:translate(4px,0) scale(.9);white-space:normal;width:max-content;max-width:230px;line-height:1.35;text-align:left}\n.kk-bubble.kk-left.kk-show{transform:translate(-8px,0) scale(1)}\n.kk-bubble.kk-left::after{left:100%;top:50%;transform:translateY(-50%);border-top-color:transparent;border-left-color:#fff}\n/* Halloween: mũ phù thủy + giỏ bí ngô + mũ cho gấu (html.halloween do useTheme gắn) */\nhtml.halloween .kk-robot .kk-hw{display:inline}\nhtml.halloween .kk-robot .kk-std,html.halloween .kk-robot .kk-wires{display:none}\n@media (hover:none),(pointer:coarse){.kk-robot{display:none!important}}\n";

/** Kỳ Kỳ có nhiều khoảng trống quanh hình hơn Tích Tích → phóng to để cùng size nhìn bằng nhau. */
const SCALE = 1.25;

let cssInjected = false;
function injectCss() {
  if (cssInjected || typeof document === "undefined") return;
  const existing = document.getElementById("kyky-css");
  if (existing) { existing.textContent = CSS; cssInjected = true; return; }
  const el = document.createElement("style");
  el.id = "kyky-css";
  el.textContent = CSS;
  document.head.appendChild(el);
  cssInjected = true;
}

const LINES = {
  enter: ["Chào cậu! 👋", "Hôm nay học gì nè?", "Kỳ Kỳ đây!", "Cùng ôn Aptis nha!"],
  hw: ["Trick or treat! 🍬", "Boo! 👻 Ôn bài chưa đó?", "Halloween vẫn phải luyện đề nha 🎃"],
  love: "Thương cậu nhất! 💕",
  angry: "Đừng chọc mình nữa mà! 😤",
  dizzy: "Chóng mặt quá… 😵‍💫",
  leave: "Đi rồi à… 🥺",
  sleep: "Zzz… 😴",
};
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export default function KyKy({
  size = 110,
  mood = "normal",
  shy = false,
  interactive = true,
  idleSleep = false,
  lookAt = null,
  bubbleSide = "top",
  enterLines,
  className = "",
}: KyKyProps) {
  const rawId = useId();
  const uid = useMemo(() => "kk" + rawId.replace(/[^a-zA-Z0-9]/g, ""), [rawId]);
  const html = useMemo(
    () => SVG.replace(/id="([\w-]+)"/g, `id="${uid}-$1"`).replace(/url\(#([\w-]+)\)/g, `url(#${uid}-$1)`),
    [uid],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef(lookAt);
  lookRef.current = lookAt;

  const [temp, setTemp] = useState<KyKyMood | null>(null);
  const [fx, setFx] = useState({ wave: false, spin: false, squish: false, dizzy: false });
  const [blink, setBlink] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; show: boolean }>({ text: "", show: false });

  const tempTimer = useRef<number>();
  const bubbleTimer = useRef<number>();
  const holdTimer = useRef<number>();
  const clicks = useRef<number[]>([]);
  const shakeScore = useRef(0);
  const last = useRef({ x: 0, y: 0, t: 0, speed: 0 });
  const enteredAt = useRef(0);

  useEffect(() => { injectCss(); }, []);

  const effective: KyKyMood = shy ? "shy" : (temp ?? (sleeping ? "sleep" : mood));
  const effRef = useRef(effective);
  effRef.current = effective;

  // ---- nhìn theo chuột ----
  useEffect(() => {
    let mx = window.innerWidth / 2, my = window.innerHeight / 2, raf = 0;
    const update = () => {
      raf = 0;
      const root = rootRef.current;
      if (!root) return;
      const r = root.getBoundingClientRect();
      if (!r.width) return;
      const t = lookRef.current;
      const tx = t ? t.x : mx, ty = t ? t.y : my;
      const cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.42;
      const dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy) || 1;
      const k2 = Math.min(1, d / 180), px = (dx / d) * 4.6 * k2, py = (dy / d) * 3.6 * k2;
      const head = root.querySelector<SVGGElement>(".kk-head");
      const face = root.querySelector<SVGGElement>(".kk-face");
      if (!["surprise", "think", "sad", "worry"].includes(effRef.current)) {
        root.querySelectorAll<SVGGElement>(".kk-pupil").forEach((p) => { p.style.transform = `translate(${px}px,${py}px)`; });
        if (face) face.style.transform = `translate(${px * 0.45}px,${py * 0.35}px)`;
      }
      if (head) head.style.transform = `rotate(${Math.max(-9, Math.min(9, dx / 45))}deg)`;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      const now = performance.now(), dt = now - last.current.t || 16;
      last.current = { x: e.clientX, y: e.clientY, t: now, speed: Math.hypot(e.clientX - last.current.x, e.clientY - last.current.y) / dt };
      schedule();
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (lookAt) window.dispatchEvent(new MouseEvent("mousemove", { clientX: lookAt.x, clientY: lookAt.y }));
  }, [lookAt?.x, lookAt?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- chớp mắt ----
  useEffect(() => {
    let t1: number, t2: number;
    const loop = () => {
      if (effRef.current !== "sleep") {
        setBlink(true);
        t2 = window.setTimeout(() => setBlink(false), 130);
      }
      t1 = window.setTimeout(loop, 2200 + Math.random() * 2600);
    };
    t1 = window.setTimeout(loop, 1200 + Math.random() * 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const say = useCallback((text: string, ms = 1800) => {
    setBubble({ text, show: true });
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble((b) => ({ ...b, show: false })), ms);
  }, []);

  const react = useCallback((m: KyKyMood | null, ms: number, text?: string) => {
    if (shy) return;
    clearTimeout(tempTimer.current);
    setTemp(m);
    if (text) say(text, Math.min(ms + 400, 2600));
    tempTimer.current = window.setTimeout(() => setTemp(null), ms);
  }, [shy, say]);

  const flash = useCallback((k: keyof typeof fx, ms: number) => {
    setFx((f) => ({ ...f, [k]: false }));
    requestAnimationFrame(() => setFx((f) => ({ ...f, [k]: true })));
    window.setTimeout(() => setFx((f) => ({ ...f, [k]: false })), ms);
  }, []);

  // ---- ngủ khi idle ----
  useEffect(() => {
    if (!idleSleep) { setSleeping(false); return; }
    let t: number;
    let asleep = false;
    const arm = () => {
      clearTimeout(t);
      t = window.setTimeout(() => { asleep = true; setSleeping(true); say(LINES.sleep, 3000); }, 12000);
    };
    const onMove = () => {
      if (asleep) { asleep = false; setSleeping(false); react("surprise", 1100, "Ơ mình tỉnh rồi! 😳"); }
      arm();
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    arm();
    return () => { clearTimeout(t); window.removeEventListener("mousemove", onMove); };
  }, [idleSleep, react, say]);

  useEffect(() => () => {
    clearTimeout(tempTimer.current); clearTimeout(bubbleTimer.current); clearTimeout(holdTimer.current);
  }, []);

  // ---- handlers ----
  const onEnter = () => {
    if (!interactive || shy) return;
    enteredAt.current = Date.now();
    const hw = document.documentElement.classList.contains("halloween") && Math.random() < 0.5;
    say(pick(hw ? LINES.hw : (enterLines && enterLines.length ? enterLines : LINES.enter)), 2400);
    flash("wave", 1900);
  };
  const onMoveSelf = () => {
    if (!interactive || shy) return;
    if (last.current.speed > 2.2) {
      shakeScore.current++;
      if (shakeScore.current > 18) { shakeScore.current = 0; flash("dizzy", 1800); say(LINES.dizzy); }
    } else shakeScore.current = Math.max(0, shakeScore.current - 1);
  };
  const onLeave = () => {
    if (!interactive || shy) return;
    clearTimeout(holdTimer.current);
    if (mood === "normal" && Date.now() - enteredAt.current > 1200) react("sad", 1400, LINES.leave);
  };
  const onDown = () => {
    if (!interactive || shy) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => { holdTimer.current = undefined; react("love", 2200, LINES.love); }, 1500);
  };
  const onUp = () => { clearTimeout(holdTimer.current); };
  const onClick = () => {
    if (!interactive || shy) return;
    const now = Date.now();
    clicks.current = clicks.current.filter((t) => now - t < 2000);
    clicks.current.push(now);
    if (clicks.current.length >= 5) { clicks.current = []; react("angry", 2000, LINES.angry); return; }
    const acts = [
      () => { flash("spin", 700); react("happy", 900, "Wheee! 🌀"); },
      () => { flash("squish", 350); react("laugh", 1200, "Hihi nhột! 😆"); },
      () => react("star", 1500, "Cậu giỏi lắm! ✨"),
      () => react("wink", 1300, "Cố lên nha! 😉"),
      () => react("surprise", 1200, "Ơ! 😲"),
    ];
    pick(acts)();
  };

  const cls = [
    "kk-robot",
    blink ? "kk-blink" : "",
    interactive ? "kk-interactive" : "",
    fx.wave ? "kk-wave" : "",
    fx.spin ? "kk-spin" : "",
    fx.squish ? "kk-squish" : "",
    fx.dizzy ? "kk-dizzy" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className={cls}
      data-mood={effective}
      style={{ ["--s" as any]: `${Math.round(size * SCALE)}px` }}
      onMouseEnter={onEnter}
      onMouseMove={onMoveSelf}
      onMouseLeave={onLeave}
      onMouseDown={onDown}
      onMouseUp={onUp}
      onClick={onClick}
      role="img"
      aria-label="Kỳ Kỳ — linh vật Aptis Kỳ Tích"
    >
      <div className={`kk-bubble ${bubbleSide === "left" ? "kk-left" : ""} ${bubble.show ? "kk-show" : ""}`}>{bubble.text}</div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
