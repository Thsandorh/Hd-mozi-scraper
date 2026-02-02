const { CONFIG } = require('../config');
const { getMovieInfoFromImdb, getEpisodeInfo } = require('./tmdb');
const { resolveHdmoziUrl, extractRpmIdFromHdmozi, findVideaIdInHtml } = require('./hdmozi');
const { extractRpmStream } = require('./rpm');

async function extractStreamFromImdb(imdbId, season = null, episode = null) {
  try {
    console.log(`🎯 Starting IMDB-based extraction: ${imdbId}${season ? ` S${season}E${episode}` : ''}`);

    console.log(`📋 Fetching TMDB info for IMDB ID: ${imdbId}`);
    const mediaInfo = await getMovieInfoFromImdb(imdbId);
    if (!mediaInfo) {
      throw new Error(`No TMDB data found for IMDB ID: ${imdbId}`);
    }

    console.log(`✅ TMDB Info: ${mediaInfo.title} (${mediaInfo.year}) - ${mediaInfo.type}`);

    let episodeInfo = null;
    if (mediaInfo.type === 'series' && season && episode) {
      episodeInfo = await getEpisodeInfo(mediaInfo.tmdbId, season, episode);
      if (episodeInfo) {
        console.log(`📺 Episode: S${episodeInfo.seasonNumber}E${episodeInfo.episodeNumber} - ${episodeInfo.episodeTitle}`);
      }
    }

    console.log(`🔗 Resolving HDMozi URL (with search)...`);
    const hdmoziUrl = await resolveHdmoziUrl(mediaInfo, season, episode);
    if (!hdmoziUrl) {
      throw new Error(`Could not resolve HDMozi URL for: ${mediaInfo.title}`);
    }

    console.log(`✅ HDMozi URL: ${hdmoziUrl}`);

    console.log(`🔎 Checking for Videa embed as fallback...`);
    const pageResp = await fetch(hdmoziUrl, {
      headers: {
        'User-Agent': CONFIG.hdmozi.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    let pageHtml = '';
    if (pageResp.ok) {
      pageHtml = await pageResp.text();
      const videaId = findVideaIdInHtml(pageHtml);
      if (videaId) {
        console.log(`✅ Videa detected with ID: ${videaId}`);
        const result = {
          title: mediaInfo.type === 'series' && episodeInfo
            ? `${mediaInfo.title} S${episodeInfo.seasonNumber}E${episodeInfo.episodeNumber} - ${episodeInfo.episodeTitle}`
            : `${mediaInfo.title} (${mediaInfo.year})`,
          streams: [
            {
              url: `https://videa.hu/player?v=${videaId}&platform=mobile`,
              quality: 'auto',
              type: 'web',
              source: 'videa-web'
            }
          ]
        };
        console.log(`🎉 Returning Videa web stream fallback`);
        return result;
      }
    }

    console.log(`🕷️ Scraping RPM ID from HDMozi...`);
    const rpmId = await extractRpmIdFromHdmozi(hdmoziUrl);
    if (!rpmId) {
      throw new Error(`No RPM/Videa ID found on HDMozi page: ${hdmoziUrl}`);
    }

    if (typeof rpmId === 'string' && rpmId.startsWith('videa:')) {
      const videaId = rpmId.split(':')[1];
      console.log(`✅ Using Videa fallback via DooPlayer JSON: ${videaId}`);
      const result = {
        title: mediaInfo.type === 'series' && episodeInfo
          ? `${mediaInfo.title} S${episodeInfo.seasonNumber}E${episodeInfo.episodeNumber} - ${episodeInfo.episodeTitle}`
          : `${mediaInfo.title} (${mediaInfo.year})`,
        streams: [
          {
            url: `https://videa.hu/player?v=${videaId}&platform=mobile`,
            quality: 'auto',
            type: 'web',
            source: 'videa-web'
          }
        ]
      };
      console.log(`🎉 Returning Videa web stream from DooPlayer`);
      return result;
    }

    console.log(`✅ Found RPM ID: ${rpmId}`);

    console.log(`🎬 Extracting stream data from RPM...`);
    const result = await extractRpmStream(rpmId);

    if (episodeInfo) {
      result.title = `${mediaInfo.title} S${episodeInfo.seasonNumber}E${episodeInfo.episodeNumber} - ${episodeInfo.episodeTitle}`;
    } else {
      result.title = `${mediaInfo.title} (${mediaInfo.year})`;
    }

    console.log(`🎉 Successfully extracted ${result.streams.length} stream(s) for: ${result.title}`);
    return result;
  } catch (error) {
    console.error(`❌ IMDB-based extraction failed: ${error.message}`);
    throw error;
  }
}

module.exports = { extractStreamFromImdb };
