module.exports = {
  '/api/**': {
    target: process.env.TOBU_API_TARGET || 'http://127.0.0.1:4000',
    secure: false,
    changeOrigin: true,
  },
};
