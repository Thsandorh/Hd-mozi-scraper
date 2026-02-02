const { webcrypto } = require('node:crypto');
const { CONFIG } = require('../config');
const { hexToBytes } = require('../utils/hex');

const { subtle } = webcrypto;

function getAESKey() {
  return hexToBytes(CONFIG.rpm.keyHex);
}

async function decryptRpmResponse(hexData) {
  try {
    const keyBytes = getAESKey();
    const dataBytes = hexToBytes(hexData);

    if (dataBytes.length === 0) {
      throw new Error('Invalid hex data');
    }

    const key = await subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, true, ['decrypt']);
    const plaintext = await subtle.decrypt({ name: 'AES-CBC', iv: CONFIG.rpm.iv }, key, dataBytes);
    const result = new TextDecoder().decode(new Uint8Array(plaintext));

    return result;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

async function generatePlayerToken(playerId) {
  try {
    const payload = {
      id: playerId,
      w: 1920,
      h: 1080,
      r: CONFIG.rpm.baseUrl
    };

    const payloadJson = JSON.stringify(payload);
    const keyBytes = getAESKey();
    const payloadBytes = new TextEncoder().encode(payloadJson);

    const blockSize = 16;
    const paddingNeeded = blockSize - (payloadBytes.length % blockSize);
    const paddedPayload = new Uint8Array(payloadBytes.length + paddingNeeded);
    paddedPayload.set(payloadBytes);
    for (let i = payloadBytes.length; i < paddedPayload.length; i++) {
      paddedPayload[i] = paddingNeeded;
    }

    const key = await subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, true, ['encrypt']);
    const encrypted = await subtle.encrypt({ name: 'AES-CBC', iv: CONFIG.rpm.iv }, key, paddedPayload);

    const encryptedBytes = new Uint8Array(encrypted);
    const hexToken = Array.from(encryptedBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    return hexToken;
  } catch (error) {
    throw new Error(`Token generation failed: ${error.message}`);
  }
}

async function getVideoInfo(videoId) {
  try {
    const url = `${CONFIG.rpm.baseUrl}/api/v1/info?id=${videoId}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': CONFIG.rpm.userAgent,
        'Referer': `${CONFIG.rpm.baseUrl}/#${videoId}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const hexData = await response.text();
    const decrypted = await decryptRpmResponse(hexData);
    const videoInfo = JSON.parse(decrypted);

    return videoInfo;
  } catch (error) {
    throw new Error(`Failed to get video info: ${error.message}`);
  }
}

async function extractStreamData(videoId, playerId, token) {
  try {
    const url = `${CONFIG.rpm.baseUrl}/api/v1/video?id=${videoId}&w=1920&h=1080&r=`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': CONFIG.rpm.userAgent,
        'Referer': `${CONFIG.rpm.baseUrl}/#${videoId}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const hexData = await response.text();

    if (!/^[0-9a-f\s]+$/i.test(hexData.trim()) || hexData.length < 100) {
      throw new Error('Response is not encrypted data');
    }

    const decrypted = await decryptRpmResponse(hexData);
    const streamData = JSON.parse(decrypted);

    if (!streamData.hls && !streamData.source) {
      throw new Error('No stream URLs found in response');
    }

    return streamData;
  } catch (error) {
    throw new Error(`Failed to extract stream data: ${error.message}`);
  }
}

async function extractRpmStream(videoId) {
  try {
    console.log(`🎯 Extracting RPM stream for: ${videoId}`);

    const videoInfo = await getVideoInfo(videoId);
    console.log(`✅ Video: ${videoInfo.title}`);
    console.log(`🎮 Player ID: ${videoInfo.playerId}`);

    const token = await generatePlayerToken(videoInfo.playerId);
    console.log(`🔑 Token generated: ${token.slice(0, 20)}... (${token.length} chars)`);

    const streamData = await extractStreamData(videoId, videoInfo.playerId, token);

    const result = {
      title: videoInfo.title,
      streams: []
    };

    if (streamData.source) {
      try {
        const masterUrl = streamData.source;
        const u = new URL(masterUrl);
        const host = u.hostname || '';
        const isIpHost = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
        const isRpmDomain = host.includes('rpmstream.live');
        const baseOrigin = `${u.protocol}//${u.host}`;
        const vParam = u.searchParams.get('v');

        if (isIpHost || !isRpmDomain) {
          console.log(`🔍 Direct master detected (${host}). Fetching variants and propagating v=${vParam || 'N/A'}`);
          const refererBase = isIpHost ? CONFIG.rpm.baseUrl : baseOrigin;
          const resp = await fetch(masterUrl, {
            headers: {
              'User-Agent': CONFIG.rpm.userAgent,
              'Referer': refererBase,
              'Origin': refererBase
            }
          });
          if (resp.ok) {
            const m3u8 = await resp.text();
            const lines = m3u8.split(/\r?\n/);
            let lastInf = null;
            const variants = [];
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              if (line.startsWith('#EXT-X-STREAM-INF')) {
                lastInf = line;
                continue;
              }
              if (line.startsWith('#')) continue;
              if (lastInf) {
                let variantUrl;
                try {
                  variantUrl = new URL(line, masterUrl);
                } catch (_) {
                  try { variantUrl = new URL(masterUrl); } catch (_) { variantUrl = null; }
                }
                if (variantUrl) {
                  if (vParam && !variantUrl.searchParams.has('v')) {
                    variantUrl.searchParams.set('v', vParam);
                  }
                  let quality = 'auto';
                  try {
                    const res = lastInf.match(/RESOLUTION=(\d+)x(\d+)/i);
                    if (res) {
                      const height = parseInt(res[2], 10);
                      if (height >= 2160) quality = '2160p';
                      else if (height >= 1440) quality = '1440p';
                      else if (height >= 1080) quality = '1080p';
                      else if (height >= 720) quality = '720p';
                      else if (height >= 480) quality = '480p';
                      else quality = `${height}p`;
                    } else {
                      const bw = lastInf.match(/BANDWIDTH=(\d+)/i);
                      if (bw) {
                        const b = parseInt(bw[1], 10);
                        if (b >= 6_000_000) quality = '2160p';
                        else if (b >= 3_500_000) quality = '1440p';
                        else if (b >= 2_000_000) quality = '1080p';
                        else if (b >= 1_000_000) quality = '720p';
                        else if (b >= 600_000) quality = '480p';
                        else quality = '360p';
                      }
                    }
                  } catch (_) {}
                  variants.push({ url: variantUrl.href, quality });
                }
                lastInf = null;
              }
            }

            if (variants.length > 0) {
              console.log(`✅ Found ${variants.length} HLS variants in master:`);
              variants.slice(0, 5).forEach(v => console.log(`   - ${v.quality}: ${v.url}`));
              for (const v of variants) {
                result.streams.push({
                  url: v.url,
                  quality: v.quality,
                  type: 'hls',
                  source: 'rpm-ip-variant'
                });
              }
            } else {
              console.log('⚠️ No variants found in master, falling back to direct master URL');
              result.streams.push({
                url: masterUrl,
                quality: 'auto',
                type: 'hls',
                source: 'rpm-direct'
              });
            }
          } else {
            console.log(`⚠️ Could not fetch master.m3u8 (HTTP ${resp.status}), falling back to direct master`);
            result.streams.push({
              url: masterUrl,
              quality: 'auto',
              type: 'hls',
              source: 'rpm-direct'
            });
          }
        } else {
          console.log('ℹ️ Skipping non-IP host for direct forwarding');
        }
      } catch (e) {
        console.error(`❌ Error expanding master to variants: ${e.message}`);
        result.streams.push({
          url: streamData.source,
          quality: 'auto',
          type: 'hls',
          source: 'rpm-direct'
        });
      }
    }

    if (streamData.subtitle && streamData.subtitle.forced) {
      result.subtitles = [{
        url: CONFIG.rpm.baseUrl + streamData.subtitle.forced.split('#')[0],
        lang: streamData.subtitle.forced.split('#')[1] || 'hun'
      }];
    }

    console.log(`✅ Extracted ${result.streams.length} stream(s)`);
    return result;
  } catch (error) {
    console.error(`❌ RPM extraction failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  generatePlayerToken,
  getVideoInfo,
  extractStreamData,
  extractRpmStream
};
