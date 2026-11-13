---
title: 给眼镜换个脑子
seo_title: 给眼镜换个脑子：小米 AI 眼镜（M2442G1）蓝牙 SPP 协议与 SDK · Xiaomi AI Glasses SPP Protocol & SDK
subtitle: Xiaomi AI Glasses (M2442G1): Bluetooth SPP Protocol, SDK and Third-Party Model Integration
date: 2026-11-12
tags: [小米AI眼镜, M2442G1, 蓝牙SPP, SDK, 折腾]
description: 小米 AI 眼镜（M2442G1）固件断更，ADB 也没开成，第三方实现了蓝牙 SPP 协议，自己写了个宿主机端 SDK 把别的模型接了进去。
---

今年年初买了副小米 AI 眼镜。刚到手那阵子确实新鲜，出门走哪戴哪，拍了不少照片和视频。

这副眼镜的硬件其实不差，也是国内第一款双芯片架构的 AI 眼镜：高通骁龙 AR1 负责拍照、录像和视觉处理，恒玄 BES2700H 负责蓝牙、音频和待机。

平时 AR1 深度休眠，全靠恒玄这颗小核挂着麦克风等唤醒词，有活干了才拉起大核，干完继续休眠。40 克的镜框塞进这套异构方案，续航能顶八个多小时，当时在同类产品里算很能打了。

拉胯的是软件。系统明显是赶工上线的半成品，更要命的是，我买了眼镜以后没过多久，官方就基本停止了固件更新。硬件摆在这，脑子却永远停在了出厂那天。

刷视频看到有人成功打开了 ADB，也跟着折腾了一通，但最终没能成功。既然进不去设备端拿不到 Shell，那就换个思路。

眼镜的音频流、控制指令和交互靠蓝牙走手机 App 中转。既然改不了眼镜，把手机端替换掉就行了。

协议跑通之后，用自己写的宿主机程序接管蓝牙连接，后台则把语音和图像路由给自己挑的 Agent，再把生成的语音推回耳机里。

ADB 终究没开出来，但这么一通操作下来，也算是给它换了个脑子。

代码和协议整理放在 [GitHub](https://github.com/slchy/xiaomi-ai-glasses2grok-and-so-on) 上了，[哔哩哔哩](https://www.bilibili.com/video/BV1jn456gEeQ/)有一段实机演示。纯属个人折腾，非官方实现。
