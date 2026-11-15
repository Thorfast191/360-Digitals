module.exports = {
  apps: [
    {
      name: "agency-website",
      script: "pnpm",
      // Bind to loopback so traffic must come through Nginx (audit D-09).
      args: "start --hostname 127.0.0.1",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
