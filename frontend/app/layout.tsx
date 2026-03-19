/**
 * Root Layout for AgentCenter
 * 根布局 - 必须是服务器组件
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RootLayoutContent } from "./RootLayoutContent";
import { I18nProvider } from "@/components/layout/I18nProvider";
import { defaultLocale } from "@/i18n";

// 根据语言返回不同的元数据
function getMetadataForLocale(): Metadata {
  // 默认中文元数据
  return {
    title: "AgentCenter",
    description: "管理多个并行 Claude Code CLI 实例",
    icons: {
      icon: "/favicon.svg",
    },
  };
}

export const metadata: Metadata = getMetadataForLocale();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FFFEF9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Runtime configuration - read from environment variables at server startup
  const runtimeConfig = {
    API_DOMAIN: '',  // Use relative path for API requests (rewrites handled by next.config.js)
    WS_DOMAIN: process.env.WS_DOMAIN || 'ws://localhost:8010',
  };

  return (
    <html lang={defaultLocale}>
      <head>
        {/* Inject runtime config as global variable */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};`,
          }}
        />
      </head>
      <body className="font-sans bg-bg-primary text-text-primary">
        <I18nProvider>
          <RootLayoutContent>{children}</RootLayoutContent>
        </I18nProvider>
      </body>
    </html>
  );
}
