import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // รูปบทความอัปโหลดขึ้น Cloudinary — อนุญาตเฉพาะ cloud ของเราเท่านั้น
    // ไม่เปิดกว้างทั้ง res.cloudinary.com เพราะนั่นคือ cloud ของทุกคนบนโลก
    remotePatterns: process.env.CLOUDINARY_CLOUD_NAME
      ? [
          {
            protocol: 'https',
            hostname: 'res.cloudinary.com',
            pathname: `/${process.env.CLOUDINARY_CLOUD_NAME}/**`,
          },
        ]
      : [],
  },
}

export default nextConfig
