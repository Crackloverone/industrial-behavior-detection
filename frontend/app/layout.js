import './globals.css';

export const metadata = {
  title: '工业视觉行为检测系统',
  description: '基于 YOLOv8 + ByteTrack 的工业视觉行为检测系统',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
