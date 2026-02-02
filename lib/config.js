// 🔑 CONFIGURATION
const CONFIG = {
  // TMDB API (direct)
  tmdb: {
    baseUrl: 'https://api.themoviedb.org/3',
    apiKey: 'ffe7ef8916c61835264d2df68276ddc2'
  },

  // HDMozi scraping
  hdmozi: {
    baseUrl: 'https://hdmozi.hu',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },

  // RPM Share extraction
  rpm: {
    baseUrl: 'https://rpmshare.rpmstream.live',
    keyHex: '6b69656d7469656e6d75613931316361', // "kiemtienmua911ca"
    iv: new Uint8Array([49, 50, 51, 52, 53, 54, 55, 56, 57, 48, 111, 105, 117, 121, 116, 114]), // "123456789oiuytr"
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
};

module.exports = { CONFIG };
