module.exports = {
  apps: [
    {
      name: "newsletter-web",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      autorestart: true,
    },
    {
      name: "newsletter-worker",
      script: "npm",
      args: "run worker",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      autorestart: true,
    },
    {
      name: "newsletter-deploy-watcher",
      script: "npm",
      args: "run deploy-watcher",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      autorestart: true,
    },
  ],
};
