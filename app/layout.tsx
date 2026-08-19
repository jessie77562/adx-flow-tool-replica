import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADX 流量分组管理",
  description: "广告投放运营后台的流量分组管理功能还原版",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
