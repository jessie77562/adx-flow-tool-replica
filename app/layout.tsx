import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADX 广告位策略管理",
  description: "以最小广告位为配置单元、同广告位策略互斥的流量管理系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
