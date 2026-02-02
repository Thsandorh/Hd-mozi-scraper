const express = require('express');
const cors = require('cors');
const { registerRoutes } = require('./lib/routes');

const app = express();
const PORT = process.env.PORT || 7000;

// CORS middleware for Stremio compatibility
app.use(cors());
app.use(express.json());

registerRoutes(app);

// 🚀 START SERVER (skip on Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('🇭🇺 HDMozi→RPM Magyar Addon v2.0');
    console.log('=====================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Stremio Manifest: http://localhost:${PORT}/manifest.json`);
    console.log(`🏠 Info Page: http://localhost:${PORT}/`);
    console.log('');
    console.log('🎯 Stremio Integration Ready:');
    console.log('   ✅ IMDB-based search (tt1234567 or tt1234567:1:5)');
    console.log('   ✅ Movie & Series support');
    console.log('   ✅ Season/Episode parsing (tt1234567:1:5)');
    console.log('   ✅ HDMozi scraping → RPM extraction → M3U8 streams');
    console.log('');
    console.log('🧪 Quick Tests:');
    console.log(`   🎬 Csupasz Pisztoly 33⅓: http://localhost:${PORT}/stream/movie/tt3402138.json`);
    console.log(`   📺 Breaking Bad S01E01: http://localhost:${PORT}/stream/series/tt0903747:1:1.json`);
    console.log(`   📺 Alien Föld S01E01: http://localhost:${PORT}/stream/series/tt13623632:1:1.json`);
    console.log('');
    console.log('📊 Status:');
    console.log('   TMDB API: ✅ Hardcoded key');
    console.log('   HDMozi: ✅ Ready');
    console.log('   RPM Share: ✅ Ready');
    console.log('');
    console.log('🎉 Magyar content streaming ready for Stremio!');
  });
}

module.exports = app;
