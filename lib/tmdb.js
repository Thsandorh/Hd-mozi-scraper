const { CONFIG } = require('./config');

function tmdbUrl(path, params = {}) {
  const url = new URL(`${CONFIG.tmdb.baseUrl}${path}`);
  url.searchParams.set('api_key', CONFIG.tmdb.apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

// 🎬 TMDB API FUNCTIONS
async function getMovieInfoFromImdb(imdbId) {
  try {
    console.log(`🔍 Looking up IMDB ID: ${imdbId}`);

    // Step 1: Find by IMDB ID via TMDB API
    const findUrl = tmdbUrl(`/find/${imdbId}`, { external_source: 'imdb_id' });
    const findResponse = await fetch(findUrl);

    if (!findResponse.ok) {
      throw new Error(`TMDB find API error: ${findResponse.status}`);
    }

    const findData = await findResponse.json();

    // Handle movies
    if (findData.movie_results && findData.movie_results.length > 0) {
      const movie = findData.movie_results[0];
      const tmdbId = movie.id;

      console.log(`📝 Found movie TMDB ID: ${tmdbId}`);

      // Step 2: Get Hungarian details
      const hungarianTitle = await getHungarianMovieTitle(tmdbId);

      return {
        type: 'movie',
        title: hungarianTitle || movie.title,
        originalTitle: movie.original_title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        tmdbId: tmdbId
      };
    }

    // Handle TV series
    if (findData.tv_results && findData.tv_results.length > 0) {
      const series = findData.tv_results[0];
      const tmdbId = series.id;

      console.log(`📺 Found series TMDB ID: ${tmdbId}`);

      // Step 2: Get Hungarian details
      const hungarianTitle = await getHungarianSeriesTitle(tmdbId);

      return {
        type: 'series',
        title: hungarianTitle || series.name,
        originalTitle: series.original_name,
        year: series.first_air_date ? new Date(series.first_air_date).getFullYear() : null,
        tmdbId: tmdbId
      };
    }

    // Handle TV episodes - try to find the parent series
    if (findData.tv_episode_results && findData.tv_episode_results.length > 0) {
      const episode = findData.tv_episode_results[0];
      const seriesTmdbId = episode.show_id;

      console.log(`📺 Found episode, getting series TMDB ID: ${seriesTmdbId}`);

      // Get series details via proxy
      const seriesUrl = tmdbUrl(`/tv/${seriesTmdbId}`, { language: 'hu-HU' });
      const seriesResponse = await fetch(seriesUrl);

      if (seriesResponse.ok) {
        const seriesData = await seriesResponse.json();
        const hungarianTitle = await getHungarianSeriesTitle(seriesTmdbId);

        return {
          type: 'series',
          title: hungarianTitle || seriesData.name,
          originalTitle: seriesData.original_name,
          year: seriesData.first_air_date ? new Date(seriesData.first_air_date).getFullYear() : null,
          tmdbId: seriesTmdbId
        };
      }
    }

    throw new Error(`No results found for IMDB ID: ${imdbId}`);

  } catch (error) {
    console.error(`❌ TMDB lookup error: ${error.message}`);
    return null;
  }
}

// 🇭🇺 Get Hungarian movie title
async function getHungarianMovieTitle(tmdbId) {
  try {
    // Get Hungarian version first via proxy
    const hunUrl = tmdbUrl(`/movie/${tmdbId}`, { language: 'hu-HU' });
    const hunResponse = await fetch(hunUrl);

    if (hunResponse.ok) {
      const hunData = await hunResponse.json();
      if (hunData.title && hunData.title !== hunData.original_title) {
        console.log(`🇭🇺 Found Hungarian title: "${hunData.title}"`);
        return hunData.title;
      }
    }

    // Try alternative titles via proxy
    const altUrl = tmdbUrl(`/movie/${tmdbId}/alternative_titles`);
    const altResponse = await fetch(altUrl);

    if (altResponse.ok) {
      const altData = await altResponse.json();
      const hungarianAlt = altData.titles?.find(alt =>
        alt.iso_3166_1 === 'HU' ||
        alt.title.match(/[áéíóöőúüű]/i)
      );

      if (hungarianAlt) {
        console.log(`🇭🇺 Found Hungarian alternative title: "${hungarianAlt.title}"`);
        return hungarianAlt.title;
      }
    }

    return null;
  } catch (error) {
    console.log(`⚠️  Hungarian title lookup failed: ${error.message}`);
    return null;
  }
}

// 🇭🇺 Get Hungarian series title
async function getHungarianSeriesTitle(tmdbId) {
  try {
    // Get Hungarian version first via proxy
    const hunUrl = tmdbUrl(`/tv/${tmdbId}`, { language: 'hu-HU' });
    const hunResponse = await fetch(hunUrl);

    if (hunResponse.ok) {
      const hunData = await hunResponse.json();
      if (hunData.name && hunData.name !== hunData.original_name) {
        console.log(`🇭🇺 Found Hungarian series title: "${hunData.name}"`);
        return hunData.name;
      }
    }

    // Try alternative titles via proxy
    const altUrl = tmdbUrl(`/tv/${tmdbId}/alternative_titles`);
    const altResponse = await fetch(altUrl);

    if (altResponse.ok) {
      const altData = await altResponse.json();
      const hungarianAlt = altData.results?.find(alt =>
        alt.iso_3166_1 === 'HU' ||
        alt.title.match(/[áéíóöőúüű]/i)
      );

      if (hungarianAlt) {
        console.log(`🇭🇺 Found Hungarian alternative series title: "${hungarianAlt.title}"`);
        return hungarianAlt.title;
      }
    }

    return null;
  } catch (error) {
    console.log(`⚠️  Hungarian series title lookup failed: ${error.message}`);
    return null;
  }
}

async function getEpisodeInfo(tmdbId, season, episode) {
  try {
    const url = tmdbUrl(`/tv/${tmdbId}/season/${season}/episode/${episode}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`TMDB episode API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      episodeTitle: data.name,
      episodeNumber: data.episode_number,
      seasonNumber: data.season_number,
      airDate: data.air_date
    };
  } catch (error) {
    console.error(`❌ TMDB episode API error: ${error.message}`);
    return null;
  }
}

module.exports = {
  tmdbUrl,
  getMovieInfoFromImdb,
  getHungarianMovieTitle,
  getHungarianSeriesTitle,
  getEpisodeInfo
};
