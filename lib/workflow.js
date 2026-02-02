const { CONFIG } = require('./config');
const { getMovieInfoFromImdb, getEpisodeInfo } = require('./tmdb');
const { resolveHdmoziUrl, extractRpmIdFromHdmozi, findVideaIdInHtml } = require('./hdmozi');
const { extractRpmStream } = require('./rpm');

// 🎯 MAIN EXTRACTION FUNCTION (NEW IMDB-BASED WORKFLOW)
async function extractStreamFromImdb(imdbId, season = null, episode = null) {
  try {
    console.log(`🎯 Starting IMDB-based extraction: ${imdbId}${season ? ` S${season}E${episode}` : ''}`);

    // Step 1: Get media info from TMDB using IMDB ID
    console.log(`📋 Fetching TMDB info for IMDB ID: ${imdbId}`);
    const mediaInfo = await getMovieInfoFromImdb(imdbId);
    if (!mediaInfo) {
      throw new Error(`No TMDB data found for IMDB ID: ${imdbId}`);
    }

    console.log(`✅ TMDB Info: ${mediaInfo.title} (${mediaInfo.year}) - ${mediaInfo.type}`);

    // Step 2: Get episode info for series
    let episodeInfo = null;
    if (mediaInfo.type === 'series' && season && episode) {
      episodeInfo = await getEpisodeInfo(mediaInfo.tmdbId, season, episode);
      if (episodeInfo) {
        console.log(`📺 Episode: S${episodeInfo.seasonNumber}E${episodeInfo.episodeNumber} - ${episodeInfo.episodeTitle}`);
      }
    }

    // Step 3: Resolve HDMozi URL (search-based to avoid 404)
    console.log('🔗 Resolving HDMozi URL (with search)...');
    const hdmoziUrl = await resolveHdmoziUrl(mediaInfo, season, episode);
    if (!hdmoziUrl) {
      throw new Error(`Could not resolve HDMozi URL for: ${mediaInfo.title}`);
    }

    console.log(`✅ HDMozi URL: ${hdmoziUrl}`);

    // Step 4a: Try detect Videa embed for low-load fallback
    console.log('🔎 Checking for Videa embed as fallback...');
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
        console.log('🎉 Returning Videa web stream fallback');
        return result;
      }
    }

    // Step 4b: Extract RPM ID from HDMozi
    console.log('🕷️ Scraping RPM ID from HDMozi...');
    const rpmId = await extractRpmIdFromHdmozi(hdmoziUrl);
    if (!rpmId) {
      throw new Error(`No RPM/Videa ID found on HDMozi page: ${hdmoziUrl}`);
    }

    // If DooPlayer yielded a Videa ID, return Videa web player fallback
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
      console.log('🎉 Returning Videa web stream from DooPlayer');
      return result;
    }

    console.log(`✅ Found RPM ID: ${rpmId}`);

    // Step 5: Extract stream using RPM ID
    console.log('🎬 Extracting stream data from RPM...');
    const result = await extractRpmStream(rpmId);

    // Add episode info to title if available
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

module.exports = {
  extractStreamFromImdb
};
