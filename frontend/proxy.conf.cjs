const target = process.env.MLP_API_PROXY_TARGET || 'https://localhost:7243';
const url = new URL(target);
if (
  url.protocol !== 'https:' ||
  !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
  url.username ||
  url.password ||
  url.pathname !== '/' ||
  url.search ||
  url.hash
)
  throw new Error('Development API proxy requires an explicit loopback HTTPS origin.');

module.exports = { '/api': { target, secure: true, changeOrigin: true } };
