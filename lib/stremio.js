const { CONFIG } = require('./config');

function buildStreamHeaders(stream) {
  try {
    if (stream.source === 'videa-web') {
      return {
        'User-Agent': CONFIG.hdmozi.userAgent,
        Referer: 'https://videa.hu/'
      };
    }

    if (stream.source && stream.source.startsWith('rpm')) {
      return {
        'User-Agent': CONFIG.rpm.userAgent,
        Referer: CONFIG.rpm.baseUrl,
        Origin: CONFIG.rpm.baseUrl
      };
    }

    const u = new URL(stream.url);
    const base = `${u.protocol}//${u.host}`;

    if (u.hostname.includes('rpmstream.live')) {
      return {
        'User-Agent': CONFIG.rpm.userAgent,
        Referer: CONFIG.rpm.baseUrl,
        Origin: CONFIG.rpm.baseUrl
      };
    }

    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Referer: base,
      Origin: base,
      Accept: '*/*',
      'Accept-Encoding': 'gzip, deflate',
      Connection: 'keep-alive'
    };
  } catch (e) {
    return {
      'User-Agent': CONFIG.rpm.userAgent,
      Referer: CONFIG.rpm.baseUrl,
      Origin: CONFIG.rpm.baseUrl
    };
  }
}

function buildStremioStreams(result) {
  const subtitles = result.subtitles || [];
  return result.streams.map((stream) => ({
    name: 'HDMozi-RPM Magyar',
    title: `[HU] ${result.title}${stream.quality ? ` - ${stream.quality}` : ''}`,
    url: stream.url,
    subtitles,
    behaviorHints: {
      proxyHeaders: {
        request: buildStreamHeaders(stream)
      },
      notWebReady: stream.type === 'web'
    }
  }));
}

module.exports = {
  buildStreamHeaders,
  buildStremioStreams
};
