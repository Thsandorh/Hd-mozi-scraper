function hexToBytes(hex) {
  const clean = (hex || '').trim();
  const matches = clean.match(/[\da-f]{2}/gi);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

module.exports = { hexToBytes };
